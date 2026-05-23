/**
 * ⚡ NOVA Async Command Runner v2 — Smart, Self-Healing Command Execution
 *
 * Features:
 *  1. Smart Command Analyzer   — auto-detects long-running server commands
 *  2. Port Conflict Resolver   — auto-kills zombie processes hogging ports
 *  3. Interactive Prompt Guard  — detects stdin-blocking prompts & auto-answers
 *  4. Process Tree Killer       — Win32 taskkill /F /T + Unix PGID kill
 *  5. Background Daemon Manager — persistent process lifecycle management
 */

import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { createConnection } from 'node:net';
import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface RunOptions {
  cwd?: string;
  timeout?: number;
  maxBuffer?: number;
  env?: Record<string, string>;
  shell?: boolean;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface RunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  killed: boolean;
  duration: number;
  signal: string | null;
  daemonized?: boolean;
  daemonId?: string;
  daemonPort?: number;
}

export interface BackgroundProcess {
  id: string;
  command: string;
  process: ChildProcess;
  startedAt: number;
  stdout: string[];
  stderr: string[];
  port?: number;
}

// ─── Constants ───────────────────────────────────────────────────────

/** Regex patterns that identify long-running / persistent server commands */
const LONG_RUNNING_PATTERNS: RegExp[] = [
  /\bnpm\s+run\s+(?:dev|start|serve|watch)\b/i,
  /\bnpx\s+(?:vite|next|nuxt|remix|astro|webpack-dev-server)\b/i,
  /\bnode\s+.*(?:server|app|index)\.\w+\b/i,
  /\bnodemon\b/i,
  /\btsx\s+(?:watch\s+)?.*(?:server|app|index)\b/i,
  /\bts-node-dev\b/i,
  /\bdocker[\s-]compose\s+up\b/i,
  /\buvicorn\b/i,
  /\bflask\s+run\b/i,
  /\bdjango.*runserver\b/i,
  /\bcargo\s+(?:run|watch)\b/i,
  /\bgo\s+run\b/i,
  /\brails\s+(?:server|s)\b/i,
  /\bphp\s+(?:-S|artisan\s+serve)\b/i,
  /\blive-server\b/i,
  /\bhttp-server\b/i,
  /\bserve\s+-/i,
];

/** Regex patterns that identify interactive prompts waiting for user input */
const INTERACTIVE_PROMPT_PATTERNS: RegExp[] = [
  /\[y\/n\]/i,
  /\(y\/n\)/i,
  /\[yes\/no\]/i,
  /press\s+(?:enter|any\s+key)/i,
  /password\s*:/i,
  /username\s*:/i,
  /enter\s+(?:project|app|package)\s+name/i,
  /\?\s+(?:project|package)\s+name/i,
  /do you want to (?:continue|proceed|install)/i,
  /are you sure/i,
  /overwrite\?/i,
  /\?\s+Would you like/i,
  /\?\s+What (?:is|would)/i,
  /\?\s+Select/i,
  /\?\s+Choose/i,
  /\?\s+Pick/i,
  /\>\s*$/,  // Bare prompt arrow at end of output
];

/** Common ports used by dev servers */
const COMMON_DEV_PORTS = [3000, 3001, 4000, 4200, 5000, 5173, 5174, 8000, 8080, 8888];

// ─── Utility Functions ───────────────────────────────────────────────

/** Detect if a command is a long-running persistent server */
export function isLongRunningCommand(command: string): boolean {
  return LONG_RUNNING_PATTERNS.some(p => p.test(command));
}

