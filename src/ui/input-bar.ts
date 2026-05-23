/**
 * ◈ NOVA InputBar — Bottom-anchored input line (like Claude CLI / Codex CLI)
 *
 * Architecture:
 *   • Terminal scroll region = rows 1 → (rows−1)   [all output scrolls here]
 *   • Row  `rows`  = fixed input / spinner bar       [never touched by scroll]
 *
 * stdout.write() is intercepted so every write is guaranteed to land inside
 * the scroll region, leaving the bottom row clean for the prompt.
 */

import chalk from 'chalk';
import { EventEmitter } from 'events';
import { getTheme } from './theme.js';

const SPIN  = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
const MAX_H = 500; // history entries

export class InputBar extends EventEmitter {
  // ── State ──────────────────────────────────────────────────────────
  private buf     = '';           // current edit buffer
  private cur     = 0;            // cursor position within buf
  private hist: string[] = [];    // command history
  private hIdx    = -1;           // -1 = not browsing history
  private hTmp    = '';           // saved buffer while browsing history
  private statusL = '';           // status line text (model / mode / ctx %)

  private mode: 'idle' | 'processing' | 'confirm' = 'idle';
  private spinFrame = 0;
  private spinTimer: ReturnType<typeof setInterval> | null = null;
  private confPrompt = '';
  private confTip    = '';

  private lineResolve:    ((v: string)  => void) | null = null;
  private confirmResolve: ((v: boolean) => void) | null = null;

  private active         = false;
  private originalWrite!: (...a: any[]) => boolean;

  // ── Public API ─────────────────────────────────────────────────────

