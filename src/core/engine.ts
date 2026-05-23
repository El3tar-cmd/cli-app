/**
 * ⚡ NOVA Core Engine — Orchestrates LLM calls, tool execution, and streaming
 * Enhanced with Cognitive Architecture: Scratchpad + Vector Memory
 */

import chalk from 'chalk';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { OllamaClient, type OllamaMessage, type OllamaToolCall, type StreamChunk } from './ollama-client.js';
import { StreamRenderer } from './stream-renderer.js';
import { ConfigManager } from './config.js';
import { ContextManager } from '../memory/context-manager.js';
import { Scratchpad } from '../memory/scratchpad.js';
import { VectorMemory } from '../memory/vector-memory.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { TokenCounter } from '../utils/token-counter.js';
import { PromptLoader } from './prompt-loader.js';
import { SkillRouter } from './skill-router.js';
import { TOOL_DEFINITIONS, SYSTEM_PROMPT, FAST_SYSTEM_PROMPT, PLAN_SYSTEM_PROMPT, CODE_SYSTEM_PROMPT, AGENT_SYSTEM_PROMPT, GOAL_SYSTEM_PROMPT } from '../utils/constants.js';
import { colors, gradient, getTheme, box, ICONS } from '../ui/theme.js';
import { logger } from '../utils/logger.js';
import { formatDuration, getNovaSubDir } from '../utils/helpers.js';
import { DiffEditor } from '../tools/diff-editor.js';

export type NovaMode = 'chat' | 'fast' | 'plan' | 'code' | 'agent' | 'goal';

const MODE_PROMPTS: Record<NovaMode, string> = {
  chat: SYSTEM_PROMPT,
  fast: FAST_SYSTEM_PROMPT,
  plan: PLAN_SYSTEM_PROMPT,
  code: CODE_SYSTEM_PROMPT,
  agent: AGENT_SYSTEM_PROMPT,
  goal: GOAL_SYSTEM_PROMPT,
};

export interface EngineStats {
  totalTokensIn: number;
  totalTokensOut: number;
  totalRequests: number;
  totalToolCalls: number;
  sessionStart: number;
}

export class Engine extends EventEmitter {
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
  private promptLoader: PromptLoader | null = null;
  private scratchpad: Scratchpad;
  private vectorMemory: VectorMemory;
  private silent: boolean;
  private cwd: string;

  constructor(config: ConfigManager, tools: ToolRegistry, promptsDir?: string, cwd?: string, options?: { silent?: boolean }) {
    super();
    this.config = config;
    this.tools = tools;
    this.silent = !!options?.silent;
    const ollamaConfig = config.get('ollama');
    this.ollama = new OllamaClient(ollamaConfig.url);
    const toolsConfig = config.get('tools');
    if (toolsConfig) {
      this.ollama.maxRetries = toolsConfig.maxRetries ?? 3;
      this.ollama.requestTimeoutMs = toolsConfig.requestTimeoutMs ?? 15000;
    }
    
    // Silence stream renderer if in silent mode
    if (this.silent) {
      const silentStream = {
        write: () => true
      } as unknown as NodeJS.WriteStream;
      this.renderer = new StreamRenderer(silentStream);
    } else {
      this.renderer = new StreamRenderer();
    }
    
    this.model = ollamaConfig.model;
    this.context = new ContextManager(ollamaConfig.contextLength);

    // Initialize Cognitive Architecture
    const workDir = cwd || process.cwd();
    this.cwd = workDir;
    this.scratchpad = new Scratchpad(workDir);
    this.vectorMemory = new VectorMemory(getNovaSubDir('memory'));

    // Register shared instances for tool access
    tools.setShared('scratchpad', this.scratchpad);
    tools.setShared('vectorMemory', this.vectorMemory);
    tools.setShared('ollama', this.ollama);
    tools.setShared('model', this.model);

    // Initialize vector memory with Ollama embedding function (async, non-blocking)
    this.initVectorMemory().catch(err => {
      logger.warn(`Vector memory init deferred: ${err.message}`);
    });

    // Try to load prompts from .md files, fall back to hardcoded constants
    if (promptsDir && existsSync(promptsDir)) {
      this.promptLoader = new PromptLoader(promptsDir);
      const systemPrompt = this.promptLoader.buildSystemPrompt('chat');
      this.context.setSystemPrompt(systemPrompt);
      logger.info(`Loaded prompts from ${promptsDir}`);

      // Watch for changes and auto-rebuild
      this.promptLoader.watchForChanges(() => {
        const rebuilt = this.promptLoader!.buildSystemPrompt(this.mode, this.extraSystemPrompt);
        this.context.setSystemPrompt(rebuilt);
        logger.info('System prompt rebuilt from changed files');
      });
    } else {
      this.context.setSystemPrompt(SYSTEM_PROMPT);
    }

    this.stats = {
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalRequests: 0,
      totalToolCalls: 0,
      sessionStart: Date.now(),
    };
  }