/** Extract port number from a command string (e.g. --port 3000, -p 8080) */
export function extractPortFromCommand(command: string): number | null {
  const portMatch = command.match(/(?:--port|-p)\s+(\d+)/);
  if (portMatch) return parseInt(portMatch[1], 10);

  // Infer common ports based on framework
  if (/\bvite\b/i.test(command)) return 5173;
  if (/\bnext\b/i.test(command)) return 3000;
  if (/\bnuxt\b/i.test(command)) return 3000;
  if (/\bremix\b/i.test(command)) return 5173;
  if (/\bastro\b/i.test(command)) return 4321;
  if (/\bangular\b|ng\s+serve/i.test(command)) return 4200;
  if (/\bflask\b/i.test(command)) return 5000;
  if (/\bdjango\b/i.test(command)) return 8000;
  if (/\brails\b/i.test(command)) return 3000;

  return null;
}

/** Check if a specific TCP port is currently in use */
export function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const conn = createConnection({ port, host: '127.0.0.1' });
    conn.on('connect', () => { conn.destroy(); resolve(true); });
    conn.on('error', () => { conn.destroy(); resolve(false); });
    conn.setTimeout(800, () => { conn.destroy(); resolve(false); });
  });
}

/** Find the PID occupying a port and kill its entire process tree */
export async function resolvePortConflict(port: number): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      // Windows: netstat → taskkill /F /T
      const netstat = execSync(
        `netstat -ano | findstr LISTENING | findstr :${port}`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();

      const lines = netstat.split('\n').filter(Boolean);
      const pids = new Set<string>();
      for (const line of lines) {
        const match = line.trim().match(/(\d+)\s*$/);
        if (match) pids.add(match[1]);
      }

      for (const pid of pids) {
        try {
          execSync(`taskkill /F /T /PID ${pid}`, { timeout: 5000 });
          logger.info(`🔧 Port ${port}: killed process tree PID ${pid}`);
        } catch { /* process may have already exited */ }
      }
    } else {
      // Unix: lsof → kill -9
      const lsof = execSync(
        `lsof -ti :${port}`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();

      const pids = lsof.split('\n').filter(Boolean);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { timeout: 3000 });
          logger.info(`🔧 Port ${port}: killed PID ${pid}`);
        } catch { /* process may have already exited */ }
      }
    }

    // Wait a moment for OS to release port
    await new Promise(r => setTimeout(r, 500));
    return true;
  } catch {
    // No process found on port, or command failed — port is likely free
    return false;
  }
}

/** Wait until a port starts listening (server ready check) */
export function waitForPort(port: number, timeoutMs: number = 15000): Promise<boolean> {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) { resolve(false); return; }

      const conn = createConnection({ port, host: '127.0.0.1' });
      conn.on('connect', () => { conn.destroy(); resolve(true); });
      conn.on('error', () => { conn.destroy(); setTimeout(check, 300); });
      conn.setTimeout(500, () => { conn.destroy(); setTimeout(check, 300); });
    };
    check();
  });
}

/** Kill an entire process tree cross-platform */
function killProcessTree(pid: number): void {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/F', '/T', '/PID', pid.toString()]);
    } else {
      // Try to kill the process group
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        process.kill(pid, 'SIGKILL');
      }
    }
  } catch {
    // Process may have already exited
  }
}

// ─── AsyncRunner Class ───────────────────────────────────────────────

export class AsyncRunner extends EventEmitter {
  private processes = new Map<string, BackgroundProcess>();
  private defaultCwd: string;
  private idCounter = 0;

  constructor(cwd: string) {
    super();
    this.defaultCwd = cwd;
  }

  /**
   * Smart Run — Execute a command with auto-detection of:
   *  • Long-running servers → auto-daemonize
   *  • Port conflicts → auto-resolve
   *  • Interactive prompts → auto-answer
   *  • Stalled execution → auto-kill process tree
   */
  async smartRun(command: string, options: RunOptions = {}): Promise<RunResult> {
    const workDir = options.cwd || this.defaultCwd;

    // ── Phase 1: Detect long-running server commands ──
    if (isLongRunningCommand(command)) {
      logger.info(`🧠 Smart Detect: "${command}" is a long-running server. Auto-daemonizing...`);
      return this.daemonize(command, workDir);
    }

    // ── Phase 2: Standard execution with enhanced safeguards ──
    return this.run(command, {
      ...options,
      cwd: workDir,
    });
  }

