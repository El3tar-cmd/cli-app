/**
 * 🤖 NOVA Ollama Client — Streaming API client for Ollama
 * Supports chat completions, model management, and tool calling
 */

import { logger } from '../utils/logger.js';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('nova-ollama-client');

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
  keep_alive?: number;
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
  public maxRetries = 3;
  public requestTimeoutMs = 15000;

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

  /** Wait for Ollama to become available (with retries) */
  async waitForConnection(maxWaitMs = 30000): Promise<boolean> {
    const startTime = Date.now();
    const retryDelays = [500, 1000, 2000, 3000, 5000];
    let attempt = 0;

    while (Date.now() - startTime < maxWaitMs) {
      const healthy = await this.healthCheck();
      if (healthy) return true;

      const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
      logger.info(`Ollama not ready, retrying in ${delay}ms (attempt ${attempt + 1})`);
      await new Promise(r => setTimeout(r, delay));
      attempt++;
    }
    return false;
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

  /** Generate embeddings for text using Ollama */
  async embed(model: string, text: string): Promise<number[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: text.slice(0, 2000) }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Embed failed: ${res.status}`);
      const data = await res.json() as any;
      // Ollama returns { embeddings: [[...]] } for single input
      if (data.embeddings && data.embeddings[0]) return data.embeddings[0];
      if (data.embedding) return data.embedding;
      return [];
    } catch (err: any) {
      logger.warn(`Embedding failed: ${err.message}`);
      return [];
    }
  }

  /** Stream chat completion */
  async *chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
    const span = tracer.startSpan('ollama.chatStream', {
      attributes: {
        'llm.model': options.model,
        'llm.context_length': options.num_ctx ?? 8192,
      },
    });
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
    if (options.keep_alive !== undefined) {
      body.keep_alive = options.keep_alive;
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    try {
      // Retry logic with exponential backoff for connection errors
      let lastError: Error | null = null;
      let res: Response | null = null;

      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), this.requestTimeoutMs);
        try {
          const signal = (AbortSignal as any).any 
            ? (AbortSignal as any).any([this.abortController.signal, timeoutController.signal])
            : this.abortController.signal; // fallback for older Node.js
          res = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal,
          });
          clearTimeout(timeoutId);
          lastError = null;
          break;
        } catch (err: any) {
          clearTimeout(timeoutId);
          lastError = err;
          if (this.abortController.signal.aborted) throw err;
          // Connection error — wait and retry with exponential backoff and jitter
          const baseDelay = 1000;
          const jitter = Math.random() * 200;
          const delay = Math.min(baseDelay * Math.pow(2, attempt) + jitter, 8000);
          logger.warn(`Connection failed (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${Math.round(delay)}ms`);
          await new Promise(r => setTimeout(r, delay));
        }
      }

      if (lastError || !res) {
        throw lastError || new Error('Failed to connect to Ollama after retries');
      }

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
            span.setAttribute('llm.tokens_out', chunk.eval_count ?? 0);
            yield chunk;
            if (chunk.done) { span.end(); return; }
          } catch {
            logger.debug(`Failed to parse chunk: ${trimmed}`);
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer.trim()) as StreamChunk;
          span.setAttribute('llm.tokens_out', chunk.eval_count ?? 0);
          yield chunk;
        } catch {}
      }
      span.end();
    } catch (err: any) {
      span.recordException(err);
      span.end();
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
