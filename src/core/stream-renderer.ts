/**
 * 🌊 NOVA Stream Renderer v2 — Real-time streaming markdown renderer
 * Clear visual separation: THINKING | RESPONDING | TOOL EXECUTION
 */

import chalk from 'chalk';
import { getTheme, gradient, colors } from '../ui/theme.js';

interface RenderState {
  inCodeBlock: boolean;
  codeBlockLang: string;
  codeBuffer: string;
  inBold: boolean;
  inItalic: boolean;
  inThinking: boolean;
  thinkingLineCount: number;
  lineBuffer: string;
  fullContent: string;
  responseStarted: boolean;
}

export class StreamRenderer {
  private state: RenderState;
  private output: NodeJS.WriteStream;

  constructor(output: NodeJS.WriteStream = process.stdout) {
    this.output = output;
    this.state = this.freshState();
  }

  private freshState(): RenderState {
    return {
      inCodeBlock: false,
      codeBlockLang: '',
      codeBuffer: '',
      inBold: false,
      inItalic: false,
      inThinking: false,
      thinkingLineCount: 0,
      lineBuffer: '',
      fullContent: '',
      responseStarted: false,
    };
  }

  /** Reset renderer state for new response */
  reset(): void {
    this.state = this.freshState();
  }

  /** Process a single token from the stream */
  writeToken(token: string): void {
    this.state.fullContent += token;
    this.state.lineBuffer += token;

    // Process complete lines
    while (this.state.lineBuffer.includes('\n')) {
      const nlIndex = this.state.lineBuffer.indexOf('\n');
      const line = this.state.lineBuffer.slice(0, nlIndex);
      this.state.lineBuffer = this.state.lineBuffer.slice(nlIndex + 1);
      this.processLine(line);
      this.output.write('\n');
    }
    // If there is remaining buffer without newline, render it immediately
    if (this.state.lineBuffer) {
      if (this.state.inCodeBlock) {
        this.output.write(chalk.hex(getTheme().textDim)(this.state.lineBuffer));
      } else if (this.state.inThinking) {
        this.output.write(chalk.hex(getTheme().muted).dim.italic(this.state.lineBuffer));
      } else {
        this.output.write(this.renderInline(this.state.lineBuffer));
      }
      this.state.lineBuffer = '';
    }
  }

  /** Flush any remaining buffer */
  flush(): void {
    if (this.state.lineBuffer) {
      if (this.state.inCodeBlock) {
        this.output.write(chalk.hex(getTheme().textDim)(this.state.lineBuffer));
      } else {
        this.output.write(this.renderInline(this.state.lineBuffer));
      }
      this.state.lineBuffer = '';
    }

    if (this.state.inCodeBlock) {
      this.output.write('\n' + chalk.hex(getTheme().border)('  └' + '─'.repeat(40)) + '\n');
      this.state.inCodeBlock = false;
    }

    // Close unclosed thinking block
    if (this.state.inThinking) {
      const theme = getTheme();
      this.output.write(
        '\n' + chalk.hex(theme.border)('  └' + '─'.repeat(46)) + '\n'
      );
      this.state.inThinking = false;
    }
  }

  /** Get the full rendered content */
  getContent(): string {
    return this.state.fullContent;
  }

