import * as readline from 'node:readline';
import chalk from 'chalk';
import { getTheme } from './theme.js';

export interface Choice {
  name: string;
  value: string;
}

/**
 * Ask a standard text-based question using readline
 */
export async function askText(questionText: string, defaultValue: string = ''): Promise<string> {
  const theme = getTheme();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = chalk.hex(theme.primary).bold('❓ ') + 
                 chalk.hex(theme.text).bold(questionText) + 
                 (defaultValue ? chalk.hex(theme.muted)(` (${defaultValue})`) : '') + 
                 chalk.hex(theme.primary)(': ');

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Interactive selection prompt using arrow keys in TTY
 */
export async function selectChoice(questionText: string, choices: Choice[], defaultIdx: number = 0): Promise<string> {
  const theme = getTheme();
  let selectedIndex = defaultIdx;
  let linesRendered = 0;
  let active = true;

  function render() {
    // Clear previous render
    if (linesRendered > 0) {
      process.stdout.write(`\x1B[${linesRendered}A`);
      process.stdout.write('\x1B[0J');
    }

    const lines: string[] = [];
    lines.push(
      chalk.hex(theme.primary).bold('❓ ') + 
      chalk.hex(theme.text).bold(questionText) + 
      chalk.hex(theme.muted)(' (Use ↑↓ arrow keys, Enter to select)')
    );

    for (let i = 0; i < choices.length; i++) {
      const isSelected = i === selectedIndex;
      const prefix = isSelected ? chalk.hex(theme.primary)('  ▸ ') : '    ';
      const nameText = isSelected 
        ? chalk.hex(theme.primary).bold(choices[i].name) 
        : chalk.hex(theme.textDim)(choices[i].name);
      lines.push(`${prefix}${nameText}`);
    }

    const output = lines.join('\n') + '\n';
    process.stdout.write(output);
    linesRendered = lines.length;
  }

  render();

  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(choices[defaultIdx]?.value);
      return;
    }

    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const done = (val: string) => {
      active = false;
      process.stdin.removeListener('data', handler);
      process.stdin.setRawMode(wasRaw || false);
      
      // Clear choices and print confirmation inline
      if (linesRendered > 0) {
        process.stdout.write(`\x1B[${linesRendered}A`);
        process.stdout.write('\x1B[0J');
      }
      
      const selectedChoice = choices.find(c => c.value === val);
      process.stdout.write(
        chalk.hex(theme.success).bold('✔ ') + 
        chalk.hex(theme.text).bold(questionText) + 
        chalk.hex(theme.primary)(': ') + 
        chalk.hex(theme.accent).bold(selectedChoice ? selectedChoice.name : val) + '\n'
      );
      resolve(val);
    };

    const handler = (data: Buffer) => {
      if (!active) return;
      const key = data.toString();

      if (key === '\x03') { // Ctrl+C
        done(choices[defaultIdx]?.value);
        process.exit(0);
      }
      if (key === '\r' || key === '\n') { // Enter
        done(choices[selectedIndex].value);
        return;
      }
      
      // Standard ANSI arrow key sequences
      if (key === '\x1B[A') { // Arrow Up
        selectedIndex = (selectedIndex - 1 + choices.length) % choices.length;
        render();
        return;
      }
      if (key === '\x1B[B') { // Arrow Down
        selectedIndex = (selectedIndex + 1) % choices.length;
        render();
        return;
      }
    };

    process.stdin.on('data', handler);
  });
}
