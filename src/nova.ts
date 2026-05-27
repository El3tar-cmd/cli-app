/**
 * 🚀 NOVA — Main Application Class (Enhanced)
 * Full-featured CLI with auto-model detection, plugins, planning mode, project analysis
 */

import * as readline from 'node:readline'; // kept for completer type reference
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { ConfigManager } from './core/config.js';
import { Engine, type NovaMode } from './core/engine.js';
import { CommandRouter } from './core/router.js';
import { ToolRegistry } from './tools/tool-registry.js';
import { registerBuiltinTools } from './tools/built-in.js';
import { registerBrowserTools } from './tools/browser.js';
import { registerSubagentTools } from './tools/subagent.js';
import { ConversationStore } from './memory/conversation-store.js';
import { ProjectIndex } from './memory/project-index.js';
import { KnowledgeBase } from './memory/knowledge-base.js';
import { NovaMdLoader } from './memory/nova-md.js';
import { NovaAutoConfig } from './memory/nova-auto-config.js';
import { PluginManager } from './plugins/plugin-manager.js';
import { SandboxManager } from './utils/sandbox.js';
import { CommandPicker } from './ui/command-picker.js';
import { colors, gradient, getTheme, setTheme, ICONS, LOGO, renderTagline, horizontalLine, badge, statusDot, box } from './ui/theme.js';
import { TokenCounter } from './utils/token-counter.js';
import { logger } from './utils/logger.js';
import { APP_NAME, APP_VERSION } from './utils/constants.js';
import { sleep, formatDuration, getNovaSubDir, generateId } from './utils/helpers.js';
import { McpClient } from './core/mcp-client.js';
import { InputBar } from './ui/input-bar.js';
import { ProjectMap } from './core/project-map.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  private novaMd: NovaMdLoader;
  private rl!: readline.Interface;
  private cwd: string;
  private running = false;
  private options: NovaOptions;
  private multilineBuffer: string[] = [];
  private inMultiline = false;
  private processing = false;
  private messageQueue: string[] = [];
  private mcpClient: McpClient;
  private stopCurrentSpinner: (() => void) | null = null;
  private inputBar!: InputBar;
  private projectMap!: ProjectMap;

  constructor(options: NovaOptions = {}) {
    this.options = options;
    this.cwd = options.cwd || process.cwd();

    // Initialize subsystems
    this.config = new ConfigManager();
    this.tools = new ToolRegistry();
    registerBuiltinTools(this.tools, this.cwd);
    registerBrowserTools(this.tools, this.cwd);

    // Initialize MCP Client
    this.mcpClient = new McpClient(this.tools, this.cwd);

    // Resolve prompts directory (relative to package root)
    const promptsDir = join(__dirname, '..', 'prompts');

    this.engine = new Engine(this.config, this.tools, promptsDir, this.cwd);
    this.store = new ConversationStore();
    this.router = new CommandRouter(this.engine, this.store, this.config, this.cwd);
    this.projectIndex = new ProjectIndex();
    this.knowledgeBase = new KnowledgeBase();
    this.pluginManager = new PluginManager(this.tools);
    this.novaMd = new NovaMdLoader();

    // Auto-generate or update NOVA.md if it's a project
    const autoConfig = new NovaAutoConfig(this.cwd);
    const { generated } = autoConfig.autoGenerate();
    if (!generated) {
      autoConfig.autoUpdate();
    }

    // Discover NOVA.md
    const novaMdConfig = this.novaMd.discover(this.cwd);
    if (novaMdConfig) {
      this.engine.setExtraSystemPrompt(this.novaMd.formatForPrompt());
      this.novaMd.watch(() => {
        this.engine.setExtraSystemPrompt(this.novaMd.formatForPrompt());
      });
    }

    // Apply options
    if (options.mode) this.engine.setMode(options.mode);

    // Apply saved theme
    const savedTheme = this.config.get('ui').theme;
    if (savedTheme) setTheme(savedTheme);

    // Set up logger
    logger.configure({ logDir: getNovaSubDir('logs') });

    // Set confirm handler
    this.engine.setConfirmHandler(async (msg) => this.confirm(msg));

    // Register Sub-Agent Delegation Tool (Phase 3 of Cognitive Architecture)
    registerSubagentTools(this.tools, this.cwd, this.config, promptsDir, this.engine);

    // Listen to Sub-Agent events for CLI visibility
    this.engine.on('subagent_spawned', (data: { task: string, depth: number, sandbox: boolean }) => {
      const activeTheme = getTheme();
      const sandboxLabel = data.sandbox ? chalk.hex(activeTheme.warning)(' [SANDBOXED]') : '';
      process.stdout.write(
        '\n' + chalk.hex(activeTheme.primary).bold(`🤖 ${ICONS.nova} Sub-Agent Spawned (Level ${data.depth})${sandboxLabel}:`) + '\n' +
        chalk.hex(activeTheme.textDim)(`   Task: "${data.task}"`) + '\n'
      );
    });

    this.engine.on('subagent_completed', (data: { task: string, success: boolean, changes: number }) => {
      const activeTheme = getTheme();
      const statusIcon = data.success ? chalk.hex(activeTheme.success)('✅') : chalk.hex(activeTheme.error)('❌');
      const statusText = data.success ? 'Completed' : 'Failed';
      process.stdout.write(
        '\n' + statusIcon + ' ' + chalk.hex(activeTheme.primary).bold(`Sub-Agent ${statusText}:`) + '\n' +
        chalk.hex(activeTheme.textDim)(`   Task: "${data.task}"`) + '\n' +
        chalk.hex(activeTheme.textDim)(`   Changes: ${data.changes} files`) + '\n'
      );
    });
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

    // Load MCP dynamic tools
    await this.mcpClient.init();

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

    // Initialize Project Mental Map (async — doesn't block startup)
    this.projectMap = new ProjectMap(this.cwd);
    this.projectMap.init().then(() => {
      const snapshot = this.projectMap.snapshot();
      if (snapshot) {
        this.engine.getContext().addMessage({ role: 'system', content: `[Project Mental Map]\n${snapshot}` }, true);
      }
      process.stdout.write(
        chalk.hex(getTheme().success)(`  📊 Project map ready`) +
        chalk.hex(getTheme().muted)(` — auto-updating on file changes`) + '\n'
      );
      // Refresh status after async project map resolves
      this.showPrompt();
    }).catch(() => {});

    // Show session info
    this.printSessionInfo();

    // One-shot mode
    if (this.options.oneShot) {
      await this.engine.processMessage(this.options.oneShot);
      this.mcpClient.cleanup();
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
    const shortCwd = basename(this.cwd) || this.cwd;

    process.stdout.write(
      chalk.hex(theme.muted)('  ') +
      chalk.hex(theme.textDim)('Model: ') + chalk.hex(theme.primary).bold(model) +
      chalk.hex(theme.muted)('  │  ') +
      chalk.hex(theme.textDim)('Mode: ') + badge(mode) +
      chalk.hex(theme.muted)('  │  ') +
      chalk.hex(theme.textDim)('Tools: ') + chalk.hex(theme.text)(String(this.tools.getNames().length)) +
      '\n'
    );
    process.stdout.write(
      chalk.hex(theme.muted)('  📂 ') +
      chalk.hex(theme.accent)(this.cwd) + '\n'
    );
    process.stdout.write(chalk.hex(theme.muted)(`  /help for commands • /quit to exit • """ for multi-line\n`));
    process.stdout.write(chalk.hex(theme.border)(horizontalLine('─', 60)) + '\n');
  }

  /** Refresh status bar after state changes */
  private refreshStatusBar(): void {
    const theme = getTheme();
    const model = this.engine.getModel();
    const mode = this.engine.getMode();
    process.stdout.write(
      chalk.hex(theme.muted)('  ') +
      chalk.hex(theme.textDim)('Model: ') + chalk.hex(theme.primary).bold(model) +
      chalk.hex(theme.muted)('  │  ') +
      chalk.hex(theme.textDim)('Mode: ') + badge(mode) +
      chalk.hex(theme.muted)('  │  ') +
      chalk.hex(theme.accent)(basename(this.cwd)) +
      '\n'
    );
  }

  /** Build tab-completion for commands */
  private completer(line: string): [string[], string] {
    const commands = [
      '/help', '/quit', '/clear', '/model', '/models', '/mode',
      '/chat', '/fast', '/code', '/agent',
      '/context', '/compress', '/tools', '/status', '/project',
      '/save', '/load', '/history', '/export', '/theme', '/config',
      '/plan', '/map',
    ];
    if (line.startsWith('/')) {
      const hits = commands.filter(c => c.startsWith(line));
      return [hits.length ? hits : commands, line];
    }
    return [[], line];
  }

  /** Start the REPL loop — powered by InputBar (fixed bottom input line) */
  private async startRepl(): Promise<void> {
    // ── Initialise the bottom input bar ─────────────────────────────
    this.inputBar = new InputBar();
    this.inputBar.start();

    // Wire InputBar to router so /clear can suspend/resume properly
    this.router.setInputBar(this.inputBar);

    // Handle tab events for autocomplete and debug spans
    this.inputBar.on('tab', (buf: string) => {
      // If buffer is empty, show the latest debug spans
      if (!buf) {
        const spans = (globalThis as any).novaSpans || [];
        if (spans.length === 0) {
          process.stdout.write('\n' + chalk.hex(getTheme().muted)('  No debug spans recorded yet.') + '\n');
          this.showPrompt();
          return;
        }
        process.stdout.write('\n' + chalk.hex(getTheme().accent).bold('  🔍 Latest Telemetry Spans:') + '\n');
        const lastSpans = spans.slice(-3); // show last 3 spans
        for (const span of lastSpans) {
          process.stdout.write(chalk.hex(getTheme().muted)(JSON.stringify({
            name: span.name,
            duration: `${(span.duration[0] * 1000 + span.duration[1] / 1000000).toFixed(2)}ms`,
            attributes: span.attributes,
            status: span.status,
          }, null, 2)) + '\n');
        }
        this.showPrompt();
        return;
      }

      // Command autocomplete
      const [hits, line] = this.completer(buf);
      if (hits && hits.length > 0) {
        if (hits.length === 1) {
          this.inputBar.setBuffer(hits[0]);
        } else {
          // Print multiple matches
          process.stdout.write('\n' + chalk.hex(getTheme().muted)('  ' + hits.join('  ')) + '\n');
          this.showPrompt();
        }
      }
    });

    this.showPrompt();   // sets initial status

    // ── Ctrl+C / abort ───────────────────────────────────────────────
    this.inputBar.on('abort', () => {
      const theme = getTheme();
      this.engine.abort();
      this.processing = false;
      if (this.messageQueue.length > 0) {
        const next = this.messageQueue.shift()!;
        process.stdout.write(chalk.hex(theme.warning)(`\n  ${ICONS.warning} Interrupted → processing queued message\n`));
        this.processInput(next);
      } else {
        process.stdout.write(chalk.hex(theme.warning)(`\n  ${ICONS.warning} Aborted\n`));
        this.inputBar.stopProcessing();
        this.showPrompt();
      }
    });

    this.inputBar.on('sigint', () => {
      if (this.inMultiline) {
        this.inMultiline = false;
        this.multilineBuffer = [];
        process.stdout.write('\n' + chalk.hex(getTheme().muted)('  Multi-line cancelled') + '\n');
        this.showPrompt();
        return;
      }
      process.stdout.write('\n' + chalk.hex(getTheme().warning)(`  ${ICONS.warning} Interrupted`) + '\n');
      this.showPrompt();
    });

    this.inputBar.on('eof', () => { this.shutdown(); });

    // ── Main input loop ──────────────────────────────────────────────
    while (this.running) {
      const line  = await this.inputBar.waitForLine();
      const input = line.trim();

      // ── Multi-line mode (type """ to open/close block) ───────────
      if (input === '"""' && !this.inMultiline) {
        this.inMultiline = true;
        this.multilineBuffer = [];
        process.stdout.write(chalk.hex(getTheme().muted)('  Multi-line mode — type """ to submit\n'));
        this.showPrompt();
        continue;
      }

      if (this.inMultiline) {
        if (input === '"""') {
          this.inMultiline = false;
          const fullInput = this.multilineBuffer.join('\n');
          this.multilineBuffer = [];
          if (fullInput.trim()) await this.processInput(fullInput);
        } else {
          this.multilineBuffer.push(line);
          process.stdout.write(chalk.hex(getTheme().border)('  │ '));
        }
        continue;
      }

      if (!input) { this.showPrompt(); continue; }

      // ── Queue if AI is still processing ──────────────────────────
      if (this.processing) {
        this.messageQueue.push(input);
        process.stdout.write(
          chalk.hex(getTheme().accent)(`  ${ICONS.info} Queued [${this.messageQueue.length}]: "${input.slice(0, 45)}${input.length > 45 ? '…' : ''}"\n`) +
          chalk.hex(getTheme().muted)(`  Ctrl+C to abort current task\n`)
        );
        continue;
      }

      await this.processInput(input);
    }
  }

  /** Process a single input (chat message or command) */
  private async processInput(input: string): Promise<void> {
      const theme = getTheme();
      if (input !== '/') {
        const r = process.stdout.rows || 24;
        // Move cursor to the last row of the scroll region AND print the input in a single atomic write.
        // This prevents _interceptWrite's _drawBar() from prematurely forcing the cursor back to the bottom row between writes.
        process.stdout.write(`\x1b[${r - 1};1H${chalk.hex(theme.secondary).bold('  ' + ICONS.user + '  ')}${chalk.hex(theme.text)(input)}\n\n`);
      }

      // Command picker: user typed just "/"
      if (input === '/') {
        this.inputBar.suspend();
        const picker = new CommandPicker(CommandPicker.getNovaCommands());
        const selected = await picker.show();
        this.inputBar.resume();
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

      // /map — show or rescan project mental map
      if (input === '/map' || input === '/map rescan') {
        const theme = getTheme();
        if (input === '/map rescan') {
          process.stdout.write(chalk.hex(theme.info)('  📊 Re-scanning project...\n'));
          await this.projectMap.scan();
        }
        const snap = this.projectMap.snapshot();
        process.stdout.write('\n' + chalk.hex(theme.primary).bold('  📊 Project Mental Map') + '\n\n');
        for (const line of snap.split('\n')) {
          process.stdout.write(chalk.hex(theme.textDim)('  ' + line) + '\n');
        }
        process.stdout.write('\n' + chalk.hex(theme.muted)('  Tip: /map rescan — force full re-scan\n') + '\n');
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
        // Refresh status bar if state changed
        if (input.startsWith('/model ') || input.startsWith('/mode ') ||
            input.startsWith('/theme ') || ['/chat', '/fast', '/code', '/agent'].includes(input)) {
          this.refreshStatusBar();
        }
        this.showPrompt();
        return;
      }

      // Process with AI — InputBar shows spinner in fixed bottom row
      this.processing = true;

      // InputBar takes over: shows spinner, absorbs keystrokes
      this.inputBar.startProcessing();

      // Expose stopSpinner for the confirm handler (called from inside engine)
      this.stopCurrentSpinner = () => this.inputBar.stopSpinner();

      // Watchdog: alert if stuck for 60+ seconds with no tokens
      let lastTokenAt = Date.now();
      const onAnyToken = () => { lastTokenAt = Date.now(); };
      this.engine.on('token', onAnyToken);
      const watchdog = setInterval(() => {
        const silenceMs = Date.now() - lastTokenAt;
        if (silenceMs > 60000) {
          clearInterval(watchdog);
          process.stdout.write(
            chalk.hex(theme.warning)(`  ⚠  No response for ${Math.round(silenceMs/1000)}s — model may be stuck.`) +
            chalk.hex(theme.muted)(` Ctrl+C to abort.\n`)
          );
        }
      }, 5000);

      const startTime = Date.now();
      try {
        await this.engine.processMessage(input);
      } catch (err: any) {
        process.stdout.write(chalk.hex(theme.error)(`\n  ${ICONS.error} ${err.message}\n`));
      } finally {
        clearInterval(watchdog);
        this.engine.off('token', onAnyToken);
        this.stopCurrentSpinner = null;
        this.inputBar.stopProcessing();
      }

      this.processing = false;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`  ${chalk.hex(theme.success)('✔ Done')} ${chalk.hex(theme.muted)(`(${elapsed}s)`)}\n`);

      this.showContextStatus();

      // Process queued messages
      if (this.messageQueue.length > 0) {
        const next = this.messageQueue.shift()!;
        process.stdout.write(chalk.hex(theme.accent)(`  ${ICONS.lightning} Queued next: "${next.slice(0, 50)}"\n`));
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

  /** Update the InputBar status line with current mode / ctx info */
  private showPrompt(): void {
    const mode  = this.engine.getMode();
    const model = this.engine.getModel().split(':')[0]; // short model name
    const stats = this.engine.getContext().getStats();
    const pct   = stats.percentage;
    const theme = getTheme();

    const modeIcons: Record<string, string> = {
      chat: '💬', fast: '⚡', plan: '📋', code: '💻', agent: '🤖',
    };
    const modeLabel = `${modeIcons[mode] || '❯'} ${mode}`;
    const ctxColor  = pct > 75 ? theme.error : pct > 45 ? theme.warning : theme.muted;
    const ctxLabel  = chalk.hex(ctxColor)(`ctx ${pct}%`);
    const modelLabel = chalk.hex(theme.accent)(model);
    const dirLabel   = chalk.hex(theme.muted)(basename(this.cwd) || '.');

    this.inputBar?.setStatus(`${modelLabel}  ${modeLabel}  ${ctxLabel}  ${dirLabel}`);
  }



  /** Update context status in InputBar status line */
  private showContextStatus(): void {
    const theme = getTheme();
    const stats = this.engine.getContext().getStats();
    if (stats.messages > 0) {
      const pct   = stats.percentage;
      const color = pct > 80 ? theme.error : pct > 50 ? theme.warning : theme.success;
      process.stdout.write(
        chalk.hex(color)(`  ctx ${TokenCounter.format(stats.used)}/${TokenCounter.format(stats.budget)} (${pct}%)`) +
        (pct > 75 ? chalk.hex(theme.warning)('  — try /compress') : '') +
        '\n'
      );
    }
    this.showPrompt(); // refresh status bar
  }

  /** Confirm dialog — delegates to InputBar bottom-row confirm widget */
  private async confirm(message: string): Promise<boolean> {
    // InputBar shows the confirm prompt in the fixed bottom row
    return this.inputBar.waitForConfirm(
      message.length > 60 ? message.slice(0, 60) + '…' : message
    );
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
    this.inputBar?.stop();
    this.mcpClient.cleanup();
    process.exit(0);
  }
}