  /** Initialise terminal layout and take over stdin/stdout */
  start(): void {
    if (this.active) return;
    this.active = true;

    this.rows; // force first read
    this._setupScrollRegion();

    // Intercept ALL stdout writes
    this.originalWrite = (process.stdout.write as any).bind(process.stdout);
    const self = this;
    (process.stdout as any).write = function (
      chunk: any, enc?: any, cb?: any
    ): boolean {
      return self._interceptWrite(chunk, enc, cb);
    };

    // Raw-mode keyboard
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(true); } catch {}
    }
    process.stdin.resume();
    process.stdin.on('data', (d: Buffer) => this._onKey(d));

    // Resize
    process.stdout.on('resize', () => {
      this._setupScrollRegion();
      this._drawBar();
    });

    this._drawBar();
  }

  /** Temporarily release stdin (e.g. for command picker) */
  suspend(): void {
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(false); } catch {}
    }
    process.stdin.pause();
  }

  /** Re-activate stdin after suspend() */
  resume(): void {
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(true); } catch {}
    }
    process.stdin.resume();
    this._drawBar();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;

    this._stopSpinner();
    // Reset scroll region → full screen
    this._raw('\x1b[r');
    // Restore stdout.write
    (process.stdout as any).write = this.originalWrite;
    // Restore stdin
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(false); } catch {}
    }
  }

  /** Update the status line (model name, mode, ctx%) — redraws bar */
  setStatus(text: string): void {
    this.statusL = text;
    this._drawBar();
  }

  /** Switch to processing mode (spinner in the bottom bar) */
  startProcessing(): void {
    this.mode = 'processing';
    this.spinFrame = 0;
    if (!this.spinTimer) {
      this.spinTimer = setInterval(() => {
        this.spinFrame = (this.spinFrame + 1) % SPIN.length;
        this._drawBar();
      }, 80);
    }
    // Move cursor INTO scroll region so engine output goes there
    this._raw(`\x1b[${this.rows - 1};1H`);
  }

  /** Switch back to idle (input box in the bottom bar) */
  stopProcessing(): void {
    this._stopSpinner();
    this.mode = 'idle';
    this.buf = '';
    this.cur = 0;
    this.hIdx = -1;
    this._drawBar();
  }

  /** Convenience alias used by nova.ts confirm handler */
  stopSpinner(): void { this._stopSpinner(); }

  /** Wait for the user to type a line and press Enter */
  waitForLine(): Promise<string> {
    return new Promise(resolve => {
      this.lineResolve = resolve;
      this.mode = 'idle';
      this.buf  = '';
      this.cur  = 0;
      this.hIdx = -1;
      this._drawBar();
    });
  }

  /** Show a Y/N confirmation in the bottom bar */
  waitForConfirm(prompt: string, tip = ''): Promise<boolean> {
    return new Promise(resolve => {
      this.confirmResolve = resolve;
      this.confPrompt     = prompt;
      this.confTip        = tip || ' [Y] Yes   [N] No   [Enter] Yes ';
      this.mode           = 'confirm';
      this._stopSpinner();
      this._drawBar();
    });
  }

  // ── Private internals ──────────────────────────────────────────────

  private get rows(): number { return process.stdout.rows  || 24; }
  private get cols(): number { return process.stdout.columns || 120; }

  /** Set ANSI scroll region (rows 1 … rows−1), leaving last row fixed */
  private _setupScrollRegion(): void {
    const r = this.rows;
    this._raw(`\x1b[1;${r - 1}r`);   // scroll region
    // Clear bottom row
    this._raw(`\x1b[${r};1H\x1b[2K`);
  }

  /** Write directly to the underlying stdout (bypasses intercept) */
  private _raw(text: string): void {
    this.originalWrite(text);
  }

  // ── stdout intercept ───────────────────────────────────────────────
  /** Route all writes to the scroll region, then repaint the bottom bar */
  private _interceptWrite(chunk: any, enc?: any, cb?: any): boolean {
    const text: string =
      Buffer.isBuffer(chunk) ? chunk.toString(enc || 'utf8')
      : typeof chunk === 'string' ? chunk
      : String(chunk);

    if (!text) { if (cb) cb(); return true; }

    const r = this.rows;

    // 1. Save cursor (wherever it is in the scroll region)
    this._raw('\x1b[s');
    // 2. Wipe bottom row so it can't be corrupted
    this._raw(`\x1b[${r};1H\x1b[2K`);
    // 3. Restore cursor to scroll region
    this._raw('\x1b[u');
    // 4. Write the actual content (stays within scroll region)
    this._raw(text);
    // 5. Repaint bottom bar (uses save/restore internally in processing mode)
    this._drawBar();

    if (cb) cb();
    return true;
  }

  // ── Bar rendering ──────────────────────────────────────────────────
  private _drawBar(): void {
    if (!this.active) return;
    const theme = getTheme();
    const r = this.rows;
    const c = this.cols;

    // ── In PROCESSING mode: save→draw spinner→restore ─────────────
    if (this.mode === 'processing') {
      this._raw('\x1b[s');
      this._raw(`\x1b[${r};1H\x1b[2K`);
      this._raw(this._buildProcessingBar(theme, c));
      this._raw('\x1b[u');       // restore cursor to scroll region
      return;
    }

    // ── In CONFIRM mode ───────────────────────────────────────────
    if (this.mode === 'confirm') {
      this._raw('\x1b[s');
      this._raw(`\x1b[${r};1H\x1b[2K`);
      this._raw(this._buildConfirmBar(theme, c));
      this._raw('\x1b[u');
      return;
    }

    // ── IDLE mode: draw input bar, place cursor ───────────────────
    {
      const RAW_PFX = '  ◈  '; // 5 visible chars: "  ◈  "
      const PFX_LEN = 5;
      const maxInput = Math.max(c - PFX_LEN - 2, 10);

      // Choose display slice (keep cursor visible)
      let viewStart = 0;
      if (this.cur > maxInput) {
        viewStart = this.cur - maxInput;
      }
      const visibleBuf  = this.buf.slice(viewStart, viewStart + maxInput);
      const visibleCur  = Math.min(this.cur - viewStart, maxInput);

      const statusPart = this.statusL
        ? chalk.hex(theme.muted)(` ${this.statusL} `)
        : '';

      this._raw(`\x1b[${r};1H\x1b[2K`);
      this._raw(
        chalk.hex(theme.primary).bold(RAW_PFX) +
        chalk.hex(theme.text)(visibleBuf) +
        (statusPart ? chalk.hex(theme.border)('│') + statusPart : '')
      );
      // Position cursor exactly on the edit point
      const curCol = PFX_LEN + visibleCur + 1;
      this._raw(`\x1b[${r};${curCol}H`);
      // No save/restore needed: cursor stays in input row for key events
    }
  }

  private _buildProcessingBar(theme: any, cols: number): string {
    const frame  = SPIN[this.spinFrame];
    const text   = chalk.hex(theme.primary)(frame) +
                   chalk.hex(theme.muted)('  Thinking…');
    const status = this.statusL
      ? chalk.hex(theme.border)('  │  ') + chalk.hex(theme.muted)(this.statusL)
      : '';
    return '  ' + text + status;
  }

  private _buildConfirmBar(theme: any, cols: number): string {
    const prompt = chalk.bgHex('#f59e0b').hex('#000').bold(' CONFIRM ') +
                   '  ' + chalk.hex('#fbbf24')(this.confPrompt);
    const tip    = chalk.hex(theme.muted)(this.confTip);
    return prompt + '  ' + tip;
  }

  // ── Spinner helpers ────────────────────────────────────────────────
  private _stopSpinner(): void {
    if (this.spinTimer) {
      clearInterval(this.spinTimer);
      this.spinTimer = null;
    }
  }

  // ── Keyboard handler ───────────────────────────────────────────────
  private _onKey(data: Buffer): void {
    const key  = data.toString('utf8');
    const code = data[0];

    // ── Ctrl+C ──────────────────────────────────────────────────────
    if (key === '\x03') {
      if (this.mode === 'processing') { this.emit('abort'); }
      else if (this.mode === 'confirm') { this._resolveConfirm(false); }
      else { this.emit('sigint'); }
      return;
    }

    // ── Ctrl+D (EOF) ────────────────────────────────────────────────
    if (key === '\x04') {
      if (this.buf.length === 0) this.emit('eof');
      return;
    }

    // ── Confirm mode ────────────────────────────────────────────────
    if (this.mode === 'confirm') {
      const c = key.toLowerCase();
      if (c === 'y' || c === '\r' || c === '\n') this._resolveConfirm(true);
      else if (c === 'n' || c === '\x1b')        this._resolveConfirm(false);
      return;
    }

    // ── Processing mode → ignore keystrokes (absorbed silently) ────
    if (this.mode === 'processing') return;

    // ── IDLE mode key handling ───────────────────────────────────────

    // Enter
    if (key === '\r' || key === '\n') {
      const line = this.buf.trim();
      if (line && this.hist[0] !== line) {
        this.hist.unshift(line);
        if (this.hist.length > MAX_H) this.hist.pop();
      }
      this.buf = '';
      this.cur = 0;
      this.hIdx = -1;
      if (this.lineResolve) {
        const r = this.lineResolve;
        this.lineResolve = null;
        // Print a newline into scroll region for visual separation
        this._raw('\x1b[s');
        this._raw(`\x1b[${this.rows - 1};1H`);
        this._raw('\n');
        this._raw('\x1b[u');
        r(line);
      } else {
        this.emit('line', line);
      }
      return;
    }

    // Backspace
    if (key === '\x7f' || key === '\x08') {
      if (this.cur > 0) {
        this.buf = this.buf.slice(0, this.cur - 1) + this.buf.slice(this.cur);
        this.cur--;
        this._drawBar();
      }
      return;
    }

    // Delete key (ESC [ 3 ~)
    if (key === '\x1b[3~') {
      if (this.cur < this.buf.length) {
        this.buf = this.buf.slice(0, this.cur) + this.buf.slice(this.cur + 1);
        this._drawBar();
      }
      return;
    }

    // Left arrow
    if (key === '\x1b[D') { if (this.cur > 0) { this.cur--; this._drawBar(); } return; }
    // Right arrow
    if (key === '\x1b[C') { if (this.cur < this.buf.length) { this.cur++; this._drawBar(); } return; }

    // Up arrow → history previous
    if (key === '\x1b[A') {
      if (this.hIdx === -1) this.hTmp = this.buf;
      if (this.hIdx < this.hist.length - 1) {
        this.hIdx++;
        this.buf = this.hist[this.hIdx];
        this.cur = this.buf.length;
        this._drawBar();
      }
      return;
    }

    // Down arrow → history next
    if (key === '\x1b[B') {
      if (this.hIdx > 0) {
        this.hIdx--;
        this.buf = this.hist[this.hIdx];
        this.cur = this.buf.length;
      } else if (this.hIdx === 0) {
        this.hIdx = -1;
        this.buf  = this.hTmp;
        this.cur  = this.buf.length;
      }
      this._drawBar();
      return;
    }

    // Home / Ctrl+A
    if (key === '\x1b[H' || key === '\x01') { this.cur = 0; this._drawBar(); return; }
    // End / Ctrl+E
    if (key === '\x1b[F' || key === '\x05') { this.cur = this.buf.length; this._drawBar(); return; }

    // Ctrl+U → clear line
    if (key === '\x15') { this.buf = ''; this.cur = 0; this._drawBar(); return; }

    // Ctrl+K → delete to end
    if (key === '\x0b') { this.buf = this.buf.slice(0, this.cur); this._drawBar(); return; }

    // Ctrl+W → delete word backwards
    if (key === '\x17') {
      const before = this.buf.slice(0, this.cur).trimEnd();
      const ls = before.lastIndexOf(' ');
      const nb = ls >= 0 ? before.slice(0, ls + 1) : '';
      this.buf = nb + this.buf.slice(this.cur);
      this.cur = nb.length;
      this._drawBar();
      return;
    }

    // Tab → emit for autocomplete
    if (key === '\t') { this.emit('tab', this.buf); return; }

    // Ignore other escape sequences
    if (key.startsWith('\x1b')) return;

    // Printable characters
    if (code >= 0x20 || data.length > 1) {
      this.buf = this.buf.slice(0, this.cur) + key + this.buf.slice(this.cur);
      this.cur += key.length;
      this._drawBar();
    }
  }

  // ── Confirm resolution ─────────────────────────────────────────────
  private _resolveConfirm(approved: boolean): void {
    if (!this.confirmResolve) return;
    const resolve = this.confirmResolve;
    this.confirmResolve = null;
    this.mode = 'idle';

    const theme = getTheme();
    // Print result line into scroll region
    this._raw('\x1b[s');
    this._raw(`\x1b[${this.rows - 1};1H\n`);
    this._raw(approved
      ? '  ' + chalk.hex(theme.success).bold('✔ Approved') + '\n'
      : '  ' + chalk.hex(theme.error).bold('✖ Rejected') + '\n'
    );
    this._raw('\x1b[u');

    this.buf = '';
    this.cur = 0;
    this._drawBar();
    resolve(approved);
  }
}
