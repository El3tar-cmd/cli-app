/**
 * 🔀 NOVA Command Router — Handles slash commands
 */

import chalk from 'chalk';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { colors, gradient, getTheme, box, badge, tag, ICONS, setTheme, getThemeNames, horizontalLine } from '../ui/theme.js';
import { TokenCounter } from '../utils/token-counter.js';
import { formatBytes, formatDuration } from '../utils/helpers.js';
import type { Engine, NovaMode } from './engine.js';
import type { ConversationStore } from '../memory/conversation-store.js';
import type { ConfigManager } from './config.js';
import type { ToolRegistry } from '../tools/tool-registry.js';

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
    const allTools = (this.engine as any).tools?.getAll?.() || [];
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
    // Use the tool registry to run project_analyze
    const tools = (this.engine as any).tools as ToolRegistry;
    if (tools?.has('project_analyze')) {
      const result = await tools.execute('project_analyze', { path: this.cwd });
      if (result.success) {
        process.stdout.write('\n' + result.output.split('\n').map((l: string) => '  ' + l).join('\n') + '\n\n');
      }
    }
    return { handled: true };
  }
}
