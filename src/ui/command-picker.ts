/**
 * 🎯 NOVA Command Picker — Interactive arrow-key command selector
 * Uses absolute cursor positioning for clean rendering
 */

import chalk from 'chalk';
import { getTheme, ICONS } from './theme.js';

export interface PickerItem {
  label: string;
  value: string;
  description: string;
  icon?: string;
}

export class CommandPicker {
  private items: PickerItem[];
  private selectedIndex = 0;
  private filteredItems: PickerItem[];
  private filter = '';
  private active = false;
  private linesRendered = 0;
  private firstRender = true;

  constructor(items: PickerItem[]) {
    this.items = items;
    this.filteredItems = items;
  }

  /** Show the picker and return selected command */
  show(): Promise<string | null> {
    return new Promise((resolve) => {
      this.active = true;
      this.selectedIndex = 0;
      this.filter = '';
      this.filteredItems = this.items;
      this.linesRendered = 0;
      this.firstRender = true;

      this.render();
      this.startListening(resolve);
    });
  }

  /** Render the picker menu */
  private render(): void {
    const theme = getTheme();
    const maxVisible = Math.min(this.filteredItems.length, 12);

    // Calculate scroll window
    let startIdx = Math.max(0, this.selectedIndex - Math.floor(maxVisible / 2));
    const endIdx = Math.min(this.filteredItems.length, startIdx + maxVisible);
    startIdx = Math.max(0, endIdx - maxVisible);

    // Clear previous render (move cursor up and clear)
    if (!this.firstRender && this.linesRendered > 0) {
      process.stdout.write(`\x1B[${this.linesRendered}A`); // move up
      process.stdout.write('\x1B[0J'); // clear from cursor to end of screen
    }
    this.firstRender = false;

    const lines: string[] = [];

    // Header
    const filterText = this.filter
      ? chalk.hex(theme.primary)(` filter: ${this.filter}`)
      : chalk.hex(theme.muted)(' ↑↓ navigate • enter select • esc cancel');
    lines.push(chalk.hex(theme.border)('  ┌─ Commands') + filterText);

    // Items
    for (let i = startIdx; i < endIdx; i++) {
      const item = this.filteredItems[i];
      const isSelected = i === this.selectedIndex;
      const prefix = isSelected ? chalk.hex(theme.primary)('  │ ▸ ') : chalk.hex(theme.border)('  │   ');

      if (isSelected) {
        lines.push(
          prefix +
          chalk.hex(theme.primary).bold(`/${item.value}`.padEnd(18)) +
          chalk.hex(theme.text)(item.description)
        );
      } else {
        lines.push(
          prefix +
          chalk.hex(theme.textDim)(`/${item.value}`.padEnd(18)) +
          chalk.hex(theme.muted)(item.description)
        );
      }
    }

    // Footer with scroll indicator
    const scrollInfo = this.filteredItems.length > maxVisible
      ? chalk.hex(theme.muted)(` ${this.selectedIndex + 1}/${this.filteredItems.length}`)
      : '';
    lines.push(chalk.hex(theme.border)('  └─────────') + scrollInfo);

    // Write all lines
    const output = lines.join('\n') + '\n';
    process.stdout.write(output);
    this.linesRendered = lines.length;
  }

  /** Start listening for keypresses */
  private startListening(resolve: (value: string | null) => void): void {
    if (!process.stdin.isTTY) {
      resolve(null);
      return;
    }

    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const done = (result: string | null) => {
      this.active = false;
      process.stdin.removeListener('data', handler);
      if (wasRaw !== undefined && wasRaw !== null) {
        process.stdin.setRawMode(wasRaw);
      } else {
        process.stdin.setRawMode(false);
      }
      // Clear the picker display
      if (this.linesRendered > 0) {
        process.stdout.write(`\x1B[${this.linesRendered}A`);
        process.stdout.write('\x1B[0J');
      }
      resolve(result);
    };

    const handler = (data: Buffer) => {
      if (!this.active) return;

      const key = data.toString();

      // Escape or Ctrl+C — cancel
      if (key === '\x1B' && data.length === 1) {
        done(null);
        return;
      }
      if (key === '\x03') {
        done(null);
        return;
      }

      // Enter — select
      if (key === '\r' || key === '\n') {
        const selected = this.filteredItems[this.selectedIndex];
        done(selected ? '/' + selected.value : null);
        return;
      }

      // Arrow Up
      if (key === '\x1B[A') {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.render();
        return;
      }

      // Arrow Down
      if (key === '\x1B[B') {
        this.selectedIndex = Math.min(this.filteredItems.length - 1, this.selectedIndex + 1);
        this.render();
        return;
      }

      // Backspace — remove filter char
      if (key === '\x7F' || key === '\b') {
        if (this.filter.length > 0) {
          this.filter = this.filter.slice(0, -1);
          this.applyFilter();
          this.render();
        }
        return;
      }

      // Tab — ignore
      if (key === '\t') return;

      // Printable characters — filter
      if (key.length === 1 && key >= ' ' && key <= '~') {
        this.filter += key;
        this.applyFilter();
        this.render();
        return;
      }
    };

    process.stdin.on('data', handler);
  }

  /** Apply text filter to items */
  private applyFilter(): void {
    const q = this.filter.toLowerCase();
    this.filteredItems = q
      ? this.items.filter(i =>
          i.value.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
        )
      : this.items;
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredItems.length - 1));
  }

  /** Get default NOVA commands as picker items */
  static getNovaCommands(): PickerItem[] {
    return [
      { label: 'Help', value: 'help', description: 'Show all commands', icon: '❓' },
      { label: 'Agent', value: 'agent', description: 'Switch to agent mode', icon: '🤖' },
      { label: 'Code', value: 'code', description: 'Switch to code mode', icon: '💻' },
      { label: 'Fast', value: 'fast', description: 'Switch to fast mode', icon: '⚡' },
      { label: 'Chat', value: 'chat', description: 'Switch to chat mode', icon: '💬' },
      { label: 'Model', value: 'model', description: 'Switch Ollama model', icon: '🧠' },
      { label: 'Models', value: 'models', description: 'List available models', icon: '📋' },
      { label: 'Plan', value: 'plan', description: 'Generate implementation plan', icon: '📝' },
      { label: 'Status', value: 'status', description: 'System status dashboard', icon: '📊' },
      { label: 'Context', value: 'context', description: 'View context/token usage', icon: '🧮' },
      { label: 'Compress', value: 'compress', description: 'Compress context', icon: '🗜️' },
      { label: 'Tools', value: 'tools', description: 'List available tools', icon: '🔧' },
      { label: 'Project', value: 'project', description: 'Analyze current project', icon: '📁' },
      { label: 'Save', value: 'save', description: 'Save conversation', icon: '💾' },
      { label: 'Load', value: 'load', description: 'Load conversation', icon: '📂' },
      { label: 'History', value: 'history', description: 'List saved conversations', icon: '🕐' },
      { label: 'Export', value: 'export', description: 'Export conversation', icon: '📤' },
      { label: 'Theme', value: 'theme', description: 'Switch color theme', icon: '🎨' },
      { label: 'Config', value: 'config', description: 'View/set configuration', icon: '⚙️' },
      { label: 'Map', value: 'map', description: 'Show project mental map', icon: '🗺️' },
      { label: 'Clear', value: 'clear', description: 'Clear conversation', icon: '🧹' },
      { label: 'Quit', value: 'quit', description: 'Exit NOVA', icon: '👋' },
    ];
  }
}
