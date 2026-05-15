/**
 * 🛠 NOVA Helpers — Common utility functions
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

/** Get NOVA config directory (~/.nova) */
export function getNovaDir(): string {
  const dir = join(homedir(), '.nova');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Get NOVA data subdirectory */
export function getNovaSubDir(sub: string): string {
  const dir = join(getNovaDir(), sub);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Sleep for ms */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Strip ANSI escape codes from string */
export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Truncate string with ellipsis */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

/** Format bytes to human readable */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Format duration in ms to human readable */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/** Relative time (e.g., "2 min ago") */
export function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Detect if running on Windows */
export function isWindows(): boolean {
  return process.platform === 'win32';
}

/** Normalize path separators */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Generate unique ID */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
