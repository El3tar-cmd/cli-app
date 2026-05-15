/**
 * ⚡ NOVA Core Engine — Orchestrates LLM calls, tool execution, and streaming
 */

import chalk from 'chalk';
import { OllamaClient, type OllamaMessage, type OllamaToolCall, type StreamChunk } from './ollama-client.js';
import { StreamRenderer } from './stream-renderer.js';
import { ConfigManager } from './config.js';
import { ContextManager } from '../memory/context-manager.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { TokenCounter } from '../utils/token-counter.js';
import { TOOL_DEFINITIONS, SYSTEM_PROMPT, FAST_SYSTEM_PROMPT, PLAN_SYSTEM_PROMPT, CODE_SYSTEM_PROMPT, AGENT_SYSTEM_PROMPT } from '../utils/constants.js';
import { colors, gradient, getTheme, box, ICONS } from '../ui/theme.js';
import { logger } from '../utils/logger.js';
import { formatDuration } from '../utils/helpers.js';

export type NovaMode = 'chat' | 'fast' | 'plan' | 'code' | 'agent';

const MODE_PROMPTS: Record<NovaMode, string> = {
  chat: SYSTEM_PROMPT,
  fast: FAST_SYSTEM_PROMPT,
  plan: PLAN_SYSTEM_PROMPT,
  code: CODE_SYSTEM_PROMPT,
  agent: AGENT_SYSTEM_PROMPT,
};

export interface EngineStats {
  totalTokensIn: number;
  totalTokensOut: number;
  totalRequests: number;
  totalToolCalls: number;
  sessionStart: number;
}

export class Engine {
  private ollama: OllamaClient;
  private renderer: StreamRenderer;
  private config: ConfigManager;
  private context: ContextManager;
  private tools: ToolRegistry;
  private mode: NovaMode = 'chat';
  private model: string;
  private stats: EngineStats;
  private confirmHandler: ((msg: string) => Promise<boolean>) | null = null;
  private extraSystemPrompt: string = '';

  constructor(config: ConfigManager, tools: ToolRegistry) {
    this.config = config;
    this.tools = tools;
    const ollamaConfig = config.get('ollama');
    this.ollama = new OllamaClient(ollamaConfig.url);
    this.renderer = new StreamRenderer();
    this.model = ollamaConfig.model;
    this.context = new ContextManager(ollamaConfig.contextLength);
    this.context.setSystemPrompt(SYSTEM_PROMPT);
    this.stats = {
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalRequests: 0,
      totalToolCalls: 0,
      sessionStart: Date.now(),
    };
  }

  /** Set extra system prompt content (e.g., from NOVA.md) */
  setExtraSystemPrompt(content: string): void {
    this.extraSystemPrompt = content;
  }

  /** Set confirmation handler for tool calls */
  setConfirmHandler(handler: (msg: string) => Promise<boolean>): void {
    this.confirmHandler = handler;
  }

  /** Check Ollama connection */
  async checkConnection(): Promise<boolean> {
    return this.ollama.healthCheck();
  }

  /** Get Ollama version */
  async getVersion(): Promise<string> {
    return this.ollama.getVersion();
  }

  /** List available models */
  async listModels() {
    return this.ollama.listModels();
  }

  /** Switch model */
  setModel(model: string): void {
    this.model = model;
  }

  /** Get current model */
  getModel(): string {
    return this.model;
  }

  /** Switch mode */
  setMode(mode: NovaMode): void {
    this.mode = mode;
    const basePrompt = MODE_PROMPTS[mode];
    this.context.setSystemPrompt(basePrompt + this.extraSystemPrompt);
  }

  /** Get current mode */
  getMode(): NovaMode {
    return this.mode;
  }

  /** Get context manager */
  getContext(): ContextManager {
    return this.context;
  }

  /** Get stats */
  getStats(): EngineStats {
    return this.stats;
  }

