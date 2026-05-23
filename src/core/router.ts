/**
 * 🔀 NOVA Command Router — Handles slash commands
 */

import chalk from 'chalk';
import { writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { colors, gradient, getTheme, box, badge, tag, ICONS, setTheme, getThemeNames, horizontalLine } from '../ui/theme.js';
import { TokenCounter } from '../utils/token-counter.js';
import { formatBytes, formatDuration } from '../utils/helpers.js';
import { TestRunner } from '../tools/test-runner.js';
import { CodeReview } from '../tools/code-review.js';
import { askText, selectChoice } from '../ui/prompter.js';
import { NovaAutoConfig } from '../memory/nova-auto-config.js';
import type { Engine, NovaMode } from './engine.js';
import type { ConversationStore } from '../memory/conversation-store.js';
import type { ConfigManager } from './config.js';

export interface CommandResult {
  handled: boolean;
  output?: string;
  exit?: boolean;
}

export class CommandRouter {
  private engine: Engine;
  private store: ConversationStore;
  private config: ConfigManager;
  private cwd: string;

  constructor(engine: Engine, store: ConversationStore, config: ConfigManager, cwd: string) {
    this.engine = engine;
    this.store = store;
    this.config = config;
    this.cwd = cwd;
  }

  /** Check if input is a command */
  isCommand(input: string): boolean {
    return input.trim().startsWith('/');
  }

  /** Route and execute a command */
  async execute(input: string): Promise<CommandResult> {
    const trimmed = input.trim();
    const parts = trimmed.slice(1).split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const args = parts.slice(1);
    const theme = getTheme();

    switch (cmd) {
      case 'help':
      case 'h':
        return this.cmdHelp();
      case 'quit':
      case 'exit':
      case 'q':
        return { handled: true, exit: true };
      case 'clear':
      case 'cls':
        return this.cmdClear();
      case 'model':
        return await this.cmdModel(args);
      case 'models':
        return await this.cmdModels();
      case 'mode':
        return this.cmdMode(args);
      // Mode shortcuts
      case 'chat':
        return this.cmdMode(['chat']);
      case 'fast':
        return this.cmdMode(['fast']);
      case 'agent':
        return this.cmdMode(['agent']);
      case 'code':
        return this.cmdMode(['code']);
      case 'goal':
      case 'g':
        return await this.cmdGoal(args);
      case 'plan':
        if (args.length === 0) {
          return this.cmdMode(['plan']);
        }
        this.engine.setMode('plan');
        return { handled: false };
      case 'context':
      case 'ctx':
        return this.cmdContext();
      case 'compress':
        return await this.cmdCompress();
      case 'tools':
        return this.cmdTools();
      case 'status':
        return this.cmdStatus();
      case 'save':
        return this.cmdSave(args);
      case 'load':
        return await this.cmdLoad(args);
      case 'history':
        return this.cmdHistory();
      case 'export':
        return this.cmdExport(args);
      case 'config':
        return this.cmdConfig(args);
      case 'theme':
        return this.cmdTheme(args);
      case 'project':
        return await this.cmdProject();
      case 'test':
        return await this.cmdTest(args);
      case 'review':
        return await this.cmdReview(args);
      case 'security':
        return await this.cmdSecurity(args);
      case 'init':
        return await this.cmdInit();
      case 'edit':
      case 'e':
        return await this.cmdEdit();
      default:
        process.stdout.write(chalk.hex(theme.error)(`  ${ICONS.error} Unknown command: /${cmd}\n`));
        process.stdout.write(chalk.hex(theme.muted)(`  Type /help for available commands\n`));
        return { handled: true };
    }
  }

  private cmdHelp(): CommandResult {
    const t = getTheme();
    const sections = [
      { title: 'Navigation', cmds: [
        ['/help, /h', 'Show this help'],
        ['/quit, /q', 'Exit NOVA'],
        ['/clear', 'Clear conversation'],
      ]},
      { title: 'AI Control', cmds: [
        ['/model <name>', 'Switch Ollama model'],
        ['/models', 'List available models'],
        ['/mode <mode>', 'Switch mode'],
        ['/chat /fast /code /agent', 'Mode shortcuts'],
        ['/goal [objective]', 'Start or view professional goal tracker'],
        ['/plan <goal>', 'Generate implementation plan (MD)'],
      ]},
      { title: 'Memory', cmds: [
        ['/context', 'View context usage'],
        ['/compress', 'Compress context to save tokens'],
        ['/save [name]', 'Save conversation'],
        ['/load <id>', 'Load conversation'],
        ['/history', 'List saved conversations'],
        ['/export [md|json]', 'Export conversation'],
      ]},
      { title: 'System', cmds: [
        ['/tools', 'List available tools'],
        ['/status', 'System status dashboard'],
        ['/project', 'Analyze current project'],
        ['/init', 'Create NOVA.md config for this project'],
        ['/edit, /e', 'Open editor for long/Arabic text input'],
        ['/config <key> [value]', 'View/set configuration'],
        ['/theme <name>', 'Switch theme'],
      ]},
    ];

    process.stdout.write('\n');
    process.stdout.write(gradient('  ━━━ NOVA Commands ━━━') + '\n\n');

    for (const section of sections) {
      process.stdout.write(chalk.hex(t.accent).bold(`  ${section.title}\n`));
      for (const [cmd, desc] of section.cmds) {
        process.stdout.write(
          chalk.hex(t.primary)(`    ${cmd.padEnd(24)}`) +
          chalk.hex(t.textDim)(desc) + '\n'
        );
      }
      process.stdout.write('\n');
    }

    return { handled: true };
  }

  private cmdClear(): CommandResult {
    this.engine.getContext().clear();
    console.clear();
    process.stdout.write(chalk.hex(getTheme().success)(`  ${ICONS.success} Conversation cleared\n`));
    return { handled: true };
  }

  private async cmdModel(args: string[]): Promise<CommandResult> {
    const t = getTheme();
    if (args.length === 0) {
      process.stdout.write(chalk.hex(t.primary)(`  Current model: `) + chalk.hex(t.text).bold(this.engine.getModel()) + '\n');
      return { handled: true };
    }
    this.engine.setModel(args[0]);
    process.stdout.write(chalk.hex(t.success)(`  ${ICONS.success} Model switched to: `) + chalk.hex(t.text).bold(args[0]) + '\n');
    return { handled: true };
  }

  private async cmdModels(): Promise<CommandResult> {
    const t = getTheme();
    process.stdout.write(chalk.hex(t.muted)(`  Loading models...`) + '\n');
    const models = await this.engine.listModels();
    if (models.length === 0) {
      process.stdout.write(chalk.hex(t.warning)(`  ${ICONS.warning} No models found. Is Ollama running?\n`));
      return { handled: true };
    }

    process.stdout.write('\n' + gradient('  ━━━ Available Models ━━━') + '\n\n');
    const current = this.engine.getModel();
    for (const m of models) {
      const isCurrent = m.name === current;
      const marker = isCurrent ? chalk.hex(t.success)(' ● ') : '   ';
      const size = formatBytes(m.size);
      const details = m.details ? chalk.hex(t.muted)(` (${m.details.parameter_size}, ${m.details.quantization_level})`) : '';
      process.stdout.write(marker + chalk.hex(isCurrent ? t.primary : t.text).bold(m.name.padEnd(30)) + chalk.hex(t.textDim)(size) + details + '\n');
    }
    process.stdout.write('\n');
    return { handled: true };
  }

  private cmdMode(args: string[]): CommandResult {
    const t = getTheme();
    const validModes: NovaMode[] = ['chat', 'fast', 'plan', 'code', 'agent'];
    if (args.length === 0) {
      process.stdout.write(chalk.hex(t.primary)(`  Current mode: `) + badge(this.engine.getMode()) + '\n');
      process.stdout.write(chalk.hex(t.muted)(`  Available: ${validModes.join(', ')}\n`));
      return { handled: true };
    }
    const mode = args[0] as NovaMode;
    if (!validModes.includes(mode)) {
      process.stdout.write(chalk.hex(t.error)(`  ${ICONS.error} Invalid mode. Choose: ${validModes.join(', ')}\n`));
      return { handled: true };
    }
    this.engine.setMode(mode);
    process.stdout.write(chalk.hex(t.success)(`  ${ICONS.success} Mode: `) + badge(mode) + '\n');
    return { handled: true };
  }

  private cmdContext(): CommandResult {
    const t = getTheme();
    const stats = this.engine.getContext().getStats();
    const bar = TokenCounter.progressBar(stats.used, stats.budget, 30);

    process.stdout.write('\n' + gradient('  ━━━ Context Window ━━━') + '\n\n');
    process.stdout.write(chalk.hex(t.text)(`  Messages:   ${stats.messages}\n`));
    process.stdout.write(chalk.hex(t.text)(`  Tokens:     ${TokenCounter.format(stats.used)} / ${TokenCounter.format(stats.budget)}\n`));
    process.stdout.write(chalk.hex(t.text)(`  Usage:      `) + chalk.hex(stats.percentage > 80 ? t.error : stats.percentage > 50 ? t.warning : t.success)(bar) + '\n\n');
    return { handled: true };
  }

  private async cmdCompress(): Promise<CommandResult> {
    const t = getTheme();
    process.stdout.write(chalk.hex(t.muted)(`  ${ICONS.brain} Compressing context...`) + '\n');
    const saved = await this.engine.compressContext();
    if (saved > 0) {
      process.stdout.write(chalk.hex(t.success)(`  ${ICONS.success} Saved ${TokenCounter.format(saved)} tokens\n`));
    } else {
      process.stdout.write(chalk.hex(t.muted)(`  ${ICONS.info} Nothing to compress\n`));
    }
    return { handled: true };
  }

  private cmdTools(): CommandResult {
    const t = getTheme();
    process.stdout.write('\n' + gradient('  ━━━ Available Tools ━━━') + '\n\n');

    // Get tools from actual registry via engine
    const allTools = this.engine.getTools().getAll();
    if (allTools.length > 0) {
      for (const tool of allTools) {
        process.stdout.write(
          chalk.hex(t.accent)(`  ${ICONS.arrowRight} `) +
          chalk.hex(t.primary)(tool.name.padEnd(22)) +
          chalk.hex(t.muted)(`[${tool.category}]`.padEnd(10)) +
          chalk.hex(t.textDim)(tool.description) + '\n'
        );
      }
    } else {
      // Fallback
      const tools = [
        { name: 'file_read', cat: 'file', desc: 'Read file contents' },
        { name: 'file_write', cat: 'file', desc: 'Create/write files' },
        { name: 'file_edit', cat: 'file', desc: 'Edit file content' },
        { name: 'command_run', cat: 'command', desc: 'Execute commands' },
        { name: 'code_search', cat: 'search', desc: 'Search code patterns' },
        { name: 'list_directory', cat: 'file', desc: 'List directories' },
        { name: 'git_status', cat: 'git', desc: 'Git operations' },
        { name: 'web_fetch', cat: 'web', desc: 'Fetch URL content' },
        { name: 'project_analyze', cat: 'system', desc: 'Project analysis' },
      ];
      for (const tool of tools) {
        process.stdout.write(
          chalk.hex(t.accent)(`  ${ICONS.arrowRight} `) +
          chalk.hex(t.primary)(tool.name.padEnd(22)) +
          chalk.hex(t.muted)(`[${tool.cat}]`.padEnd(10)) +
          chalk.hex(t.textDim)(tool.desc) + '\n'
        );
      }
    }
    process.stdout.write('\n');
    return { handled: true };
  }

  private cmdStatus(): CommandResult {
    const t = getTheme();
    const stats = this.engine.getStats();
    const ctx = this.engine.getContext().getStats();
    const uptime = formatDuration(Date.now() - stats.sessionStart);

    process.stdout.write('\n' + gradient('  ━━━ NOVA Status Dashboard ━━━') + '\n\n');
    process.stdout.write(chalk.hex(t.accent).bold('  Session\n'));
    process.stdout.write(tag('    Uptime:     ', uptime) + '\n');
    process.stdout.write(tag('    Model:      ', this.engine.getModel()) + '\n');
    process.stdout.write(tag('    Mode:       ', this.engine.getMode()) + '\n');
    process.stdout.write(tag('    Requests:   ', String(stats.totalRequests)) + '\n');
    process.stdout.write(tag('    Tool Calls: ', String(stats.totalToolCalls)) + '\n\n');
    process.stdout.write(chalk.hex(t.accent).bold('  Tokens\n'));
    process.stdout.write(tag('    Input:      ', TokenCounter.format(stats.totalTokensIn)) + '\n');
    process.stdout.write(tag('    Output:     ', TokenCounter.format(stats.totalTokensOut)) + '\n');
    process.stdout.write(tag('    Context:    ', `${TokenCounter.format(ctx.used)}/${TokenCounter.format(ctx.budget)} (${ctx.percentage}%)`) + '\n\n');
    return { handled: true };
  }

  private cmdSave(args: string[]): CommandResult {
    const t = getTheme();
    const ctx = this.engine.getContext();
    const exported = ctx.export();
    if (exported.length === 0) {
      process.stdout.write(chalk.hex(t.warning)(`  ${ICONS.warning} Nothing to save\n`));
      return { handled: true };
    }
    const id = Date.now().toString(36);
    const title = args.join(' ') || this.store.generateTitle(exported[0]?.content || 'Untitled');
    this.store.save({ id, title, model: this.engine.getModel(), mode: this.engine.getMode(), messages: exported, createdAt: Date.now(), updatedAt: Date.now() });
    process.stdout.write(chalk.hex(t.success)(`  ${ICONS.save} Saved: ${title} (${id})\n`));
    return { handled: true };
  }

  private async cmdLoad(args: string[]): Promise<CommandResult> {
    const t = getTheme();
    if (args.length === 0) {
      process.stdout.write(chalk.hex(t.error)(`  ${ICONS.error} Usage: /load <id>\n`));
      return { handled: true };
    }
    const conv = this.store.load(args[0]);
    if (!conv) {
      process.stdout.write(chalk.hex(t.error)(`  ${ICONS.error} Conversation not found\n`));
      return { handled: true };
    }
    this.engine.getContext().import(conv.messages);
    process.stdout.write(chalk.hex(t.success)(`  ${ICONS.success} Loaded: ${conv.title} (${conv.messages.length} messages)\n`));
    return { handled: true };
  }

  private cmdHistory(): CommandResult {
    const t = getTheme();
    const convs = this.store.list();
    if (convs.length === 0) {
      process.stdout.write(chalk.hex(t.muted)(`  No saved conversations\n`));
      return { handled: true };
    }
    process.stdout.write('\n' + gradient('  ━━━ Conversation History ━━━') + '\n\n');
    for (const c of convs.slice(0, 20)) {
      const date = new Date(c.updatedAt).toLocaleDateString();
      process.stdout.write(
        chalk.hex(t.primary)(` ${c.id.padEnd(12)}`) +
        chalk.hex(t.text)(c.title.slice(0, 40).padEnd(42)) +
        chalk.hex(t.muted)(`${c.messages.length} msgs  ${date}`) + '\n'
      );
    }
    process.stdout.write('\n');
    return { handled: true };
  }

  private cmdExport(args: string[]): CommandResult {
    const t = getTheme();
    const format = args[0] || 'md';
    const exported = this.engine.getContext().export();
    const filename = `nova-export-${Date.now()}.${format === 'json' ? 'json' : 'md'}`;
    const filePath = join(this.cwd, filename);

    if (format === 'json') {
      writeFileSync(filePath, JSON.stringify(exported, null, 2));
    } else {
      const md = exported.map(m => `## ${m.role.toUpperCase()}\n\n${m.content}\n`).join('\n---\n\n');
      writeFileSync(filePath, `# NOVA Conversation Export\n\n${md}`);
    }
    process.stdout.write(chalk.hex(t.success)(`  ${ICONS.success} Exported to ${filename}\n`));
    return { handled: true };
  }

  private cmdConfig(args: string[]): CommandResult {
    const t = getTheme();
    if (args.length === 0) {
      const cfg = this.config.getAll();
      process.stdout.write('\n' + gradient('  ━━━ Configuration ━━━') + '\n\n');
      process.stdout.write(chalk.hex(t.textDim)(JSON.stringify(cfg, null, 2).split('\n').map(l => '  ' + l).join('\n')) + '\n\n');
      return { handled: true };
    }
    if (args.length === 1) {
      const val = this.config.getField(args[0]);
      process.stdout.write(chalk.hex(t.primary)(`  ${args[0]}: `) + chalk.hex(t.text)(JSON.stringify(val)) + '\n');
    } else {
      let val: any = args.slice(1).join(' ');
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (!isNaN(Number(val))) val = Number(val);
      this.config.setField(args[0], val);
      process.stdout.write(chalk.hex(t.success)(`  ${ICONS.success} ${args[0]} = ${JSON.stringify(val)}\n`));
    }
    return { handled: true };
  }

  private cmdTheme(args: string[]): CommandResult {
    const t = getTheme();
    if (args.length === 0) {
      process.stdout.write(chalk.hex(t.primary)(`  Current: ${t.name}\n`));
      process.stdout.write(chalk.hex(t.muted)(`  Available: ${getThemeNames().join(', ')}\n`));
      return { handled: true };
    }
    setTheme(args[0]);
    this.config.set('ui', { theme: args[0] });
    const nt = getTheme();
    process.stdout.write(chalk.hex(nt.success)(`  ${ICONS.success} Theme: `) + gradient(nt.name) + '\n');
    return { handled: true };
  }

  private async cmdProject(): Promise<CommandResult> {
    const t = getTheme();
    process.stdout.write(chalk.hex(t.muted)(`  ${ICONS.search} Analyzing project...`) + '\n');
    const tools = this.engine.getTools();
    if (tools.has('project_analyze')) {
      const result = await tools.execute('project_analyze', { path: this.cwd });
      if (result.success) {
        process.stdout.write('\n' + result.output.split('\n').map((l: string) => '  ' + l).join('\n') + '\n\n');
      }
    }
    return { handled: true };
  }

  /** /test — Run tests with auto-detection */
  private async cmdTest(args: string[]): Promise<CommandResult> {
    const t = getTheme();
    const runner = new TestRunner(this.cwd);
    const fw = runner.getFramework();

    if (!fw && args.length === 0) {
      process.stdout.write(chalk.hex(t.warning)(`  ${ICONS.warning} No test framework detected\n`));
      process.stdout.write(chalk.hex(t.muted)(`  Usage: /test [custom command]\n`));
      return { handled: true };
    }

    const customCmd = args.length > 0 ? args.join(' ') : undefined;
    process.stdout.write(chalk.hex(t.accent)(`  🧪 Running tests`) +
      chalk.hex(t.muted)(` (${customCmd || fw?.name || 'custom'})...`) + '\n\n');

    const result = runner.run(customCmd);

    if (result.passed) {
      process.stdout.write(chalk.hex(t.success).bold(`  ✅ ${result.summary}`) +
        chalk.hex(t.muted)(` (${result.duration}ms)`) + '\n');
    } else {
      process.stdout.write(chalk.hex(t.error).bold(`  ❌ ${result.summary}`) +
        chalk.hex(t.muted)(` (${result.duration}ms)`) + '\n');
      // Show last 20 lines of output
      const lines = result.output.trim().split('\n').slice(-20);
      process.stdout.write(chalk.hex(t.border)('\n  ┌─ Test Output ─────────\n'));
      for (const line of lines) {
        process.stdout.write(chalk.hex(t.border)('  │ ') + chalk.hex(t.textDim)(line) + '\n');
      }
      process.stdout.write(chalk.hex(t.border)('  └────────────────────\n'));
      process.stdout.write(chalk.hex(t.muted)(`\n  💡 Use Agent mode to auto-fix: /agent then ask to fix tests\n`));
    }
    return { handled: true };
  }

  /** /review — AI code review */
  private async cmdReview(args: string[]): Promise<CommandResult> {
    const t = getTheme();

    if (args.length === 0) {
      // Review git diff
      try {
        const diff = execSync('git diff --staged', { cwd: this.cwd, encoding: 'utf-8' });
        if (!diff.trim()) {
          const unstaged = execSync('git diff', { cwd: this.cwd, encoding: 'utf-8' });
          if (!unstaged.trim()) {
            process.stdout.write(chalk.hex(t.muted)(`  No changes to review. Stage files or specify: /review <file>\n`));
            return { handled: true };
          }
          process.stdout.write(chalk.hex(t.accent)(`  🔍 Reviewing unstaged changes...\n\n`));
          const prompt = CodeReview.buildPrompt({ diffMode: true, diffContent: unstaged });
          await this.engine.processMessage(prompt);
          return { handled: true };
        }
        process.stdout.write(chalk.hex(t.accent)(`  🔍 Reviewing staged changes...\n\n`));
        const prompt = CodeReview.buildPrompt({ diffMode: true, diffContent: diff });
        await this.engine.processMessage(prompt);
      } catch {
        process.stdout.write(chalk.hex(t.warning)(`  ${ICONS.warning} Git not available. Specify a file: /review <file>\n`));
      }
      return { handled: true };
    }

    // Review specific file
    const filePath = join(this.cwd, args[0]);
    if (!existsSync(filePath)) {
      process.stdout.write(chalk.hex(t.error)(`  ${ICONS.error} File not found: ${args[0]}\n`));
      return { handled: true };
    }

    process.stdout.write(chalk.hex(t.accent)(`  🔍 Reviewing ${args[0]}...\n\n`));
    const content = readFileSync(filePath, 'utf-8');
    const prompt = CodeReview.buildPrompt({ filePath: args[0], content });
    await this.engine.processMessage(prompt);
    return { handled: true };
  }

  /** /security — Security scan */
  private async cmdSecurity(args: string[]): Promise<CommandResult> {
    const t = getTheme();

    if (args.length === 0) {
      process.stdout.write(chalk.hex(t.muted)(`  Usage: /security <file>\n`));
      process.stdout.write(chalk.hex(t.muted)(`  Example: /security src/auth/login.ts\n`));
      return { handled: true };
    }

    const filePath = join(this.cwd, args[0]);
    if (!existsSync(filePath)) {
      process.stdout.write(chalk.hex(t.error)(`  ${ICONS.error} File not found: ${args[0]}\n`));
      return { handled: true };
    }

    process.stdout.write(chalk.hex(t.accent)(`  🔒 Security scanning ${args[0]}...\n\n`));
    const content = readFileSync(filePath, 'utf-8');
    const prompt = CodeReview.buildSecurityPrompt(content, args[0]);
    await this.engine.processMessage(prompt);
    return { handled: true };
  }
  private async cmdInit(): Promise<CommandResult> {
    const t = getTheme();
    
    process.stdout.write('\n' + gradient('  ━━━ NOVA Workspace Scaffolding ━━━') + '\n\n');

    // Check if directory is empty (ignoring .git and .nova-state.json)
    let files: string[] = [];
    try {
      files = readdirSync(this.cwd).filter(f => f !== '.git' && f !== '.nova-state.json');
    } catch {}
    const isEmpty = files.length === 0;

    const autoConfig = new NovaAutoConfig(this.cwd);
    let useAuto = 'no';
    let profile: any = null;

    if (!isEmpty && autoConfig.isProject()) {
      profile = autoConfig.scanProject();
      process.stdout.write(chalk.hex(t.primary)(`  ${ICONS.info} Existing project detected: `) + chalk.hex(t.accent).bold(profile.name) + chalk.hex(t.muted)(` (${profile.type}/${profile.language})\n\n`));
      
      useAuto = await selectChoice('Do you want to auto-configure NOVA.md using detected settings?', [
        { name: `Yes, use auto-detected settings (${profile.language}/${profile.framework || 'Vanilla'})`, value: 'yes' },
        { name: 'No, let me customize/scaffold a new stack', value: 'no' }
      ], 0);
    }

    if (useAuto === 'yes' && profile) {
      const novaMdPath = join(this.cwd, 'NOVA.md');
      const mdContent = autoConfig.generateNovaMd(profile);
      writeFileSync(novaMdPath, mdContent, 'utf-8');
      process.stdout.write('\n' + chalk.hex(t.success)(`  ${ICONS.success} Successfully created NOVA.md at ${novaMdPath}\n`));
      return { handled: true };
    }

    // Interactive Scaffolding Flow
    const defaultName = basename(this.cwd) || 'my-nova-project';
    const projectName = await askText('Enter project name', defaultName);

    const projectType = await selectChoice('Select project type', [
      { name: 'Full-stack Web App (Next.js, Astro, Remix, etc.)', value: 'fullstack' },
      { name: 'Frontend Single Page App (React, Vue, Svelte)', value: 'frontend' },
      { name: 'Backend API Service (Express, Fastify, FastAPI, Go, etc.)', value: 'backend' },
      { name: 'Command Line Tool / CLI', value: 'cli-tool' },
      { name: 'Library / Package', value: 'library' }
    ], 0);

    const language = await selectChoice('Select programming language', [
      { name: 'TypeScript (Recommended)', value: 'TypeScript' },
      { name: 'JavaScript', value: 'JavaScript' },
      { name: 'Python', value: 'Python' },
      { name: 'Go', value: 'Go' },
      { name: 'Rust', value: 'Rust' }
    ], 0);

    // Framework
    let framework = 'None';
    if (language === 'TypeScript' || language === 'JavaScript') {
      if (projectType === 'fullstack') {
        framework = await selectChoice('Select fullstack framework', [
          { name: 'Next.js (Recommended)', value: 'Next.js' },
          { name: 'SvelteKit', value: 'SvelteKit' },
          { name: 'Astro', value: 'Astro' },
          { name: 'Remix', value: 'Remix' }
        ], 0);
      } else if (projectType === 'frontend') {
        framework = await selectChoice('Select frontend library', [
          { name: 'React (Vite)', value: 'React' },
          { name: 'Vue (Vite)', value: 'Vue' },
          { name: 'Svelte (Vite)', value: 'Svelte' }
        ], 0);
      } else if (projectType === 'backend') {
        framework = await selectChoice('Select backend framework', [
          { name: 'Express', value: 'Express' },
          { name: 'Fastify', value: 'Fastify' },
          { name: 'NestJS', value: 'NestJS' },
          { name: 'Hono', value: 'Hono' }
        ], 0);
      }
    } else if (language === 'Python') {
      framework = await selectChoice('Select Python framework', [
        { name: 'FastAPI (Recommended)', value: 'FastAPI' },
        { name: 'Flask', value: 'Flask' },
        { name: 'Django', value: 'Django' },
        { name: 'None / Vanilla Python', value: 'None' }
      ], 0);
    } else if (language === 'Go') {
      framework = await selectChoice('Select Go framework', [
        { name: 'Gin', value: 'Gin' },
        { name: 'Fiber', value: 'Fiber' },
        { name: 'None / Standard Library', value: 'None' }
      ], 0);
    }

    // Styling
    let hasTailwind = 'no';
    if (projectType === 'fullstack' || projectType === 'frontend') {
      hasTailwind = await selectChoice('Enable TailwindCSS?', [
        { name: 'Yes (Recommended)', value: 'yes' },
        { name: 'No, use Vanilla CSS/Modules', value: 'no' }
      ], 0);
    }

    // Tests
    const testChoice = await selectChoice('Enable testing framework?', [
      { name: 'Yes, configure standard test suite', value: 'yes' },
      { name: 'No, skip tests', value: 'no' }
    ], 0);
    const hasTests = testChoice === 'yes';

    // Docker
    const dockerChoice = await selectChoice('Enable Docker containerization?', [
      { name: 'Yes, generate Dockerfile & docker-compose', value: 'yes' },
      { name: 'No, skip Docker', value: 'no' }
    ], 0);
    const hasDocker = dockerChoice === 'yes';

    // CI/CD
    const ciChoice = await selectChoice('Enable CI/CD pipeline (GitHub Actions)?', [
      { name: 'Yes, generate GitHub Actions Workflow', value: 'yes' },
      { name: 'No, skip CI/CD', value: 'no' }
    ], 0);
    const hasCI = ciChoice === 'yes';

    process.stdout.write(chalk.hex(t.muted)(`\n  ⚙️  Generating workspace structure...`) + '\n');

    const keyDirs: string[] = [];
    const keyFiles: string[] = [];

    const createDir = (dirName: string) => {
      const p = join(this.cwd, dirName);
      if (!existsSync(p)) {
        mkdirSync(p, { recursive: true });
      }
      keyDirs.push(dirName);
    };

    createDir('src');
    if (hasTests) {
      createDir('tests');
    }
    if (projectType === 'fullstack' || projectType === 'frontend') {
      createDir('public');
    }

    // NodeJS Setup
    if (language === 'TypeScript' || language === 'JavaScript') {
      const isTS = language === 'TypeScript';
      const packageJson: any = {
        name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        version: '0.1.0',
        private: true,
        scripts: {
          dev: isTS ? 'tsc-watch --onSuccess "node dist/index.js"' : 'node src/index.js',
          build: isTS ? 'tsc' : 'echo "No build step"',
          start: isTS ? 'node dist/index.js' : 'node src/index.js',
        },
        dependencies: {},
        devDependencies: {}
      };

      if (isTS) {
        packageJson.devDependencies.typescript = '^5.3.0';
        packageJson.devDependencies['@types/node'] = '^20.10.0';
        packageJson.devDependencies['tsc-watch'] = '^6.0.4';
      }

      if (framework === 'Next.js') {
        packageJson.scripts.dev = 'next dev';
        packageJson.scripts.build = 'next build';
        packageJson.scripts.start = 'next start';
        packageJson.dependencies.next = '^14.1.0';
        packageJson.dependencies.react = '^18.2.0';
        packageJson.dependencies['react-dom'] = '^18.2.0';
        if (isTS) {
          packageJson.devDependencies['@types/react'] = '^18.2.0';
          packageJson.devDependencies['@types/react-dom'] = '^18.2.0';
        }
      } else if (framework === 'React') {
        packageJson.scripts.dev = 'vite';
        packageJson.scripts.build = 'tsc && vite build';
        packageJson.scripts.preview = 'vite preview';
        packageJson.dependencies.react = '^18.2.0';
        packageJson.dependencies['react-dom'] = '^18.2.0';
        packageJson.devDependencies.vite = '^5.1.0';
        packageJson.devDependencies['@vitejs/plugin-react'] = '^4.2.1';
      } else if (framework === 'Express') {
        packageJson.dependencies.express = '^4.18.2';
        if (isTS) {
          packageJson.devDependencies['@types/express'] = '^4.17.21';
        }
      } else if (framework === 'Fastify') {
        packageJson.dependencies.fastify = '^4.26.1';
      } else if (framework === 'Hono') {
        packageJson.dependencies.hono = '^4.0.7';
      } else if (framework === 'NestJS') {
        packageJson.dependencies['@nestjs/core'] = '^10.3.3';
        packageJson.dependencies['@nestjs/common'] = '^10.3.3';
      }

      if (hasTests) {
        packageJson.scripts.test = 'vitest run';
        packageJson.devDependencies.vitest = '^1.3.1';
      }

      writeFileSync(join(this.cwd, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8');
      keyFiles.push('package.json');

      if (isTS) {
        const tsconfig = {
          compilerOptions: {
            target: 'es2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            outDir: './dist',
            rootDir: './src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true
          },
          include: ['src/**/*'],
          exclude: ['node_modules', 'dist']
        };
        writeFileSync(join(this.cwd, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2), 'utf-8');
        keyFiles.push('tsconfig.json');
      }
    } else if (language === 'Python') {
      const reqs = [];
      if (framework === 'FastAPI') {
        reqs.push('fastapi>=0.109.0', 'uvicorn[standard]>=0.27.0');
      } else if (framework === 'Flask') {
        reqs.push('Flask>=3.0.0');
      } else if (framework === 'Django') {
        reqs.push('Django>=5.0.0');
      }
      if (hasTests) {
        reqs.push('pytest>=8.0.0');
      }
      writeFileSync(join(this.cwd, 'requirements.txt'), reqs.join('\n') + '\n', 'utf-8');
      keyFiles.push('requirements.txt');
    } else if (language === 'Go') {
      const moduleName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      let goMod = `module ${moduleName}\n\ngo 1.21\n`;
      if (framework === 'Gin') {
        goMod += `\nrequire github.com/gin-gonic/gin v1.9.1\n`;
      } else if (framework === 'Fiber') {
        goMod += `\nrequire github.com/gofiber/fiber/v2 v2.52.0\n`;
      }
      writeFileSync(join(this.cwd, 'go.mod'), goMod, 'utf-8');
      keyFiles.push('go.mod');
    }

    // Entry points
    if (language === 'TypeScript' || language === 'JavaScript') {
      const ext = language === 'TypeScript' ? 'ts' : 'js';
      let entryContent = `// 🚀 Welcome to ${projectName}!\n\n`;
      if (framework === 'Express') {
        entryContent += `import express from 'express';\nconst app = express();\nconst port = process.env.PORT || 3000;\n\napp.get('/', (req, res) => {\n  res.send('Hello from Express & NOVA!');\n});\n\napp.listen(port, () => {\n  console.log(\`Server is running on port \${port}\`);\n});\n`;
      } else if (framework === 'Fastify') {
        entryContent += `import Fastify from 'fastify';\nconst fastify = Fastify({ logger: true });\n\nfastify.get('/', async (request, reply) => {\n  return { hello: 'from Fastify & NOVA!' };\n});\n\nconst start = async () => {\n  try {\n    await fastify.listen({ port: 3000 });\n  } catch (err) {\n    fastify.log.error(err);\n    process.exit(1);\n  }\n};\nstart();\n`;
      } else if (framework === 'Hono') {
        entryContent += `import { Hono } from 'hono';\nconst app = new Hono();\n\napp.get('/', (c) => c.text('Hello from Hono & NOVA!'));\n\nexport default app;\n`;
      } else {
        entryContent += `console.log('Hello from ${projectName} configured by NOVA!');\n`;
      }
      writeFileSync(join(this.cwd, `src/index.${ext}`), entryContent, 'utf-8');
    } else if (language === 'Python') {
      let entryContent = `# 🚀 Welcome to ${projectName}!\n\n`;
      if (framework === 'FastAPI') {
        entryContent += `from fastapi import FastAPI\n\napp = FastAPI(title="${projectName}")\n\n@app.get("/")\ndef read_root():\n    return {"hello": "from FastAPI & NOVA!"}\n`;
        writeFileSync(join(this.cwd, 'src/main.py'), entryContent, 'utf-8');
      } else if (framework === 'Flask') {
        entryContent += `from flask import Flask\napp = Flask(__name__)\n\n@app.route("/")\ndef hello():\n    return "Hello from Flask & NOVA!"\n\nif __name__ == "__main__":\n    app.run(port=5000)\n`;
        writeFileSync(join(this.cwd, 'src/app.py'), entryContent, 'utf-8');
      } else {
        entryContent += `print("Hello from ${projectName} configured by NOVA!")\n`;
        writeFileSync(join(this.cwd, 'src/main.py'), entryContent, 'utf-8');
      }
    } else if (language === 'Go') {
      let entryContent = `package main\n\nimport (\n\t"fmt"\n`;
      if (framework === 'Gin') {
        entryContent += `\t"github.com/gin-gonic/gin"\n)\n\nfunc main() {\n\tr := gin.Default()\n\tr.GET("/", func(c *gin.Context) {\n\t\tc.JSON(200, gin.H{\n\t\t\t"message": "hello from Gin & NOVA!",\n\t\t\t})\n\t\t})\n\tr.Run()\n}\n`;
      } else if (framework === 'Fiber') {
        entryContent += `\t"github.com/gofiber/fiber/v2"\n)\n\nfunc main() {\n\tapp := fiber.New()\n\tapp.Get("/", func(c *fiber.Ctx) error {\n\t\treturn c.SendString("Hello from Fiber & NOVA!")\n\t})\n\tapp.Listen(":3000")\n}\n`;
      } else {
        entryContent += `)\n\nfunc main() {\n\tfmt.Println("Hello from ${projectName} configured by NOVA!")\n}\n`;
      }
      writeFileSync(join(this.cwd, 'src/main.go'), entryContent, 'utf-8');
    }

    // TailwindCSS
    if (hasTailwind === 'yes') {
      const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;
      writeFileSync(join(this.cwd, 'tailwind.config.js'), tailwindConfig, 'utf-8');
      keyFiles.push('tailwind.config.js');

      const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
      writeFileSync(join(this.cwd, 'postcss.config.js'), postcssConfig, 'utf-8');

      const tailwindCss = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;
      writeFileSync(join(this.cwd, 'src/index.css'), tailwindCss, 'utf-8');
    }

    // Docker
    if (hasDocker) {
      let dockerfile = '';
      if (language === 'TypeScript' || language === 'JavaScript') {
        dockerfile = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
`;
      } else if (language === 'Python') {
        dockerfile = `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
      } else if (language === 'Go') {
        dockerfile = `FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./src

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
`;
      } else {
        dockerfile = `FROM alpine
CMD ["echo", "Custom docker container"]
`;
      }
      writeFileSync(join(this.cwd, 'Dockerfile'), dockerfile, 'utf-8');
      keyFiles.push('Dockerfile');

      const dockerCompose = `version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
`;
      writeFileSync(join(this.cwd, 'docker-compose.yml'), dockerCompose, 'utf-8');
      keyFiles.push('docker-compose.yml');
    }

    // CI/CD
    if (hasCI) {
      mkdirSync(join(this.cwd, '.github/workflows'), { recursive: true });
      let workflow = `name: CI Pipeline

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`;

      if (language === 'TypeScript' || language === 'JavaScript') {
        workflow += `      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Lint and build
        run: |
          npm run build
`;
        if (hasTests) {
          workflow += `      - name: Run tests
        run: npm test
`;
        }
      } else if (language === 'Python') {
        workflow += `      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
`;
        if (hasTests) {
          workflow += `      - name: Run tests
        run: pytest
`;
        }
      } else if (language === 'Go') {
        workflow += `      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      - name: Build
        run: go build -v ./...
`;
        if (hasTests) {
          workflow += `      - name: Test
        run: go test -v ./...
`;
        }
      }

      writeFileSync(join(this.cwd, '.github/workflows/ci.yml'), workflow, 'utf-8');
      keyFiles.push('.github/workflows/ci.yml');
    }

    // NOVA.md
    profile = {
      name: projectName,
      type: projectType,
      framework: framework === 'None' ? null : framework,
      language,
      packageManager: (language === 'TypeScript' || language === 'JavaScript') ? 'npm' : null,
      hasTests,
      testFramework: hasTests ? (language === 'Python' ? 'pytest' : language === 'Go' ? 'testing' : 'Vitest') : null,
      hasDocker,
      hasCI,
      hasTypeScript: language === 'TypeScript',
      entryPoints: language === 'TypeScript' ? ['src/index.ts'] : language === 'JavaScript' ? ['src/index.js'] : language === 'Python' ? ['src/main.py'] : language === 'Go' ? ['src/main.go'] : [],
      srcDir: 'src',
      keyDirs,
      keyFiles,
      dependencies: [],
      devDependencies: [],
      scripts: {},
      gitIgnored: existsSync(join(this.cwd, '.gitignore')),
      fileCount: 0,
      description: `Modern ${projectType} scaffolded interactively by NOVA CLI.`,
    };

    let customNovaMd = autoConfig.generateNovaMd(profile);
    customNovaMd += `\n## Interactive Developer Guidelines
- **Modern Architecture**: Adhere strictly to the structured modular layers inside the \`src/\` folder.
- **Linting & Best Practices**: Maintain clean imports, strong linting compliance, and robust error management.
`;
    writeFileSync(join(this.cwd, 'NOVA.md'), customNovaMd, 'utf-8');

    process.stdout.write('\n' + box(
      `${chalk.hex(t.success).bold('🎉 PROJECT SCAFFOLDED SUCCESSFULLY!')}\n\n` +
      `Project Name: ${chalk.hex(t.primary)(projectName)}\n` +
      `Language:     ${chalk.hex(t.accent)(language)}\n` +
      `Framework:    ${chalk.hex(t.accent)(framework)}\n` +
      `Constitution: ${chalk.hex(t.success)('NOVA.md')} created in your workspace.\n\n` +
      `Get started by editing ${chalk.hex(t.primary)('src/')} files and interacting with NOVA!`,
      {
        title: '⚡ NOVA SCAFFOLDER',
        borderColor: t.success,
        titleColor: t.success,
      }
    ) + '\n\n');

    return { handled: true };
  }

  private async cmdEdit(): Promise<CommandResult> {
    const t = getTheme();
    const tmpDir = join(this.cwd, '.nova-tmp');
    if (!existsSync(tmpDir)) {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(tmpDir, { recursive: true });
    }
    const tmpFile = join(tmpDir, `input-${Date.now()}.md`);

    // Create template file with RTL hint
    writeFileSync(tmpFile, `<!-- اكتب رسالتك هنا - Write your message here -->\n<!-- احفظ الملف واغلقه لإرسال الرسالة - Save and close to send -->\n\n`, 'utf-8');

    process.stdout.write(chalk.hex(t.accent)(`\n  ${ICONS.sparkle} Opening editor...\n`));
    process.stdout.write(chalk.hex(t.muted)(`  Write your message, save the file, then close it.\n`));

    try {
      // Try VS Code first, then fallback to notepad
      try {
        execFileSync(process.platform === 'win32' ? 'code.cmd' : 'code', ['--wait', tmpFile], { stdio: 'inherit' });
      } catch {
        execFileSync('notepad', [tmpFile], { stdio: 'inherit' });
      }

      const content = readFileSync(tmpFile, 'utf-8')
        .replace(/<!--.*?-->/g, '') // Remove HTML comments
        .trim();

      // Clean up
      try { const { unlinkSync } = await import('node:fs'); unlinkSync(tmpFile); } catch {}

      if (!content) {
        process.stdout.write(chalk.hex(t.muted)(`  ${ICONS.info} Empty message — cancelled\n`));
        return { handled: true };
      }

      process.stdout.write(chalk.hex(t.success)(`  ${ICONS.success} Message received (${content.length} chars)\n`));

      // Process the message through the engine
      await this.engine.processMessage(content);
      return { handled: true };
    } catch (err: any) {
      process.stdout.write(chalk.hex(t.error)(`  ${ICONS.error} Editor failed: ${err.message}\n`));
      return { handled: true };
    }
  }

  private async cmdGoal(args: string[]): Promise<CommandResult> {
    const t = getTheme();
    const scratchpad = this.engine.getScratchpad();

    // If args are provided, start/update a new goal
    if (args.length > 0) {
      const goalStr = args.join(' ');
      
      // Reset scratchpad state
      scratchpad.reset();
      
      // Initialize with new goal
      scratchpad.update({
        goal: goalStr,
        phase: 'planning',
        currentTask: 'Analyzing project and planning implementation',
        nextSteps: ['Define requirements', 'Create implementation plan', 'Execute changes', 'Verify changes']
      });

      // Switch mode to agent mode
      this.engine.setMode('agent');

      // Print success message
      process.stdout.write('\n' + box(
        `${chalk.hex(t.success).bold('🎯 NEW GOAL INITIALIZED')}\n\n` +
        `Goal:    ${chalk.hex(t.primary)(goalStr)}\n` +
        `Mode:    Switched to ${chalk.hex(t.accent).bold('AGENT MODE')} for autonomous execution.\n` +
        `Tracker: ${chalk.hex(t.muted)('NOVA_GOAL_TRACKER.md')} created in your workspace.`,
        {
          title: '🏆 GOAL TRACKER',
          borderColor: t.success,
          titleColor: t.success,
        }
      ) + '\n\n');

      // Process initial query
      process.stdout.write(chalk.hex(t.info)(`  ⚡ Starting autonomous execution for your goal...`) + '\n');
      await this.engine.processMessage(`My goal is: ${goalStr}. Please start by creating the implementation plan and breaking it down into specific tasks.`);
      return { handled: true };
    }

    // No args: show status dashboard
    const state = scratchpad.getState();
    if (!state.goal) {
      process.stdout.write('\n' + box(
        `No active goal found.\n\n` +
        `Start a new goal with: ${chalk.hex(t.primary)('/goal <your objective>')}`,
        {
          title: '🏆 GOAL TRACKER',
          borderColor: t.warning,
          titleColor: t.warning,
        }
      ) + '\n\n');
      return { handled: true };
    }

    // Calculate progress
    const total = state.completed.length + state.nextSteps.length;
    let percent = total > 0 ? Math.round((state.completed.length / total) * 100) : 0;
    if (state.phase === 'done') percent = 100;

    const barWidth = 25;
    const filled = Math.round((percent / 100) * barWidth);
    const empty = barWidth - filled;
    const barStr = `[${chalk.hex(t.success)('█'.repeat(filled))}${chalk.hex(t.muted)('░'.repeat(empty))}] ${percent}%`;

    const dashboardLines = [
      `🎯 ${chalk.hex(t.primary).bold('Goal')}: ${state.goal}`,
      `📌 ${chalk.hex(t.accent).bold('Task')}: ${state.currentTask || 'None'}`,
      `📊 ${chalk.hex(t.info).bold('Phase')}: ${state.phase.toUpperCase()} (Step ${state.stepCount})`,
      `⏱  ${chalk.hex(t.muted).bold('Updated')}: ${new Date(state.lastUpdated).toLocaleString()}`,
      `📈 ${chalk.hex(t.success).bold('Progress')}: ${barStr}`,
      '',
    ];

    if (state.nextSteps.length > 0) {
      dashboardLines.push(chalk.hex(t.accent).bold('📝 Next Steps:'));
      for (const step of state.nextSteps.slice(0, 5)) {
        dashboardLines.push(`  [ ] ${step}`);
      }
      if (state.nextSteps.length > 5) {
        dashboardLines.push(`  ... and ${state.nextSteps.length - 5} more`);
      }
      dashboardLines.push('');
    }

    if (state.completed.length > 0) {
      dashboardLines.push(chalk.hex(t.success).bold('✅ Completed:'));
      for (const step of state.completed.slice(-5)) {
        dashboardLines.push(`  [x] ${step}`);
      }
      if (state.completed.length > 5) {
        dashboardLines.push(`  ... and ${state.completed.length - 5} earlier completed steps`);
      }
      dashboardLines.push('');
    }

    if (state.keyFiles.length > 0) {
      dashboardLines.push(chalk.hex(t.info).bold(`📂 Key Files: ${state.keyFiles.join(', ')}`));
    }

    if (state.constraints.length > 0) {
      dashboardLines.push(chalk.hex(t.warning).bold(`⚠️ Constraints: ${state.constraints.join(', ')}`));
    }

    process.stdout.write('\n' + box(dashboardLines.join('\n'), {
      title: '🏆 ACTIVE GOAL STATUS',
      borderColor: t.primary,
      titleColor: t.primary,
    }) + '\n\n');

    return { handled: true };
  }
}