  /**
   * Daemonize — Start a server command as a background daemon.
   * Resolves port conflicts, starts the process, waits for port readiness,
   * and returns a success result with daemon metadata.
   */
  async daemonize(command: string, cwd?: string): Promise<RunResult> {
    const workDir = cwd || this.defaultCwd;
    const port = extractPortFromCommand(command);
    const startTime = Date.now();

    // ── Resolve port conflict if target port is known ──
    if (port) {
      const portBusy = await isPortInUse(port);
      if (portBusy) {
        logger.info(`🔧 Port ${port} is occupied. Auto-resolving conflict...`);
        await resolvePortConflict(port);
      }
    }

    // ── Start as background daemon ──
    const daemonId = this.startBackground(command, workDir);
    const bg = this.processes.get(daemonId);
    if (bg && port) bg.port = port;

    // ── Wait for port to become ready (if known) ──
    let portReady = false;
    if (port) {
      portReady = await waitForPort(port, 15000);
    } else {
      // No port known — wait 3s for initial output
      await new Promise(r => setTimeout(r, 3000));
      portReady = true;
    }

    const duration = Date.now() - startTime;
    const bgStatus = this.getBackground(daemonId);
    const output = bgStatus?.stdout || '';

    if (!portReady && port) {
      return {
        exitCode: null,
        stdout: output,
        stderr: bgStatus?.stderr || '',
        killed: false,
        duration,
        signal: null,
        daemonized: true,
        daemonId,
        daemonPort: port,
      };
    }

    return {
      exitCode: 0,
      stdout: port
        ? `✅ Server started as background daemon (${daemonId}) on port ${port}.\n` +
          `   URL: http://localhost:${port}\n` +
          `   ⚠ Do NOT run this command again — the server is already running.\n\n` +
          output
        : `✅ Process started as background daemon (${daemonId}).\n\n` + output,
      stderr: '',
      killed: false,
      duration,
      signal: null,
      daemonized: true,
      daemonId,
      daemonPort: port || undefined,
    };
  }

  /** Run a command asynchronously and return when complete */
  async run(command: string, options: RunOptions = {}): Promise<RunResult> {
    const {
      cwd = this.defaultCwd,
      timeout = 30000,
      maxBuffer = 5 * 1024 * 1024,
      env,
      shell = true,
      onStdout,
      onStderr,
    } = options;

    return new Promise<RunResult>((resolvePromise) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let killed = false;
      let lastActivityTime = Date.now();
      let promptDetected = false;

      const child = spawn(command, [], {
        cwd: resolve(cwd),
        shell,
        env: { ...process.env, ...env, CI: 'true', FORCE_COLOR: '0' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // ── Timeout handler with process tree kill ──
      const timer = setTimeout(() => {
        killed = true;
        if (child.pid) {
          killProcessTree(child.pid);
        } else {
          child.kill('SIGKILL');
        }
        // Fallback: force-resolve after 3s if close event never fires
        setTimeout(() => {
          resolvePromise({
            exitCode: null,
            stdout,
            stderr,
            killed: true,
            duration: Date.now() - startTime,
            signal: 'SIGKILL',
          });
        }, 3000);
      }, timeout);

      // ── Interactive prompt watchdog ──
      const promptWatchdog = setInterval(() => {
        const combinedOutput = stdout + stderr;
        const timeSinceActivity = Date.now() - lastActivityTime;

        // Check if output ends with an interactive prompt
        if (timeSinceActivity > 5000 && !promptDetected) {
          const lastChunk = combinedOutput.slice(-500);
          for (const pattern of INTERACTIVE_PROMPT_PATTERNS) {
            if (pattern.test(lastChunk)) {
              promptDetected = true;
              logger.info(`🔧 Interactive prompt detected in: "${command}". Auto-responding...`);

              // Send common auto-responses
              try {
                child.stdin?.write('\n');
                child.stdin?.write('y\n');
              } catch { /* stdin may be closed */ }

              lastActivityTime = Date.now();
              break;
            }
          }
        }

        // Stall detection: if no output for 45s, something is deeply wrong
        if (timeSinceActivity > 45000 && !killed) {
          logger.info(`🔧 Stall detected (${Math.round(timeSinceActivity / 1000)}s no output). Killing: "${command}"`);
          killed = true;
          if (child.pid) {
            killProcessTree(child.pid);
          }
        }
      }, 3000);

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        lastActivityTime = Date.now();
        if (stdout.length > maxBuffer) {
          stdout = stdout.slice(-maxBuffer);
        }
        onStdout?.(text);
        this.emit('stdout', text);
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        lastActivityTime = Date.now();
        if (stderr.length > maxBuffer) {
          stderr = stderr.slice(-maxBuffer);
        }
        onStderr?.(text);
        this.emit('stderr', text);
      });

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        clearInterval(promptWatchdog);
        resolvePromise({
          exitCode: code,
          stdout,
          stderr,
          killed,
          duration: Date.now() - startTime,
          signal: signal || null,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        clearInterval(promptWatchdog);
        resolvePromise({
          exitCode: 1,
          stdout,
          stderr: stderr + '\n' + err.message,
          killed: false,
          duration: Date.now() - startTime,
          signal: null,
        });
      });
    });
  }