  /** Process user input and stream response */
  async processMessage(userInput: string): Promise<string> {
    // Add user message to context
    this.context.addMessage({ role: 'user', content: userInput });

    const startTime = Date.now();
    let fullResponse = '';

    // Print assistant header
    const theme = getTheme();
    process.stdout.write('\n' + chalk.hex(theme.primary).bold(`  ${ICONS.nova} NOVA`) + chalk.hex(theme.muted)(` [${this.model}]`) + '\n\n');

    this.renderer.reset();
    this.stats.totalRequests++;

    // Determine if we should use tools
    const useTools = this.mode !== 'fast';
    const isAgent = this.mode === 'agent';
    const maxIterations = isAgent ? 10 : 3; // Agent can loop more

    try {
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;
        const messages = this.context.getMessages();
        let iterResponse = '';
        let toolCalls: OllamaToolCall[] = [];

        // Stream the response
        for await (const chunk of this.ollama.chatStream({
          model: this.model,
          messages,
          temperature: this.config.get('ollama').temperature,
          top_p: this.config.get('ollama').topP,
          num_ctx: this.config.get('ollama').contextLength,
          tools: useTools ? TOOL_DEFINITIONS : undefined,
        })) {
          if (chunk.message?.content) {
            this.renderer.writeToken(chunk.message.content);
            iterResponse += chunk.message.content;
          }

          // Detect tool calls
          if (chunk.message?.tool_calls) {
            toolCalls = chunk.message.tool_calls;
          }

          if (chunk.done) {
            if (chunk.eval_count) this.stats.totalTokensOut += chunk.eval_count;
            if (chunk.prompt_eval_count) this.stats.totalTokensIn += chunk.prompt_eval_count;
          }
        }

        this.renderer.flush();
        fullResponse += iterResponse;

        // Add assistant response to context
        if (iterResponse || toolCalls.length > 0) {
          this.context.addMessage({ 
            role: 'assistant', 
            content: iterResponse,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined
          });
        }

        // If no tool calls, we're done
        if (toolCalls.length === 0) {
          break;
        }

        // Execute tool calls
        const toolResults = await this.executeToolCalls(toolCalls);

        // If all tools were skipped/failed, stop
        if (toolResults.length === 0) break;

        // Add tool results to context and continue the loop
        for (const tr of toolResults) {
          this.context.addMessage({
            role: 'tool',
            content: tr.output,
          });
        }

        // Print continuation header
        this.renderer.reset();
        process.stdout.write('\n' + chalk.hex(theme.primary).bold(`  ${ICONS.nova} NOVA`) +
          chalk.hex(theme.muted)(` (step ${iteration})`) + '\n\n');
      }

      // Print timing
      const elapsed = Date.now() - startTime;
      process.stdout.write('\n' + chalk.hex(theme.muted)(`  ${ICONS.clock} ${formatDuration(elapsed)}`) + '\n');

    } catch (err: any) {
      process.stdout.write('\n');
      process.stdout.write(
        chalk.hex(theme.error)(`  ${ICONS.error} Error: ${err.message}`) + '\n'
      );
      logger.error('Engine error', err);
      fullResponse = `Error: ${err.message}`;
    }

    return fullResponse;
  }

  /** Execute tool calls and return results */
  private async executeToolCalls(toolCalls: OllamaToolCall[]): Promise<Array<{ name: string; output: string }>> {
    const theme = getTheme();
    const results: Array<{ name: string; output: string }> = [];

    for (const call of toolCalls) {
      const toolName = call.function.name;
      const toolArgs = call.function.arguments;
      const tool = this.tools.get(toolName);

      this.stats.totalToolCalls++;

      // Print tool call header
      process.stdout.write('\n' + chalk.hex(theme.border)('  ' + '─'.repeat(50)) + '\n');
      process.stdout.write(
        chalk.hex(theme.warning).bold(`  ${ICONS.tool} Tool: `) +
        chalk.hex(theme.accent)(toolName) + '\n'
      );

      // Show args
      for (const [key, val] of Object.entries(toolArgs)) {
        const valStr = typeof val === 'string' && val.length > 80 ? val.slice(0, 77) + '...' : String(val);
        process.stdout.write(chalk.hex(theme.muted)(`     ${key}: `) + chalk.hex(theme.text)(valStr) + '\n');
      }

      // Check confirmation (skip in agent mode for safe tools)
      const isAgent = this.mode === 'agent';
      const autoApprove = this.config.get('tools').autoApprove;
      const needsConfirm = tool?.requiresConfirmation && !autoApprove.includes(toolName);

      if (needsConfirm && this.confirmHandler && !isAgent) {
        const approved = await this.confirmHandler(`Execute ${toolName}?`);
        if (!approved) {
          process.stdout.write(chalk.hex(theme.warning)(`  ${ICONS.warning} Skipped by user`) + '\n');
          continue;
        }
      }

      // Execute tool
      const result = await this.tools.execute(toolName, toolArgs);

      if (result.success) {
        process.stdout.write(chalk.hex(theme.success)(`  ${ICONS.success} Success`) + '\n');
        // Show output (truncated)
        const output = result.output.length > 500 ? result.output.slice(0, 497) + '...' : result.output;
        if (output) {
          process.stdout.write(chalk.hex(theme.textDim)(
            output.split('\n').map(l => `  ${ICONS.pipe} ${l}`).join('\n')
          ) + '\n');
        }
      } else {
        process.stdout.write(chalk.hex(theme.error)(`  ${ICONS.error} Failed: ${result.error}`) + '\n');
      }

      process.stdout.write(chalk.hex(theme.border)('  ' + '─'.repeat(50)) + '\n');

      results.push({ name: toolName, output: result.output || result.error || '' });
    }

    return results;
  }

  /** Abort current operation */
  abort(): void {
    this.ollama.abort();
  }

  /** Compress context */
  async compressContext(): Promise<number> {
    return this.context.compress(async (text) => {
      const result = await this.ollama.chat({
        model: this.model,
        messages: [
          { role: 'system', content: 'Summarize the following conversation concisely, preserving key facts, decisions, and code references. Be brief.' },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
      });
      return result.content;
    });
  }
}
