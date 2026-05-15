/**
 * 🔧 NOVA Built-in Tools — File, command, git, search, web operations
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { ToolRegistry, type ToolResult } from './tool-registry.js';

function sanitizePath(p: string): string {
  if (!p) return '';
  let clean = p.replace(/^[\\/]+workspace[\\/]+/, '');
  if (clean.startsWith('/') && process.platform === 'win32') {
    clean = clean.replace(/^\/+/, '');
  }
  return clean;
}

export function registerBuiltinTools(registry: ToolRegistry, cwd: string): void {
  // ── file_read ────────────────────────────────
  registry.register({
    name: 'file_read',
    description: 'Read file contents',
    category: 'file',
    requiresConfirmation: false,
    parameters: { path: 'string', startLine: 'number?', endLine: 'number?' },
    handler: async (args): Promise<ToolResult> => {
      const filePath = resolve(cwd, sanitizePath(args.path as string));
      if (!existsSync(filePath)) return { success: false, output: '', error: `File not found: ${filePath}` };
      try {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const start = ((args.startLine as number) || 1) - 1;
        const end = (args.endLine as number) || lines.length;
        const selected = lines.slice(start, end);
        const numbered = selected.map((l, i) => `${(start + i + 1).toString().padStart(4)} │ ${l}`).join('\n');
        return { success: true, output: numbered, metadata: { lines: lines.length, path: filePath } };
      } catch (err: any) {
        return { success: false, output: '', error: err.message };
      }
    },
  });

  // ── file_write ───────────────────────────────
  registry.register({
    name: 'file_write',
    description: 'Create or overwrite a file',
    category: 'file',
    requiresConfirmation: true,
    parameters: { path: 'string', content: 'string' },
    handler: async (args): Promise<ToolResult> => {
      const filePath = resolve(cwd, sanitizePath(args.path as string));
      try {
        const dir = dirname(filePath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(filePath, args.content as string);
        const lines = (args.content as string).split('\n').length;
        return { success: true, output: `✔ Written ${lines} lines to ${relative(cwd, filePath)}` };
      } catch (err: any) {
        return { success: false, output: '', error: err.message };
      }
    },
  });

  // ── file_edit ────────────────────────────────
  registry.register({
    name: 'file_edit',
    description: 'Edit a file by replacing content',
    category: 'file',
    requiresConfirmation: true,
    parameters: { path: 'string', search: 'string', replace: 'string' },
    handler: async (args): Promise<ToolResult> => {
      const filePath = resolve(cwd, sanitizePath(args.path as string));
      if (!existsSync(filePath)) return { success: false, output: '', error: `File not found: ${filePath}` };
      try {
        let content = readFileSync(filePath, 'utf-8');
        const search = args.search as string;
        if (!content.includes(search)) return { success: false, output: '', error: 'Search text not found in file' };
        content = content.replace(search, args.replace as string);
        writeFileSync(filePath, content);
        return { success: true, output: `✔ Edited ${relative(cwd, filePath)}` };
      } catch (err: any) {
        return { success: false, output: '', error: err.message };
      }
    },
  });

  // ── command_run ──────────────────────────────
  registry.register({
    name: 'command_run',
    description: 'Execute a shell command',
    category: 'command',
    requiresConfirmation: true,
    parameters: { command: 'string', cwd: 'string?', timeout: 'number?' },
    handler: async (args): Promise<ToolResult> => {
      const workDir = args.cwd ? resolve(cwd, sanitizePath(args.cwd as string)) : cwd;
      const timeout = (args.timeout as number) || 30000;
      try {
        const output = execSync(args.command as string, {
          cwd: workDir,
          encoding: 'utf-8',
          timeout,
          maxBuffer: 1024 * 1024 * 5,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { success: true, output: output || '(no output)' };
      } catch (err: any) {
        const output = err.stdout || '';
        const stderr = err.stderr || '';
        return { success: false, output: output + '\n' + stderr, error: `Exit code: ${err.status}` };
      }
    },
  });

  // ── code_search ──────────────────────────────
  registry.register({
    name: 'code_search',
    description: 'Search for patterns in files',
    category: 'search',
    requiresConfirmation: false,
    parameters: { pattern: 'string', path: 'string?', includes: 'string?' },
    handler: async (args): Promise<ToolResult> => {
      const searchPath = args.path ? resolve(cwd, sanitizePath(args.path as string)) : cwd;
      const pattern = args.pattern as string;
      const includes = args.includes as string || '';
      try {
        let cmd = `grep -rnI --color=never "${pattern.replace(/"/g, '\\"')}" "${searchPath}"`;
        if (includes) cmd += ` --include="${includes}"`;
        cmd += ' | head -50';
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000, maxBuffer: 1024 * 1024 }).trim();
        const lines = output.split('\n').filter(Boolean);
        return { success: true, output: output || 'No matches found', metadata: { matches: lines.length } };
      } catch (err: any) {
        if (err.status === 1) return { success: true, output: 'No matches found' };
        // Try findstr on Windows
        try {
          let cmd = `findstr /S /N /I "${pattern}" "${searchPath}\\*"`;
          if (includes) cmd = `findstr /S /N /I "${pattern}" "${searchPath}\\${includes}"`;
          const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim();
          return { success: true, output: output || 'No matches found' };
        } catch {
          return { success: true, output: 'No matches found' };
        }
      }
    },
  });

  // ── list_directory ───────────────────────────
  registry.register({
    name: 'list_directory',
    description: 'List directory contents',
    category: 'file',
    requiresConfirmation: false,
    parameters: { path: 'string', recursive: 'boolean?' },
    handler: async (args): Promise<ToolResult> => {
      const dirPath = resolve(cwd, sanitizePath((args.path as string) || '.'));
      if (!existsSync(dirPath)) return { success: false, output: '', error: `Directory not found: ${dirPath}` };
      try {
        const entries = readdirSync(dirPath, { withFileTypes: true });
        const lines = entries.map((e) => {
          const isDir = e.isDirectory();
          const name = isDir ? `📁 ${e.name}/` : `📄 ${e.name}`;
          if (!isDir) {
            const st = statSync(join(dirPath, e.name));
            const size = st.size < 1024 ? `${st.size}B` : `${(st.size / 1024).toFixed(1)}KB`;
            return `${name}  (${size})`;
          }
          return name;
        });
        return { success: true, output: lines.join('\n'), metadata: { count: entries.length } };
      } catch (err: any) {
        return { success: false, output: '', error: err.message };
      }
    },
  });

  // ── git_status ───────────────────────────────
  registry.register({
    name: 'git_status',
    description: 'Git operations',
    category: 'git',
    requiresConfirmation: false,
    parameters: { action: 'string', args: 'string?' },
    handler: async (args): Promise<ToolResult> => {
      const action = args.action as string;
      const extra = (args.args as string) || '';
      const cmds: Record<string, string> = {
        status: 'git status --short',
        diff: `git diff ${extra}`.trim(),
        log: `git log --oneline -20 ${extra}`.trim(),
        branch: 'git branch -a',
      };
      const cmd = cmds[action];
      if (!cmd) return { success: false, output: '', error: `Unknown git action: ${action}` };
      try {
        const output = execSync(cmd, { cwd, encoding: 'utf-8', timeout: 10000 });
        return { success: true, output: output || '(clean)' };
      } catch (err: any) {
        return { success: false, output: '', error: err.message };
      }
    },
  });

  // ── web_fetch ────────────────────────────────
  registry.register({
    name: 'web_fetch',
    description: 'Fetch URL content',
    category: 'web',
    requiresConfirmation: false,
    parameters: { url: 'string' },
    handler: async (args): Promise<ToolResult> => {
      try {
        const res = await fetch(args.url as string, { signal: AbortSignal.timeout(15000) });
        const text = await res.text();
        // Strip HTML tags for basic text extraction
        const clean = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 5000);
        return { success: true, output: clean };
      } catch (err: any) {
        return { success: false, output: '', error: err.message };
      }
    },
  });

  // ── project_analyze ──────────────────────────
  registry.register({
    name: 'project_analyze',
    description: 'Analyze project structure',
    category: 'system',
    requiresConfirmation: false,
    parameters: { path: 'string' },
    handler: async (args): Promise<ToolResult> => {
      const projPath = resolve(cwd, (args.path as string) || '.');
      const info: string[] = ['## Project Analysis\n'];

      // Package.json
      const pkgPath = join(projPath, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        info.push(`**Name:** ${pkg.name || 'unnamed'}`);
        info.push(`**Version:** ${pkg.version || 'N/A'}`);
        info.push(`**Type:** Node.js / ${pkg.type === 'module' ? 'ESM' : 'CJS'}`);
        if (pkg.dependencies) info.push(`**Dependencies:** ${Object.keys(pkg.dependencies).length}`);
        if (pkg.devDependencies) info.push(`**Dev Dependencies:** ${Object.keys(pkg.devDependencies).length}`);
        const frameworks = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
        if (frameworks.includes('next')) info.push('**Framework:** Next.js');
        else if (frameworks.includes('react')) info.push('**Framework:** React');
        else if (frameworks.includes('vue')) info.push('**Framework:** Vue');
        else if (frameworks.includes('express')) info.push('**Framework:** Express');
      }

      // Tech detection
      if (existsSync(join(projPath, 'tsconfig.json'))) info.push('**Language:** TypeScript');
      if (existsSync(join(projPath, '.gitignore'))) info.push('**VCS:** Git');
      if (existsSync(join(projPath, 'Dockerfile'))) info.push('**Container:** Docker');

      // File count
      try {
        const files = readdirSync(projPath);
        info.push(`**Root files:** ${files.length}`);
      } catch {}

      return { success: true, output: info.join('\n') };
    },
  });

  // ── browser_open ──────────────────────────────
  registry.register({
    name: 'browser_open',
    description: 'Open a URL or local file in the default browser. Use this to preview websites, documentation, or local dev servers.',
    category: 'web',
    requiresConfirmation: false,
    parameters: { url: 'string' },
    handler: async (args): Promise<ToolResult> => {
      const url = args.url as string;
      try {
        const platform = process.platform;
        let cmd: string;
        if (platform === 'win32') cmd = `start "" "${url}"`;
        else if (platform === 'darwin') cmd = `open "${url}"`;
        else cmd = `xdg-open "${url}"`;
        execSync(cmd, { timeout: 5000 });
        return { success: true, output: `✔ Opened browser: ${url}` };
      } catch (err: any) {
        return { success: false, output: '', error: `Failed to open browser: ${err.message}` };
      }
    },
  });
}
