/**
 * 🤖 NOVA Ollama Client — Streaming API client for Ollama
 * Supports chat completions, model management, and tool calling
 */

import { logger } from '../utils/logger.js';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaToolCall[];
}

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface ChatOptions {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  tools?: any[];
  format?: string;
  num_ctx?: number;
}

export interface StreamChunk {
  message?: { role: string; content: string; tool_calls?: OllamaToolCall[] };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  prompt_eval_count?: number;
}

export interface ModelInfo {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  details?: { family: string; parameter_size: string; quantization_level: string };
}

export class OllamaClient {
  private baseUrl: string;
  private abortController: AbortController | null = null;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /** Check if Ollama is reachable */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`, { signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Get Ollama version */
  async getVersion(): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`);
      const data = await res.json() as any;
      return data.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /** List available models */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      const data = await res.json() as any;
      return (data.models || []) as ModelInfo[];
    } catch (err) {
      logger.error('Failed to list models', err);
      return [];
    }
  }

  /** Stream chat completion */
  async *chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
    this.abortController = new AbortController();

    const body: any = {
      model: options.model,
      messages: options.messages,
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        top_p: options.top_p ?? 0.9,
        num_ctx: options.num_ctx ?? 8192,
      },
    };

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama API error (${res.status}): ${errText}`);
      }

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const chunk = JSON.parse(trimmed) as StreamChunk;
            yield chunk;
            if (chunk.done) return;
          } catch {
            logger.debug(`Failed to parse chunk: ${trimmed}`);
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          yield JSON.parse(buffer.trim()) as StreamChunk;
        } catch {}
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        logger.debug('Stream aborted by user');
        return;
      }
      throw err;
    } finally {
      this.abortController = null;
    }
  }

  /** Non-streaming chat completion */
  async chat(options: ChatOptions): Promise<OllamaMessage> {
    const body: any = {
      model: options.model,
      messages: options.messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        top_p: options.top_p ?? 0.9,
        num_ctx: options.num_ctx ?? 8192,
      },
    };

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${errText}`);
    }

    const data = await res.json() as any;
    return data.message as OllamaMessage;
  }

  /** Abort current streaming request */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /** Pull a model */
  async *pullModel(name: string): AsyncGenerator<{ status: string; completed?: number; total?: number }> {
    const res = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    });

    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          try { yield JSON.parse(line.trim()); } catch {}
        }
      }
    }
  }
}