  /** Start a background process that persists */
  startBackground(command: string, cwd?: string): string {
    const id = `bg-${++this.idCounter}`;
    const workDir = resolve(cwd || this.defaultCwd);

    const child = spawn(command, [], {
      cwd: workDir,
      shell: true,
      env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    const bg: BackgroundProcess = {
      id,
      command,
      process: child,
      startedAt: Date.now(),
      stdout: [],
      stderr: [],
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      bg.stdout.push(text);
      // Keep last 100 lines
      if (bg.stdout.length > 100) bg.stdout.shift();
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      bg.stderr.push(text);
      if (bg.stderr.length > 100) bg.stderr.shift();
    });

    child.on('close', (code) => {
      logger.info(`Background process ${id} exited with code ${code}`);
      this.emit('bg-exit', id, code);
    });

    this.processes.set(id, bg);
    logger.info(`Started background process ${id}: ${command}`);
    return id;
  }

  /** Get background process status */
  getBackground(id: string): { running: boolean; stdout: string; stderr: string; duration: number } | null {
    const bg = this.processes.get(id);
    if (!bg) return null;

    return {
      running: !bg.process.killed && bg.process.exitCode === null,
      stdout: bg.stdout.join(''),
      stderr: bg.stderr.join(''),
      duration: Date.now() - bg.startedAt,
    };
  }

  /** Kill a background process with full tree kill */
  killBackground(id: string): boolean {
    const bg = this.processes.get(id);
    if (!bg) return false;
    if (bg.process.pid) {
      killProcessTree(bg.process.pid);
    } else {
      bg.process.kill('SIGTERM');
    }
    this.processes.delete(id);
    return true;
  }

  /** List all background processes */
  listBackground(): Array<{ id: string; command: string; running: boolean; duration: number; port?: number }> {
    return Array.from(this.processes.values()).map(bg => ({
      id: bg.id,
      command: bg.command,
      running: !bg.process.killed && bg.process.exitCode === null,
      duration: Date.now() - bg.startedAt,
      port: bg.port,
    }));
  }

  /** Run multiple commands in parallel */
  async parallel(commands: Array<{ command: string; options?: RunOptions }>): Promise<RunResult[]> {
    return Promise.all(commands.map(c => this.run(c.command, c.options)));
  }

  /** Cleanup all background processes */
  cleanup(): void {
    for (const [id, bg] of this.processes) {
      try {
        if (bg.process.pid) {
          killProcessTree(bg.process.pid);
        } else {
          bg.process.kill('SIGTERM');
        }
      } catch {}
      this.processes.delete(id);
    }
  }
}