  /** Helper method to write output only when not in silent mode */
  private writeOut(text: string): void {
    if (!this.silent) {
      process.stdout.write(text);
    }
  }

  /** Initialize vector memory with Ollama embeddings */
  private async initVectorMemory(): Promise<void> {
    await this.vectorMemory.init(async (text: string) => {
      try {
        // Explicitly use nomic-embed-text for embeddings
        const response = await this.ollama.embed('nomic-embed-text', text);
        return response || [];
      } catch {
        return [];
      }
    });
  }

  /** Set extra system prompt content (e.g., from NOVA.md) */
  setExtraSystemPrompt(content: string): void {
    this.extraSystemPrompt = content;
    // Rebuild the active system prompt with new extra content
    if (this.promptLoader) {
      const rebuilt = this.promptLoader.buildSystemPrompt(this.mode, content);
      this.context.setSystemPrompt(rebuilt);
    } else {
      const basePrompt = MODE_PROMPTS[this.mode];
      this.context.setSystemPrompt(basePrompt + content);
    }
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
    this.tools.setShared('model', model);
  }

  /** Get current model */
  getModel(): string {
    return this.model;
  }

  /** Switch mode */
  setMode(mode: NovaMode): void {
    this.mode = mode;
    if (this.promptLoader) {
      const rebuilt = this.promptLoader.buildSystemPrompt(mode, this.extraSystemPrompt);
      this.context.setSystemPrompt(rebuilt);
    } else {
      const basePrompt = MODE_PROMPTS[mode];
      this.context.setSystemPrompt(basePrompt + this.extraSystemPrompt);
    }
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

  /** Get scratchpad */
  getScratchpad(): Scratchpad {
    return this.scratchpad;
  }

  /** Get vector memory */
  getVectorMemory(): VectorMemory {
    return this.vectorMemory;
  }

  /** Process user input and stream response */
  async processMessage(userInput: string): Promise<string> {
    // Add user message to context
    this.context.addMessage({ role: 'user', content: userInput });

    // Route skills
    let activeSkills: string[] | undefined;
    if (this.promptLoader) {
      const keyFiles = this.scratchpad.getState().keyFiles || [];
      const routing = SkillRouter.route(userInput, keyFiles);
      activeSkills = routing.activeSkills;

      if (activeSkills && activeSkills.length > 0) {
        this.emit('skills_activated', { skills: activeSkills, reasons: routing.reasons });
      }

      // Render a gorgeous CLI box before processing if not silent
      if (!this.silent && activeSkills.length > 0) {
        const theme = getTheme();
        const skillList = activeSkills.map(s => {
          const reason = routing.reasons[s] || 'Relevant to request context';
          return `• ${chalk.hex(theme.primary).bold(s.toUpperCase())}: ${chalk.hex(theme.textDim)(reason)}`;
        }).join('\n');

        this.writeOut('\n' + box(skillList, {
          title: '🧠 ACTIVE COGNITIVE SKILLS',
          style: 'rounded',
          borderColor: theme.accent,
          titleColor: theme.primary,
        }) + '\n');
      }
    }

    // Inject scratchpad state into system prompt (always current)
    this.rebuildSystemPrompt(activeSkills);

    // Store user query in vector memory (background, non-blocking)
    if (this.vectorMemory.isReady()) {
      this.vectorMemory.store(userInput, 'interaction', { role: 'user' }).catch(() => {});
    }

    const startTime = Date.now();
    let fullResponse = '';

    // Print assistant header
    const theme = getTheme();
    this.writeOut('\n' + chalk.hex(theme.primary).bold(`  ${ICONS.nova} NOVA`) + chalk.hex(theme.muted)(` [${this.model}]`) + '\n\n');

    this.renderer.reset();
    this.stats.totalRequests++;

    // Auto-compress context if usage exceeds 65% of budget
    const budget = this.config.get('ollama').contextLength || 128000;
    const ctxStats = this.context.getStats();
    if (ctxStats.used > budget * 0.65) {
      this.writeOut(chalk.hex(theme.muted)(`  ⚡ Context at ${Math.round(ctxStats.used / budget * 100)}% — auto-compressing...`) + '\n');
      try {
        await this.compressContext();
        const newStats = this.context.getStats();
        this.writeOut(chalk.hex(theme.success)(`  ✔ Compressed to ${Math.round(newStats.used / budget * 100)}%`) + '\n\n');
      } catch {
        // Compression failed, continue anyway
      }
    }

    // Determine if we should use tools
    const useTools = this.mode !== 'fast';
    const isAgent = this.mode === 'agent';
    const maxIterations = isAgent ? 30 : 20; // Increased from 3 to 20 for regular modes

    try {
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;
        const messages = this.context.getMessages();
        let iterResponse = '';
        let toolCalls: OllamaToolCall[] = [];

        // Stream the response
        let spinnerTimer: ReturnType<typeof setInterval> | null = null;
        const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let spinnerIdx = 0;
        let firstChunk = true;

        // Show spinner while waiting for first chunk
        if (iteration > 1) {
          this.writeOut(chalk.hex(theme.muted)(`  ${spinnerFrames[0]} Thinking...`));
          spinnerTimer = setInterval(() => {
            spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;
            this.writeOut(`\r  ${chalk.hex(theme.accent)(spinnerFrames[spinnerIdx])} ${chalk.hex(theme.muted)('Thinking...')}`);
          }, 80);
        }

        for await (const chunk of this.ollama.chatStream({
          model: this.model,
          messages,
          temperature: this.config.get('ollama').temperature,
          top_p: this.config.get('ollama').topP,
          num_ctx: this.config.get('ollama').contextLength,
          keep_alive: this.config.get('ollama').keepAliveSeconds,
          tools: useTools ? TOOL_DEFINITIONS : undefined,
        })) {
          // Clear spinner on first chunk
          if (firstChunk && spinnerTimer) {
            clearInterval(spinnerTimer);
            spinnerTimer = null;
            this.writeOut('\r' + ' '.repeat(30) + '\r');
          }
          firstChunk = false;

          if (chunk.message?.content) {
            this.renderer.writeToken(chunk.message.content);
            this.emit('token', chunk.message.content);
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

        // Ensure spinner is cleared
        if (spinnerTimer) {
          clearInterval(spinnerTimer);
          this.writeOut('\r' + ' '.repeat(30) + '\r');
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
          let output = tr.output;
          if (output.length > 2000) {
            const head = output.slice(0, 800);
            const tail = output.slice(-800);
            output = `${head}\n\n... (${output.length - 1600} chars truncated to save tokens) ...\n\n${tail}`;
          }
          this.context.addMessage({
            role: 'tool',
            content: output,
          });
        }

        // Print continuation header
        this.renderer.reset();
        this.writeOut('\n' + chalk.hex(theme.primary).bold(`  ${ICONS.nova} NOVA`) +
          chalk.hex(theme.muted)(` (step ${iteration})`) + '\n\n');
      }

      // Print timing
      const elapsed = Date.now() - startTime;
      this.writeOut('\n' + chalk.hex(theme.muted)(`  ${ICONS.clock} ${formatDuration(elapsed)}`) + '\n');

      // Store assistant response in vector memory (background)
      if (this.vectorMemory.isReady() && fullResponse.length > 50) {
        this.vectorMemory.store(
          fullResponse.slice(0, 3000),
          'interaction',
          { role: 'assistant', elapsed, toolCalls: this.stats.totalToolCalls }
        ).catch(() => {});
      }

    } catch (err: any) {
      this.writeOut('\n');
      this.writeOut(
        chalk.hex(theme.error)(`  ${ICONS.error} Error: ${err.message}`) + '\n'
      );
      logger.error('Engine error', err);
      fullResponse = `Error: ${err.message}`;

      // Store errors in vector memory to avoid repeating them
      if (this.vectorMemory.isReady()) {
        this.vectorMemory.store(`Error during: ${userInput}\n${err.message}`, 'error').catch(() => {});
      }
    }

    return fullResponse;
  }

  /** Execute tool calls and return results */
  private async executeToolCalls(toolCalls: OllamaToolCall[]): Promise<Array<{ name: string; output: string }>> {
    const theme = getTheme();
    const results: Array<{ name: string; output: string }> = [];

    // Separate parallel and sequential tool calls
    const parallelCalls: OllamaToolCall[] = [];
    const sequentialCalls: OllamaToolCall[] = [];

    for (const call of toolCalls) {
      const toolName = call.function.name;
      const toolArgs = call.function.arguments;
      if (toolName === 'delegate_task' && toolArgs.parallel === true) {
        parallelCalls.push(call);
      } else {
        sequentialCalls.push(call);
      }
    }

    // Execute parallel calls concurrently with concurrency limit
    if (parallelCalls.length > 0) {
      const maxConcurrent = this.config.get('tools').maxConcurrentAgents || 2;
      this.writeOut('\n' + chalk.hex(theme.info)(`  ⚡ Spawning ${parallelCalls.length} sub-agents in parallel (max concurrency: ${maxConcurrent})...`) + '\n');

      const executeParallelCall = async (call: OllamaToolCall) => {
        const toolName = call.function.name;
        const toolArgs = call.function.arguments;
        const tool = this.tools.get(toolName);

        this.stats.totalToolCalls++;

        // Print header for this parallel task
        this.writeOut(
          chalk.hex(theme.warning).bold(`  ${ICONS.tool} Parallel Agent Started: `) +
          chalk.hex(theme.accent)(toolArgs.task as string) + '\n'
        );

        // Execute tool (will be run inside a sandbox/silent sub-agent)
        const result = await this.tools.execute(toolName, toolArgs);

        if (result.success) {
          this.writeOut(
            chalk.hex(theme.success)(`  ${ICONS.success} Parallel Agent Finished: `) +
            chalk.hex(theme.accent)(toolArgs.task as string) + '\n'
          );
        } else {
          this.writeOut(
            chalk.hex(theme.error)(`  ${ICONS.error} Parallel Agent Failed: `) +
            chalk.hex(theme.accent)(toolArgs.task as string) + ` - ${result.error || result.output}\n`
          );
        }

        return { name: toolName, output: result.output || result.error || '' };
      };

      const parallelResults = await runWithLimit(maxConcurrent, parallelCalls, executeParallelCall);
      results.push(...parallelResults);
    }

    // Execute sequential calls one by one
    for (const call of sequentialCalls) {
      const toolName = call.function.name;
      const toolArgs = call.function.arguments;
      const tool = this.tools.get(toolName);

      this.stats.totalToolCalls++;

      // Print tool call header
      this.emit('tool_start', { name: toolName, args: toolArgs });
      this.writeOut('\n' + chalk.hex(theme.border)('  ' + '─'.repeat(50)) + '\n');
      this.writeOut(
        chalk.hex(theme.warning).bold(`  ${ICONS.tool} Tool: `) +
        chalk.hex(theme.accent)(toolName) + '\n'
      );

      // Show args
      for (const [key, val] of Object.entries(toolArgs)) {
        const valStr = typeof val === 'string' && val.length > 80 ? val.slice(0, 77) + '...' : String(val);
        this.writeOut(chalk.hex(theme.muted)(`     ${key}: `) + chalk.hex(theme.text)(valStr) + '\n');
      }

      // Check confirmation — auto-approve only whitelisted tools, never skip for dangerous ones
      const autoApprove = this.config.get('tools').autoApprove;
      const isAutoApproved = autoApprove.includes(toolName);
      const needsConfirm = tool?.requiresConfirmation && !isAutoApproved;

      if (needsConfirm && this.confirmHandler) {
        let argsPreview = '';
        let hasPreviewDiff = false;

        // Dry-run diff preview for file modification tools before confirmation
        if (['file_write', 'file_edit', 'file_patch', 'file_multi_edit'].includes(toolName)) {
          const previewResult = DiffEditor.generatePreview(toolName, toolArgs, this.cwd);
          if (previewResult.success && previewResult.diff) {
            hasPreviewDiff = true;
            this.writeOut('\n' + chalk.hex(theme.accent).bold(`  📝 PROPOSED CHANGES PREVIEW (Dry Run):`) + '\n');
            const formattedDiff = previewResult.diff.split('\n').map((line: string) => {
              if (line.startsWith('+') && !line.startsWith('+++')) {
                return chalk.green(`     ${line}`);
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                return chalk.red(`     ${line}`);
              } else if (line.startsWith('@@')) {
                return chalk.cyan(`     ${line}`);
              } else {
                return chalk.hex(theme.textDim)(`     ${line}`);
              }
            }).join('\n');
            this.writeOut(formattedDiff + '\n');
          }
        }

        try {
          const previewArgs: Record<string, any> = { ...toolArgs };
          for (const key in previewArgs) {
            if (typeof previewArgs[key] === 'string' && previewArgs[key].length > 250) {
              previewArgs[key] = previewArgs[key].slice(0, 250) + '... (truncated)';
            }
          }
          argsPreview = JSON.stringify(previewArgs, null, 2);
        } catch {}
        
        const confirmMsg = hasPreviewDiff 
          ? `Apply these changes to ${toolArgs.path}?`
          : `Execute ${toolName}?\nArguments:\n${argsPreview}`;

        const approved = await this.confirmHandler(confirmMsg);
        if (!approved) {
          this.writeOut(chalk.hex(theme.warning)(`  ${ICONS.warning} Skipped by user`) + '\n');
          continue;
        }
      }

      // Execute tool
      const result = await this.tools.execute(toolName, toolArgs);

      if (result.success) {
        this.emit('tool_end', { name: toolName, success: true, output: result.output, metadata: result.metadata });
        this.writeOut(chalk.hex(theme.success)(`  ${ICONS.success} Success`) + '\n');
        // Show output (truncated)
        const output = result.output.length > 500 ? result.output.slice(0, 497) + '...' : result.output;
        if (output) {
          this.writeOut(chalk.hex(theme.textDim)(
            output.split('\n').map(l => `  ${ICONS.pipe} ${l}`).join('\n')
          ) + '\n');
        }

        // Show colored diff if available in metadata
        const metadata = result.metadata as any;
        if (metadata?.diff) {
          this.writeOut('\n' + chalk.hex(theme.accent).bold(`  📝 Changes diff:`) + '\n');
          const formattedDiff = metadata.diff.split('\n').map((line: string) => {
            if (line.startsWith('+') && !line.startsWith('+++')) {
              return chalk.green(`     ${line}`);
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              return chalk.red(`     ${line}`);
            } else if (line.startsWith('@@')) {
              return chalk.cyan(`     ${line}`);
            } else {
              return chalk.hex(theme.textDim)(`     ${line}`);
            }
          }).join('\n');
          this.writeOut(formattedDiff + '\n');
        }
      } else {
        this.emit('tool_end', { name: toolName, success: false, error: result.error, metadata: result.metadata });
        this.writeOut(chalk.hex(theme.error)(`  ${ICONS.error} Failed: ${result.error}`) + '\n');

        // Self-Healing Interceptor
        if (toolName === 'command_run' && result.metadata?.healingProposed) {
          const reason = result.metadata.reason as string;
          const proposal = result.metadata.proposal as string;

          this.writeOut('\n' + chalk.hex(theme.accent).bold(`  🩹 NOVA Self-Healing Diagnostic Alert:`) + '\n');
          this.writeOut(chalk.hex(theme.text)(`     Failed command: `) + chalk.hex(theme.error)(toolArgs.command as string) + '\n');
          this.writeOut(chalk.hex(theme.text)(`     Reason:         `) + chalk.hex(theme.warning)(reason) + '\n');
          this.writeOut(chalk.hex(theme.text)(`     Proposed Fix:   `) + chalk.hex(theme.success)(proposal) + '\n\n');

          let approved = false;
          if (this.confirmHandler) {
            approved = await this.confirmHandler(`Run self-healing command: ${proposal}?`);
          }

          if (approved) {
            this.writeOut(chalk.hex(theme.info)(`  ⚡ Executing self-healing command...`) + '\n');
            const healedResult = await this.tools.execute('command_run', {
              command: proposal,
              cwd: toolArgs.cwd,
              timeout: toolArgs.timeout
            });

            if (healedResult.success) {
              this.writeOut(chalk.hex(theme.success)(`  ✔ Healing succeeded! Error resolved.`) + '\n');
              results.push({
                name: toolName,
                output: `[Self-Healing Succeeded]\nThe original command failed but was auto-healed by running: ${proposal}\nHealing output:\n${healedResult.output}`
              });
              this.writeOut(chalk.hex(theme.border)('  ' + '─'.repeat(50)) + '\n');
              continue;
            } else {
              this.writeOut(chalk.hex(theme.error)(`  ❌ Healing command failed.`) + '\n');
              results.push({
                name: toolName,
                output: `[Self-Healing Failed]\nOriginal error: ${result.error || result.output}\nAttempted fix with: ${proposal}\nFix error: ${healedResult.error || healedResult.output}`
              });
              this.writeOut(chalk.hex(theme.border)('  ' + '─'.repeat(50)) + '\n');
              continue;
            }
          }
        }
      }

      this.writeOut(chalk.hex(theme.border)('  ' + '─'.repeat(50)) + '\n');

      results.push({ name: toolName, output: result.output || result.error || '' });
    }

    return results;
  }

  /** Get the tool registry */
  getTools(): ToolRegistry {
    return this.tools;
  }

  /** Abort current operation */
  abort(): void {
    this.ollama.abort();
  }

  /** Rebuild system prompt with current scratchpad state */
  private rebuildSystemPrompt(activeSkills?: string[]): void {
    const scratchState = this.scratchpad.getState();
    const hasActiveGoal = scratchState.goal && scratchState.phase !== 'done';
    const shouldInjectScratchpad = hasActiveGoal || this.mode === 'goal' || this.mode === 'agent';

    const ctxStats = this.context.getStats();
    const budget = this.config.get('ollama').contextLength || 128000;
    const isTight = ctxStats.used > budget * 0.5;

    const scratchpadState = shouldInjectScratchpad ? this.scratchpad.formatForPrompt(isTight) : '';

    if (this.promptLoader) {
      const base = this.promptLoader.buildSystemPrompt(this.mode, this.extraSystemPrompt, activeSkills);
      const full = scratchpadState ? `${base}\n\n${scratchpadState}` : base;
      this.context.setSystemPrompt(full);
    } else {
      const base = MODE_PROMPTS[this.mode] + this.extraSystemPrompt;
      const full = scratchpadState ? `${base}\n\n${scratchpadState}` : base;
      this.context.setSystemPrompt(full);
    }
  }

  /** Compress context */
  async compressContext(): Promise<number> {
    // Before compressing, store the conversation in vector memory for long-term recall
    if (this.vectorMemory.isReady()) {
      const entries = this.context.getRecent(10);
      const summary = entries.map(e => `${e.message.role}: ${e.message.content.slice(0, 500)}`).join('\n');
      this.vectorMemory.store(summary, 'interaction', { type: 'pre-compression' }).catch(() => {});
    }

    return this.context.compress(async (text) => {
      const result = await this.ollama.chat({
        model: this.model,
        messages: [
          { role: 'system', content: 'Summarize the following conversation concisely, preserving key facts, decisions, file paths, and code references. Focus on what was accomplished and what remains. Be brief but precise.' },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        num_ctx: this.config.get('ollama').contextLength,
        keep_alive: this.config.get('ollama').keepAliveSeconds,
      });
      return result.content;
    });
  }
}

/**
 * Executes async tasks in parallel with a concurrency limit.
 */
async function runWithLimit<T>(limit: number, items: T[], fn: (item: T) => Promise<any>): Promise<any[]> {
  const results: any[] = [];
  const executing = new Set<Promise<any>>();
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}
