/**
 * 🚀 NOVA — Main Application Class (Enhanced)
 * Full-featured CLI with auto-model detection, plugins, planning mode, project analysis
 */

import * as readline from 'node:readline';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { ConfigManager } from './core/config.js';
import { Engine, type NovaMode } from './core/engine.js';
import { CommandRouter } from './core/router.js';
import { ToolRegistry } from './tools/tool-registry.js';
import { registerBuiltinTools } from './tools/built-in.js';
import { ConversationStore } from './memory/conversation-store.js';
import { ProjectIndex } from './memory/project-index.js';
import { KnowledgeBase } from './memory/knowledge-base.js';
import { PluginManager } from './plugins/plugin-manager.js';
import { CommandPicker } from './ui/command-picker.js';
import { colors, gradient, getTheme, setTheme, ICONS, LOGO, renderTagline, horizontalLine, badge, statusDot, box } from './ui/theme.js';
import { TokenCounter } from './utils/token-counter.js';
import { logger } from './utils/logger.js';
import { APP_NAME, APP_VERSION } from './utils/constants.js';
import { sleep, formatDuration, getNovaSubDir, generateId } from './utils/helpers.js';

export interface NovaOptions {
  model?: string;
  mode?: NovaMode;
  cwd?: string;
  noAnimation?: boolean;
  oneShot?: string;
}

export class Nova {
  private config: ConfigManager;
  private engine: Engine;
  private router: CommandRouter;
  private store: ConversationStore;
  private tools: ToolRegistry;
  private projectIndex: ProjectIndex;
  private knowledgeBase: KnowledgeBase;
  private pluginManager: PluginManager;
  private rl!: readline.Interface;
  private cwd: string;
  private running = false;
  private options: NovaOptions;
  private multilineBuffer: string[] = [];
  private inMultiline = false;
  private processing = false;
  private messageQueue: string[] = [];

  constructor(options: NovaOptions = {}) {
    this.options = options;
    this.cwd = options.cwd || process.cwd();

    // Initialize subsystems
    this.config = new ConfigManager();
    this.tools = new ToolRegistry();
    registerBuiltinTools(this.tools, this.cwd);

    this.engine = new Engine(this.config, this.tools);
    this.store = new ConversationStore();
    this.router = new CommandRouter(this.engine, this.store, this.config, this.cwd);
    this.projectIndex = new ProjectIndex();
    this.knowledgeBase = new KnowledgeBase();
    this.pluginManager = new PluginManager(this.tools);

    // Apply options
    if (options.mode) this.engine.setMode(options.mode);

    // Apply saved theme
    const savedTheme = this.config.get('ui').theme;
    if (savedTheme) setTheme(savedTheme);

    // Set up logger
    logger.configure({ logDir: getNovaSubDir('logs') });

    // Set confirm handler
    this.engine.setConfirmHandler(async (msg) => this.confirm(msg));
  }

  /** Start NOVA */
  async start(): Promise<void> {
    this.running = true;

    // Show startup animation
    if (!this.options.noAnimation) {
      await this.showStartup();
    }

    // Check Ollama connection
    const connected = await this.engine.checkConnection();
    const theme = getTheme();

    if (connected) {
      const version = await this.engine.getVersion();
      process.stdout.write(
        chalk.hex(theme.success)(`  ${statusDot('online')} Ollama connected`) +
        chalk.hex(theme.muted)(` (v${version})`) + '\n'
      );

      // Auto-detect model if not specified
      if (!this.options.model) {
        await this.autoDetectModel();
      } else {
        this.engine.setModel(this.options.model);
      }
    } else {
      process.stdout.write(
        chalk.hex(theme.error)(`  ${statusDot('offline')} Ollama not reachable`) + '\n' +
        chalk.hex(theme.warning)(`  ${ICONS.warning} Start Ollama: ollama serve`) + '\n'
      );
    }

    // Load plugins
    const pluginCount = await this.pluginManager.loadAll();
    if (pluginCount > 0) {
      process.stdout.write(
        chalk.hex(theme.info)(`  ${ICONS.plug} ${pluginCount} plugin(s) loaded`) + '\n'
      );
    }

    // Analyze current project
    const projectInfo = this.projectIndex.analyze(this.cwd);
    if (projectInfo.language !== 'unknown') {
      process.stdout.write(
        chalk.hex(theme.info)(`  ${ICONS.folder} Project: ${projectInfo.name}`) +
        chalk.hex(theme.muted)(` (${projectInfo.language}/${projectInfo.framework})`) + '\n'
      );
      // Inject project context
      const ctx = this.projectIndex.formatForContext(projectInfo);
      this.engine.getContext().addMessage({ role: 'system', content: `[Project Context]\n${ctx}` }, true);
    }

    // Inject knowledge base
    const kb = this.knowledgeBase.formatForContext(projectInfo.name);
    if (kb) {
      this.engine.getContext().addMessage({ role: 'system', content: kb }, true);
    }

    // Show session info
    this.printSessionInfo();

    // One-shot mode
    if (this.options.oneShot) {
      await this.engine.processMessage(this.options.oneShot);
      process.exit(0);
    }

    // Start REPL
    await this.startRepl();
  }

