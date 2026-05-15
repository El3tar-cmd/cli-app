/**
 * 🎯 NOVA Command Picker — Interactive arrow-key command selector
 */

import chalk from 'chalk';
import { getTheme, ICONS, gradient } from './theme.js';

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
  private onSelect: (value: string) => void;
  private onCancel: () => void;
  private active = false;

  constructor(items: PickerItem[]) {
    this.items = items;
    this.filteredItems = items;
    this.onSelect = () => {};
    this.onCancel = () => {};
  }

  /** Show the picker and return selected command */
  show(): Promise<string | null> {
    return new Promise((resolve) => {
      this.active = true;
      this.selectedIndex = 0;
      this.filter = '';
      this.filteredItems = this.items;

      this.onSelect = (value: string) => {
        this.active = false;
        this.cleanup();
        resolve(value);
      };

      this.onCancel = () => {
        this.active = false;
        this.cleanup();
        resolve(null);
      };

      this.render();
      this.startListening();
    });
  }

  /** Render the picker menu */
  private render(): void {
    const theme = getTheme();
    const maxVisible = Math.min(this.filteredItems.length, 12);
    
    // Calculate scroll window
    const startIdx = Math.max(0, this.selectedIndex - Math.floor(maxVisible / 2));
    const endIdx = Math.min(this.filteredItems.length, startIdx + maxVisible);

    // Clear previous render
    if (this.filteredItems.length > 0) {
      // Move up to clear old lines (header + items + footer = maxVisible + 2)
      process.stdout.write(`\x1B[${maxVisible + 3}A\x1B[0J`);
    }

    // Header
    const filterText = this.filter 
      ? chalk.hex(theme.primary)(` filter: ${this.filter}`)
      : chalk.hex(theme.muted)(' ↑↓ navigate • enter select • esc cancel');
    process.stdout.write(chalk.hex(theme.border)('  ┌─ Commands ') + filterText + '\n');

    // Items
    for (let i = startIdx; i < endIdx; i++) {
      const item = this.filteredItems[i];
      const isSelected = i === this.selectedIndex;
      const prefix = isSelected ? chalk.hex(theme.primary)('  │ ▸ ') : chalk.hex(theme.border)('  │   ');
      const icon = item.icon || ICONS.arrowRight;
      
      if (isSelected) {
        process.stdout.write(
          prefix +
          chalk.hex(theme.primary).bold(`/${item.value}`.padEnd(18)) +
          chalk.hex(theme.text)(item.description) + '\n'
        );
      } else {
        process.stdout.write(
          prefix +
          chalk.hex(theme.textDim)(`/${item.value}`.padEnd(18)) +
          chalk.hex(theme.muted)(item.description) + '\n'
        );
      }
    }

    // Scroll indicator
    const hasMore = this.filteredItems.length > maxVisible;
    const scrollInfo = hasMore 
      ? chalk.hex(theme.muted)(` ${this.selectedIndex + 1}/${this.filteredItems.length}`)
      : '';
    process.stdout.write(chalk.hex(theme.border)('  └─────────') + scrollInfo + '\n');
  }

  /** Start listening for keypresses */
  private startListening(): void {
    if (!process.stdin.isTTY) {
      this.onCancel();
      return;
    }

    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const handler = (data: Buffer) => {
      if (!this.active) {
        process.stdin.removeListener('data', handler);
        return;
      }

      const key = data.toString();

      // Escape — cancel
      if (key === '\x1B' || key === '\x03') {
        process.stdin.removeListener('data', handler);
        if (wasRaw !== undefined) process.stdin.setRawMode(wasRaw);
        this.onCancel();
        return;
      }

      // Enter — select
      if (key === '\r' || key === '\n') {
        process.stdin.removeListener('data', handler);
        if (wasRaw !== undefined) process.stdin.setRawMode(wasRaw);
        const selected = this.filteredItems[this.selectedIndex];
        if (selected) {
          this.onSelect('/' + selected.value);
        } else {
          this.onCancel();
        }
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
          i.description.toLowerCase().includes(q) ||
          i.label.toLowerCase().includes(q)
        )
      : this.items;
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredItems.length - 1));
  }

  /** Cleanup terminal state */
  private cleanup(): void {
    // Clear the picker display
    const maxVisible = Math.min(this.filteredItems.length, 12);
    process.stdout.write(`\x1B[${maxVisible + 3}A\x1B[0J`);
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
      { label: 'Clear', value: 'clear', description: 'Clear conversation', icon: '🧹' },
      { label: 'Quit', value: 'quit', description: 'Exit NOVA', icon: '👋' },
    ];
  }
}