  private processLine(line: string): void {
    const theme = getTheme();

    // ── Thinking block: open ──────────────────────────────────────────
    if (line.trim() === '<think>' || line.trim().startsWith('<think>')) {
      this.state.inThinking = true;
      this.state.thinkingLineCount = 0;
      // Draw a distinct "THINKING" section header
      this.output.write(
        '\n' +
        chalk.hex(theme.border)('  ┌─') +
        chalk.hex('#7c6af7').bold('▸ THINKING') +
        chalk.hex(theme.border)('─'.repeat(37)) + '\n'
      );
      return;
    }

    // ── Thinking block: close ─────────────────────────────────────────
    if (line.trim() === '</think>' || line.trim().endsWith('</think>')) {
      this.state.inThinking = false;
      this.output.write(
        chalk.hex(theme.border)('  └─') +
        chalk.hex('#7c6af7')(` ${this.state.thinkingLineCount} lines `) +
        chalk.hex(theme.border)('─'.repeat(Math.max(0, 38 - String(this.state.thinkingLineCount).length))) + '\n'
      );
      // Show RESPONSE header when transitioning from thinking to response
      if (!this.state.responseStarted) {
        this.state.responseStarted = true;
        this.output.write(
          '\n' +
          chalk.hex(theme.border)('  ┌─') +
          chalk.hex('#38bdf8').bold('✦ RESPONSE') +
          chalk.hex(theme.border)('─'.repeat(38)) + '\n'
        );
      }
      return;
    }

    // ── Inside thinking block ─────────────────────────────────────────
    if (this.state.inThinking) {
      this.state.thinkingLineCount++;
      // Skip empty lines to keep thinking section compact
      if (!line.trim()) return;
      this.output.write(
        chalk.hex(theme.border)('  │ ') +
        chalk.hex('#9d88f5')(line)
      );
      return;
    }

    // Mark response started if this is first content without thinking block
    if (!this.state.responseStarted && line.trim()) {
      this.state.responseStarted = true;
    }

    // ── Code block: open ──────────────────────────────────────────────
    if (line.trimStart().startsWith('```')) {
      if (!this.state.inCodeBlock) {
        this.state.inCodeBlock = true;
        this.state.codeBlockLang = line.trim().slice(3).trim();
        const langLabel = this.state.codeBlockLang || 'code';
        const pad = Math.max(0, 34 - langLabel.length);
        this.output.write(
          '\n' +
          chalk.hex(theme.border)('  ┌') +
          chalk.bgHex('#0d1117').hex(theme.accent).bold(` ${langLabel} `) +
          chalk.hex(theme.border)('─'.repeat(pad))
        );
        return;
      } else {
        this.state.inCodeBlock = false;
        this.state.codeBlockLang = '';
        this.output.write(chalk.hex(theme.border)('  └' + '─'.repeat(40)));
        return;
      }
    }

    // ── Inside code block ─────────────────────────────────────────────
    if (this.state.inCodeBlock) {
      this.output.write(
        chalk.hex(theme.border)('  │ ') +
        chalk.hex('#ABB2BF')(line)
      );
      return;
    }

    // ── Markdown: Headers ─────────────────────────────────────────────
    if (line.startsWith('### ')) {
      this.output.write('   ' + chalk.hex(theme.accent).bold(line.slice(4)));
      return;
    }
    if (line.startsWith('## ')) {
      this.output.write('  ' + gradient(line.slice(3)));
      return;
    }
    if (line.startsWith('# ')) {
      this.output.write(gradient('━'.repeat(3) + ' ' + line.slice(2) + ' ' + '━'.repeat(3)));
      return;
    }

    // ── Horizontal rule ───────────────────────────────────────────────
    if (/^[-*_]{3,}$/.test(line.trim())) {
      this.output.write(chalk.hex(theme.border)('  ' + '─'.repeat(50)));
      return;
    }

    // ── Bullet points ─────────────────────────────────────────────────
    if (/^\s*[-*+]\s/.test(line)) {
      const indent = line.match(/^\s*/)?.[0] || '';
      const content = line.replace(/^\s*[-*+]\s/, '');
      this.output.write(
        indent + chalk.hex(theme.primary)('  ▸ ') + this.renderInline(content)
      );
      return;
    }

    // ── Numbered lists ────────────────────────────────────────────────
    if (/^\s*\d+\.\s/.test(line)) {
      const match = line.match(/^(\s*)(\d+)\.\s(.*)$/);
      if (match) {
        this.output.write(
          match[1] + chalk.hex(theme.primary).bold(`  ${match[2]}.`) + ' ' + this.renderInline(match[3])
        );
        return;
      }
    }

    // ── Blockquote ────────────────────────────────────────────────────
    if (line.startsWith('> ')) {
      this.output.write(
        chalk.hex(theme.border)('  ┃ ') +
        chalk.hex(theme.textDim).italic(line.slice(2))
      );
      return;
    }

    // ── Regular text ──────────────────────────────────────────────────
    this.output.write('  ' + this.renderInline(line));
  }

  /** Render inline markdown (bold, italic, code, links) */
  private renderInline(text: string): string {
    const theme = getTheme();

    return text
      .replace(/`([^`]+)`/g, (_, code) => chalk.hex(theme.accent)(`\`${code}\``))
      .replace(/\*\*\*(.+?)\*\*\*/g, (_, t) => chalk.hex(theme.text).bold.italic(t))
      .replace(/\*\*(.+?)\*\*/g, (_, t) => chalk.hex(theme.text).bold(t))
      .replace(/\*(.+?)\*/g, (_, t) => chalk.hex(theme.text).italic(t))
      .replace(/~~(.+?)~~/g, (_, t) => chalk.strikethrough(t))
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) =>
        chalk.hex(theme.info).underline(label) + chalk.hex(theme.muted)(` (${url})`)
      );
  }

  /** Render a complete markdown string (non-streaming) */
  renderFull(markdown: string): string {
    const lines = markdown.split('\n');
    const output: string[] = [];
    let inCode = false;
    let codeLang = '';

    for (const line of lines) {
      if (line.trimStart().startsWith('```')) {
        if (!inCode) {
          inCode = true;
          codeLang = line.trim().slice(3);
          const label = codeLang || 'code';
          output.push(
            chalk.hex(getTheme().border)('  ┌────') +
            chalk.hex(getTheme().accent).bold(` ${label} `) +
            chalk.hex(getTheme().border)('─'.repeat(Math.max(0, 34 - label.length)))
          );
        } else {
          inCode = false;
          output.push(chalk.hex(getTheme().border)('  └' + '─'.repeat(40)));
        }
        continue;
      }
      if (inCode) {
        output.push(chalk.hex(getTheme().border)('  │ ') + chalk.hex(getTheme().text)(line));
        continue;
      }
      output.push(this.renderLineToString(line));
    }
    return output.join('\n');
  }

  private renderLineToString(line: string): string {
    const theme = getTheme();
    if (line.startsWith('# ')) return gradient('━━━ ' + line.slice(2) + ' ━━━');
    if (line.startsWith('## ')) return '  ' + gradient(line.slice(3));
    if (line.startsWith('### ')) return '   ' + chalk.hex(theme.accent).bold(line.slice(4));
    if (/^[-*_]{3,}$/.test(line.trim())) return chalk.hex(theme.border)('─'.repeat(50));
    if (/^\s*[-*+]\s/.test(line)) {
      const content = line.replace(/^\s*[-*+]\s/, '');
      return chalk.hex(theme.primary)('  ▸ ') + this.renderInline(content);
    }
    if (line.startsWith('> ')) return chalk.hex(theme.border)('  ┃ ') + chalk.hex(theme.textDim).italic(line.slice(2));
    return '  ' + this.renderInline(line);
  }
}
