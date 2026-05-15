/**
 * 📝 NOVA Logger — Structured logging with file + terminal output
 */

import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3, SILENT = 4,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private logFile: string | null = null;

  configure(options: { level?: LogLevel; logDir?: string }): void {
    if (options.level !== undefined) this.level = options.level;
    if (options.logDir) {
      if (!existsSync(options.logDir)) mkdirSync(options.logDir, { recursive: true });
      this.logFile = join(options.logDir, `nova-${new Date().toISOString().split('T')[0]}.log`);
    }
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (level < this.level) return;
    const labels = { [LogLevel.DEBUG]: 'DBG', [LogLevel.INFO]: 'INF', [LogLevel.WARN]: 'WRN', [LogLevel.ERROR]: 'ERR', [LogLevel.SILENT]: '' };
    const colors = { [LogLevel.DEBUG]: '#6C7086', [LogLevel.INFO]: '#00BFFF', [LogLevel.WARN]: '#FFD700', [LogLevel.ERROR]: '#FF3366', [LogLevel.SILENT]: '#FFFFFF' };
    const ts = new Date().toISOString().slice(11, 23);
    const label = chalk.hex(colors[level])(`[${labels[level]}]`);
    if (level >= LogLevel.WARN) process.stderr.write(`${chalk.dim(ts)} ${label} ${message}\n`);
    if (this.logFile) {
      try { appendFileSync(this.logFile, `${ts} [${labels[level]}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`); } catch {}
    }
  }

  debug(msg: string, data?: unknown) { this.log(LogLevel.DEBUG, msg, data); }
  info(msg: string, data?: unknown) { this.log(LogLevel.INFO, msg, data); }
  warn(msg: string, data?: unknown) { this.log(LogLevel.WARN, msg, data); }
  error(msg: string, data?: unknown) { this.log(LogLevel.ERROR, msg, data); }
}

export const logger = new Logger();