  /** Auto-detect best model from available models */
  private async autoDetectModel(): Promise<void> {
    const theme = getTheme();
    const models = await this.engine.listModels();
    if (models.length === 0) {
      process.stdout.write(chalk.hex(theme.warning)(`  ${ICONS.warning} No models found\n`));
      return;
    }

    // Priority: coder models > large models > any
    const priorities = ['qwen3-coder', 'deepseek', 'codellama', 'qwen3', 'llama'];
    let selected = models[0].name;

    for (const prio of priorities) {
      const match = models.find(m => m.name.toLowerCase().includes(prio));
      if (match) { selected = match.name; break; }
    }

    this.engine.setModel(selected);
    process.stdout.write(
      chalk.hex(theme.info)(`  ${ICONS.lightning} Auto-selected: `) +
      chalk.hex(theme.primary).bold(selected) + '\n'
    );
  }

  /** Show startup animation */
  private async showStartup(): Promise<void> {
    console.clear();
    const logoLines = LOGO.split('\n');
    for (const line of logoLines) {
      process.stdout.write(gradient(line) + '\n');
      await sleep(25);
    }
    process.stdout.write('\n' + renderTagline() + '\n');
    process.stdout.write(chalk.hex(getTheme().border)(horizontalLine('─', 60)) + '\n\n');
  }

  /** Print session info */
  private printSessionInfo(): void {
    const theme = getTheme();
    const model = this.engine.getModel();
    const mode = this.engine.getMode();

    process.stdout.write(
      chalk.hex(theme.muted)('  ') +
      chalk.hex(theme.textDim)('Model: ') + chalk.hex(theme.primary).bold(model) +
      chalk.hex(theme.muted)('  │  ') +
      chalk.hex(theme.textDim)('Mode: ') + badge(mode) +
      chalk.hex(theme.muted)('  │  ') +
      chalk.hex(theme.textDim)('Tools: ') + chalk.hex(theme.text)(String(this.tools.getNames().length)) +
      '\n'
    );
    process.stdout.write(chalk.hex(theme.muted)(`  /help for commands • /quit to exit • """ for multi-line\n`));
    process.stdout.write(chalk.hex(theme.border)(horizontalLine('─', 60)) + '\n');
  }

  /** Build tab-completion for commands */
  private completer(line: string): [string[], string] {
    const commands = [
      '/help', '/quit', '/clear', '/model', '/models', '/mode',
      '/chat', '/fast', '/code', '/agent',
      '/context', '/compress', '/tools', '/status', '/project',
      '/save', '/load', '/history', '/export', '/theme', '/config',
      '/plan',
    ];
    if (line.startsWith('/')) {
      const hits = commands.filter(c => c.startsWith(line));
      return [hits.length ? hits : commands, line];
    }
    return [[], line];
  }

  /** Start the REPL loop */
  private async startRepl(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      historySize: 500,
      completer: (line: string) => this.completer(line),
    });

    // Handle Ctrl+C
    this.rl.on('SIGINT', () => {
      if (this.inMultiline) {
        this.inMultiline = false;
        this.multilineBuffer = [];
        process.stdout.write('\n' + chalk.hex(getTheme().muted)('  Multi-line cancelled') + '\n');
        this.showPrompt();
        return;
      }
      if (this.processing) {
        this.engine.abort();
        this.processing = false;
        if (this.messageQueue.length > 0) {
          const next = this.messageQueue.shift()!;
          process.stdout.write('\n' + chalk.hex(getTheme().warning)(`  ${ICONS.warning} Skipped → processing queued message`) + '\n');
          this.processInput(next);
        } else {
          process.stdout.write('\n' + chalk.hex(getTheme().warning)(`  ${ICONS.warning} Interrupted`) + '\n');
          this.showPrompt();
        }
        return;
      }
      process.stdout.write('\n' + chalk.hex(getTheme().warning)(`  ${ICONS.warning} Interrupted`) + '\n');
      this.showPrompt();
    });

    this.showPrompt();

    for await (const line of this.rl) {
      const input = line.trim();

      // Multi-line mode
      if (input === '"""' && !this.inMultiline) {
        this.inMultiline = true;
        this.multilineBuffer = [];
        process.stdout.write(chalk.hex(getTheme().muted)('  Entering multi-line mode (type """ to submit):\n'));
        process.stdout.write(chalk.hex(getTheme().border)('  │ '));
        continue;
      }

      if (this.inMultiline) {
        if (input === '"""') {
          this.inMultiline = false;
          const fullInput = this.multilineBuffer.join('\n');
          this.multilineBuffer = [];
          if (fullInput.trim()) {
            try { await this.engine.processMessage(fullInput); } catch (err: any) {
              process.stdout.write(chalk.hex(getTheme().error)(`\n  ${ICONS.error} ${err.message}\n`));
            }
            this.showContextStatus();
          }
          this.showPrompt();
        } else {
          this.multilineBuffer.push(line);
          process.stdout.write(chalk.hex(getTheme().border)('  │ '));
        }
        continue;
      }

      if (!input) {
        this.showPrompt();
        continue;
      }

      // Queue messages if AI is still processing
      if (this.processing) {
        this.messageQueue.push(input);
        process.stdout.write(
          chalk.hex(getTheme().accent)(`\n  ${ICONS.info} Queued: "${input.slice(0, 50)}${input.length > 50 ? '...' : ''}"`) +
          chalk.hex(getTheme().muted)(` (${this.messageQueue.length} in queue — Ctrl+C to skip current)`) + '\n'
        );
        continue;
      }

      await this.processInput(input);
    }
  }

  /** Process a single input (chat message or command) */
  private async processInput(input: string): Promise<void> {
      // Command picker: user typed just "/"
      if (input === '/') {
        this.rl.pause();
        const picker = new CommandPicker(CommandPicker.getNovaCommands());
        const selected = await picker.show();
        this.rl.resume();
        if (selected) {
          if (selected.startsWith('/plan ') || selected === '/plan') {
            process.stdout.write(chalk.hex(getTheme().muted)(`  → ${selected}\n`));
          }
          const result = await this.router.execute(selected);
          if (result.exit) {
            await this.shutdown();
            return;
          }
        }
        this.showPrompt();
        return;
      }

      // Handle commands
      if (this.router.isCommand(input)) {
        if (input.startsWith('/plan ')) {
          await this.handlePlanCommand(input.slice(6));
          this.showPrompt();
          return;
        }

        const result = await this.router.execute(input);
        if (result.exit) {
          await this.shutdown();
          return;
        }
        this.showPrompt();
        return;
      }

      // Process with AI
      this.processing = true;
      try {
        await this.engine.processMessage(input);
      } catch (err: any) {
        process.stdout.write(chalk.hex(getTheme().error)(`\n  ${ICONS.error} ${err.message}\n`));
      }
      this.processing = false;

      this.showContextStatus();

      // Process queued messages
      if (this.messageQueue.length > 0) {
        const next = this.messageQueue.shift()!;
        process.stdout.write(
          chalk.hex(getTheme().accent)(`\n  ${ICONS.lightning} Processing queued: "${next.slice(0, 50)}"`) + '\n'
        );
        await this.processInput(next);
        return;
      }

      this.showPrompt();
  }

  /** Handle /plan command — generates MD planning documents */
  private async handlePlanCommand(goal: string): Promise<void> {
    const theme = getTheme();
    const prevMode = this.engine.getMode();

    // Switch to plan mode temporarily
    this.engine.setMode('plan');

    process.stdout.write(chalk.hex(theme.accent)(`\n  ${ICONS.sparkle} Planning: ${goal}\n`));

    const planPrompt = `Create a detailed implementation plan for the following goal:

**Goal:** ${goal}

**Project Context:**
${this.projectIndex.formatForContext(this.projectIndex.analyze(this.cwd))}

Generate a professional markdown implementation plan with:
1. Problem Analysis
2. Proposed Changes (grouped by component/file)
3. Step-by-step implementation
4. Verification steps

Be specific about file paths, code changes, and commands to run.`;

    const response = await this.engine.processMessage(planPrompt);

    // Save plan to file
    const planFile = `plan-${generateId()}.md`;
    const planPath = join(this.cwd, planFile);
    const header = `# Implementation Plan: ${goal}\n\n> Generated by NOVA on ${new Date().toISOString()}\n> Model: ${this.engine.getModel()}\n\n---\n\n`;
    writeFileSync(planPath, header + response);

    process.stdout.write('\n' + chalk.hex(theme.success)(`  ${ICONS.save} Plan saved: ${planFile}`) + '\n');

    // Restore previous mode
    this.engine.setMode(prevMode);
  }

  /** Show the input prompt — uses readline setPrompt for correct backspace handling */
  private showPrompt(): void {
    const theme = getTheme();
    const mode = this.engine.getMode();
    const modeIcons: Record<string, string> = {
      chat: '💬', fast: '⚡', plan: '📋', code: '💻', agent: '🤖',
    };
    const modeIcon = modeIcons[mode] || '❯';

    // Print a colored status line ABOVE the editable prompt
    process.stdout.write('\n');

    // Set a simple, ANSI-free prompt for readline (so backspace works correctly)
    const plainPrompt = `  ${modeIcon} [${mode}] `;
    this.rl.setPrompt(plainPrompt);
    this.rl.prompt();
  }

  /** Show context usage mini-bar */
  private showContextStatus(): void {
    const theme = getTheme();
    const stats = this.engine.getContext().getStats();
    if (stats.messages > 0) {
      const pct = stats.percentage;
      const color = pct > 80 ? theme.error : pct > 50 ? theme.warning : theme.muted;
      process.stdout.write(
        chalk.hex(color)(`\n  ctx: ${TokenCounter.format(stats.used)}/${TokenCounter.format(stats.budget)} (${pct}%)`)
      );
      if (pct > 75) {
        process.stdout.write(chalk.hex(theme.warning)(` — /compress to save tokens`));
      }
    }
  }

  /** Confirm dialog */
  private confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const theme = getTheme();
      process.stdout.write(chalk.hex(theme.warning)(`\n  ${ICONS.warning} ${message} `) + chalk.hex(theme.muted)('[Y/n] '));
      const handler = (key: Buffer) => {
        const char = key.toString().toLowerCase();
        process.stdin.removeListener('data', handler);
        process.stdin.setRawMode?.(false);
        if (char === 'y' || char === '\r' || char === '\n') {
          process.stdout.write(chalk.hex(theme.success)('Yes\n'));
          resolve(true);
        } else {
          process.stdout.write(chalk.hex(theme.error)('No\n'));
          resolve(false);
        }
      };
      if (process.stdin.isTTY) {
        process.stdin.setRawMode?.(true);
        process.stdin.once('data', handler);
      } else {
        resolve(true);
      }
    });
  }

  /** Graceful shutdown */
  private async shutdown(): Promise<void> {
    this.running = false;
    const theme = getTheme();

    // Auto-save
    const ctx = this.engine.getContext();
    const exported = ctx.export();
    if (exported.length > 1) {
      const id = generateId();
      const title = this.store.generateTitle(exported.find(m => m.role === 'user')?.content || 'Session');
      this.store.save({
        id, title,
        model: this.engine.getModel(),
        mode: this.engine.getMode(),
        messages: exported,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      process.stdout.write(chalk.hex(theme.muted)(`\n  ${ICONS.save} Auto-saved conversation\n`));
    }

    // Stats summary
    const stats = this.engine.getStats();
    if (stats.totalRequests > 0) {
      process.stdout.write(chalk.hex(theme.muted)(
        `  Session: ${stats.totalRequests} requests, ${TokenCounter.format(stats.totalTokensOut)} tokens, ${formatDuration(Date.now() - stats.sessionStart)}\n`
      ));
    }

    process.stdout.write('\n' + gradient('  ✨ Until next time. NOVA signing off.') + '\n\n');
    this.rl?.close();
    process.exit(0);
  }
}
