/**
 * 🔧 NOVA Built-in Tools — File, command, git, search, web operations
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import { ToolRegistry, type ToolResult } from './tool-registry.js';
import { AsyncRunner } from '../core/async-runner.js';
import { SecretsScanner } from '../security/secrets-scanner.js';
import { DiffEditor } from './diff-editor.js';
import { registerWebSearchTool } from './web-search.js';

function sanitizePath(p: string): string {
  if (!p) return '';
  let clean = p.replace(/^[\\/]+workspace[\\/]+/, '');
  if (clean.startsWith('/') && process.platform === 'win32') {
    clean = clean.replace(/^\/+/, '');
  }
  return clean;
}

/** Ensure resolved path stays within the project root */
function safePath(cwd: string, rawPath: string): string {
  const resolved = resolve(cwd, sanitizePath(rawPath));
  const normalizedCwd = resolve(cwd);
  if (!resolved.startsWith(normalizedCwd)) {
    throw new Error(`Path traversal blocked: ${rawPath} resolves outside project root`);
  }
  return resolved;
}

export function registerBuiltinTools(registry: ToolRegistry, cwd: string): void {
  const asyncRunner = new AsyncRunner(cwd);
  const secretsScanner = new SecretsScanner();

  // Register web search tool
  registerWebSearchTool(registry, cwd);

  // ── file_read ────────────────────────────────
  registry.register({
    name: 'file_read',
    description: 'Read file contents',
    category: 'file',
    requiresConfirmation: false,
    parameters: { path: 'string', startLine: 'number?', endLine: 'number?' },
    handler: async (args): Promise<ToolResult> => {
      try {
        const filePath = safePath(cwd, args.path as string);
        if (!existsSync(filePath)) return { success: false, output: '', error: `File not found: ${filePath}` };
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
      try {
        const filePath = safePath(cwd, args.path as string);
        const content = args.content as string;

        // Secrets scanning — warn before writing sensitive data
        const scanResult = secretsScanner.scan(content, filePath);
        if (!scanResult.clean) {
          const warning = SecretsScanner.formatFindings(scanResult.findings);
          return { success: false, output: warning, error: 'Secrets detected — write blocked. Remove secrets and try again.' };
        }

        const dir = dirname(filePath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

        const exists = existsSync(filePath);
        const original = exists ? readFileSync(filePath, 'utf-8') : '';

        writeFileSync(filePath, content);
        const lines = content.split('\n').length;
        const diff = DiffEditor.createDiff(original, content, relative(cwd, filePath));

        return {
          success: true,
          output: `✔ Written ${lines} lines to ${relative(cwd, filePath)}`,
          metadata: { diff, isNew: !exists }
        };
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
      try {
        const filePath = safePath(cwd, args.path as string);
        if (!existsSync(filePath)) return { success: false, output: '', error: `File not found: ${filePath}` };
        let content = readFileSync(filePath, 'utf-8');
        const search = args.search as string;
        if (!content.includes(search)) return { success: false, output: '', error: 'Search text not found in file' };
        
        const original = content;
        content = content.replaceAll(search, args.replace as string);
        writeFileSync(filePath, content);
        
        const diff = DiffEditor.createDiff(original, content, relative(cwd, filePath));
        return { 
          success: true, 
          output: `✔ Edited ${relative(cwd, filePath)}`,
          metadata: { diff }
        };
      } catch (err: any) {
        return { success: false, output: '', error: err.message };
      }
    },
  });

  // ── command_run (smart, auto-healing) ────────
  registry.register({
    name: 'command_run',
    description: 'Execute a shell command with smart auto-healing: auto-daemonizes dev servers, resolves port conflicts, detects interactive prompts',
    category: 'command',
    requiresConfirmation: true,
    parameters: { command: 'string', cwd: 'string?', timeout: 'number?' },
    handler: async (args): Promise<ToolResult> => {
      const workDir = args.cwd ? resolve(cwd, sanitizePath(args.cwd as string)) : cwd;
      const timeout = (args.timeout as number) || 30000;
      try {
        const result = await asyncRunner.smartRun(args.command as string, {
          cwd: workDir,
          timeout,
        });

        // If the command was auto-daemonized, return success with daemon info
        if (result.daemonized) {
          return {
            success: true,
            output: result.stdout || `Server daemonized as ${result.daemonId}`,
            metadata: {
              daemonized: true,
              daemonId: result.daemonId,
              port: result.daemonPort,
              duration: result.duration,
            },
          };
        }

        const output = (result.stdout + (result.stderr ? '\n' + result.stderr : '')).trim();
        if (result.killed) {
          return { success: false, output, error: `Command timed out after ${timeout}ms` };
        }
        if (result.exitCode !== 0) {
          // Trigger self-healing diagnostic if we have Ollama and model
          const ollama = registry.getShared('ollama');
          const model = registry.getShared('model');
          if (ollama && model) {
            const errorOutput = (result.stderr || result.stdout || '').trim();
            const diagnosticPrompt = `You are an expert self-healing CLI DevOps agent. A shell command just failed in our workspace.
            
Command run: "${args.command}"
Working directory: "${workDir}"
Exit code: ${result.exitCode}
Error output:
${errorOutput.slice(-1500)}

Analyze why it failed and propose a corrected command or fix step to resolve this error.
Response format: You must return a valid JSON object matching this schema:
{
  "reason": "Clear, concise explanation of why the command failed",
  "proposal": "The exact shell command to run to fix the error (e.g. installing a missing dependency, stopping a process, running with correct flags, etc.). Must be a single line executable string."
}
Only output the JSON object, do not include markdown blocks like \`\`\`json or extra explanations outside the JSON.`;

            try {
              const chatRes = await ollama.chat({
                model,
                messages: [{ role: 'user', content: diagnosticPrompt }],
                format: 'json',
                temperature: 0.1
              });

              if (chatRes && chatRes.content) {
                const parsed = JSON.parse(chatRes.content.trim());
                if (parsed && parsed.proposal) {
                  return {
                    success: false,
                    output: output || 'Command failed',
                    error: `Exit code: ${result.exitCode}`,
                    metadata: {
                      healingProposed: true,
                      reason: parsed.reason,
                      proposal: parsed.proposal
                    }
                  };
                }
              }
            } catch (err) {
              // fallback if diagnostic fails
            }
          }
          return { success: false, output, error: `Exit code: ${result.exitCode}` };
        }
        return {
          success: true,
          output: output || '(no output)',
          metadata: { duration: result.duration, exitCode: result.exitCode },
        };
      } catch (err: any) {
        return { success: false, output: '', error: err.message };
      }
    },
  });

  // ── code_search ──────────────────────────────
  registry.register({
    name: 'code_search',
    description: 'Search for patterns in files',
    category: 'search',
    requiresConfirmation: false,
    parameters: { pattern: 'string', path: 'string?', includes: 'string?', isRegex: 'boolean?' },
    handler: async (args): Promise<ToolResult> => {
      const searchPath = args.path ? resolve(cwd, sanitizePath(args.path as string)) : cwd;
      const pattern = args.pattern as string;
      const includes = args.includes as string || '';
      const isRegex = args.isRegex as boolean || false;
      const isWin = process.platform === 'win32';

      try {
        let output: string;
        if (isWin) {
          // Windows: use findstr with safe argument arrays (no shell injection)
          const findstrArgs = ['/S', '/N', '/I'];
          if (isRegex) {
            findstrArgs.push('/R', pattern);
          } else {
            findstrArgs.push('/C:' + pattern);
          }
          const target = includes ? join(searchPath, includes) : join(searchPath, '*');
          findstrArgs.push(target);
          output = execFileSync('findstr', findstrArgs, { encoding: 'utf-8', timeout: 10000, maxBuffer: 1024 * 1024 }).toString().trim();
        } else {
          // Unix: use grep with safe argument arrays (no shell injection)
          const grepArgs = ['-rnI', isRegex ? '-E' : '-F', '--color=never', pattern, searchPath];
          if (includes) grepArgs.push('--include=' + includes);
          output = execFileSync('grep', grepArgs, { encoding: 'utf-8', timeout: 10000, maxBuffer: 1024 * 1024 }).toString().trim();
        }
        // Limit to 50 lines (replaces piping to head)
        const lines = output.split('\n').filter(Boolean);
        const limited = lines.slice(0, 50).join('\n');
        return { success: true, output: limited || 'No matches found', metadata: { matches: Math.min(lines.length, 50) } };
      } catch (err: any) {
        if (err.status === 1) return { success: true, output: 'No matches found' };
        return { success: true, output: 'No matches found' };
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
      const recursive = args.recursive as boolean || false;

      const listDir = (dir: string, depth = 0, maxDepth = 3): string[] => {
        const lines: string[] = [];
        const indent = '  '.repeat(depth);
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          const ignore = ['node_modules', '.git', 'dist', '.next', '__pycache__', 'coverage', '.turbo'];
          for (const e of entries) {
            if (ignore.includes(e.name) && depth > 0) continue;
            const isDir = e.isDirectory();
            if (isDir) {
              lines.push(`${indent}📁 ${e.name}/`);
              if (recursive && depth < maxDepth) {
                lines.push(...listDir(join(dir, e.name), depth + 1, maxDepth));
              }
            } else {
              const st = statSync(join(dir, e.name));
              const size = st.size < 1024 ? `${st.size}B` : `${(st.size / 1024).toFixed(1)}KB`;
              lines.push(`${indent}📄 ${e.name}  (${size})`);
            }
          }
        } catch {}
        return lines;
      };

      const lines = listDir(dirPath);
      return { success: true, output: lines.join('\n'), metadata: { count: lines.length } };
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
      // Parse extra args safely — split on whitespace, filter empty
      const extraArgs = extra.split(/\s+/).filter(Boolean);

      const gitArgMap: Record<string, string[]> = {
        status: ['status', '--short'],
        diff: ['diff', ...extraArgs],
        log: ['log', '--oneline', '-20', ...extraArgs],
        branch: ['branch', '-a'],
      };
      const gitArgs = gitArgMap[action];
      if (!gitArgs) return { success: false, output: '', error: `Unknown git action: ${action}` };
      try {
        // Use execFileSync to prevent shell injection via extra args
        const output = execFileSync('git', gitArgs, { cwd, encoding: 'utf-8', timeout: 10000 }).toString();
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
      const url = args.url as string;
      // Validate URL scheme to prevent SSRF
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return { success: false, output: '', error: `Invalid URL scheme: ${parsed.protocol}. Only http/https allowed.` };
        }
        // Block private/internal IPs
        const host = parsed.hostname;
        if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|0\.|localhost|\[::1\])/i.test(host)) {
          return { success: false, output: '', error: 'Access to internal/private network addresses is blocked.' };
        }
      } catch {
        return { success: false, output: '', error: `Invalid URL: ${url}` };
      }
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        const text = await res.text();
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
      } catch { }

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
        // Use execFileSync with argument arrays to prevent shell injection
        if (platform === 'win32') execFileSync('cmd', ['/c', 'start', '', url], { timeout: 5000 });
        else if (platform === 'darwin') execFileSync('open', [url], { timeout: 5000 });
        else execFileSync('xdg-open', [url], { timeout: 5000 });
        return { success: true, output: `✔ Opened browser: ${url}` };
      } catch (err: any) {
        return { success: false, output: '', error: `Failed to open browser: ${err.message}` };
      }
    },
  });

  // ── git_commit ──────────────────────────────
  registry.register({
    name: 'git_commit',
    description: 'Stage files and create a git commit. If no message is provided, the message should be generated by the AI.',
    category: 'git',
    requiresConfirmation: true,
    parameters: { message: 'string', files: 'string?', all: 'boolean?' },
    handler: async (args): Promise<ToolResult> => {
      const message = args.message as string;
      const files = args.files as string || '';
      const all = args.all as boolean || false;
      try {
        // Stage files
        if (all) {
          execSync('git add -A', { cwd, encoding: 'utf-8', timeout: 10000 });
        } else if (files) {
          execSync(`git add ${files}`, { cwd, encoding: 'utf-8', timeout: 10000 });
        }

        // Check if there's anything to commit
        const status = execSync('git status --porcelain', { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
        if (!status) {
          return { success: true, output: 'Nothing to commit — working tree clean' };
        }

        // Commit — use execFileSync to prevent shell injection via commit message
        const output = execFileSync('git', ['commit', '-m', message], { cwd, encoding: 'utf-8', timeout: 10000 }).toString();
        return { success: true, output: `✔ Committed:\n${output.trim()}` };
      } catch (err: any) {
        return { success: false, output: '', error: err.message };
      }
    },
  });

  // ── file_patch (unified diff) ────────────────
  registry.register({
    name: 'file_patch',
    description: 'Apply a unified diff patch to a file. Use this for precise multi-hunk edits.',
    category: 'file',
    requiresConfirmation: true,
    parameters: { path: 'string', patch: 'string' },
    handler: async (args): Promise<ToolResult> => {
      try {
        const filePath = safePath(cwd, args.path as string);
        const result = DiffEditor.applyPatch(filePath, args.patch as string);
        if (result.success) {
          return {
            success: true,
            output: `✔ Patch applied to ${relative(cwd, filePath)} (${result.hunksApplied} hunks)`,
            metadata: { hunksApplied: result.hunksApplied, diff: result.preview },
          };
        }
        return { success: false, output: '', error: result.error || 'Patch failed' };
      } catch (err: any) {
        return { success: false, output: '', error: err.message };
      }
    },
  });

  // ── file_multi_edit (atomic batch edits) ─────
  registry.register({
    name: 'file_multi_edit',
    description: 'Apply multiple search/replace edits to a file atomically. All edits succeed or all roll back.',
    category: 'file',
    requiresConfirmation: true,
    parameters: { path: 'string', edits: 'string' },
    handler: async (args): Promise<ToolResult> => {
      try {
        const filePath = safePath(cwd, args.path as string);
        let edits: Array<{ search: string; replace: string }>;
        try {
          edits = JSON.parse(args.edits as string);
        } catch {
          return { success: false, output: '', error: 'edits must be a JSON array of {search, replace} objects' };
        }
        const result = DiffEditor.multiEdit(filePath, edits);
        if (result.success) {
          return {
            success: true,
            output: `✔ Applied ${result.hunksApplied} edits to ${relative(cwd, filePath)}`,
            metadata: { applied: result.hunksApplied, failed: result.hunksFailed, diff: result.preview },
          };
        }
        return { success: false, output: '', error: result.error || 'Multi-edit failed' };
      } catch (err: any) {
        return { success: false, output: '', error: err.message };
      }
    },
  });

  // ── sequential_thinking (server-side stateful) ──
  let thinkSession = { thoughts: [] as string[], total: 3, done: false };
  registry.register({
    name: 'sequential_thinking',
    description: 'Record a thinking step for complex problem-solving. Call multiple times to build a chain of thought. The server auto-tracks step numbers — just provide your thought text.',
    category: 'system',
    requiresConfirmation: false,
    parameters: {
      thought: 'string',
      totalThoughts: 'number?',
      done: 'boolean?',
    },
    handler: async (args): Promise<ToolResult> => {
      // Reset session if previous was completed
      if (thinkSession.done) {
        thinkSession = { thoughts: [], total: 3, done: false };
      }

      // Update total if provided (first call usually sets this)
      if (args.totalThoughts && thinkSession.thoughts.length === 0) {
        thinkSession.total = Math.min(args.totalThoughts as number, 10);
      }

      // Record thought
      thinkSession.thoughts.push(args.thought as string);
      const step = thinkSession.thoughts.length;

      // Auto-complete if we hit the target or LLM says done
      if (args.done || step >= thinkSession.total) {
        thinkSession.done = true;
        return {
          success: true,
          output: `✔ Thinking complete (${step} steps). Proceed with implementation.`,
        };
      }

      return {
        success: true,
        output: `Step ${step}/${thinkSession.total} recorded. Call sequential_thinking again with your next thought (step ${step + 1}).`,
      };
    },
  });

  // ── update_state (Scratchpad) ────────────────────────────
  registry.register({
    name: 'update_state',
    description: 'Update the agent scratchpad with current task state. MUST be called after every significant action to maintain focus in long tasks. Updates are additive for completed/failedAttempts/decisions arrays.',
    category: 'memory',
    requiresConfirmation: false,
    parameters: {
      goal: 'string?',
      currentTask: 'string?',
      phase: 'string?',
      completed: 'string[]?',
      failedAttempts: 'string[]?',
      nextSteps: 'string[]?',
      constraints: 'string[]?',
      keyFiles: 'string[]?',
      decisions: 'string[]?',
    },
    handler: async (args): Promise<ToolResult> => {
      try {
        // The scratchpad instance is injected via the registry's context
        const scratchpad = registry.getShared('scratchpad');
        if (!scratchpad) {
          return { success: false, output: '', error: 'Scratchpad not initialized' };
        }

        const update: Record<string, any> = {};
        if (args.goal) update.goal = args.goal;
        if (args.currentTask) update.currentTask = args.currentTask;
        if (args.phase) update.phase = args.phase;
        if (args.completed) update.completed = Array.isArray(args.completed) ? args.completed : [args.completed];
        if (args.failedAttempts) update.failedAttempts = Array.isArray(args.failedAttempts) ? args.failedAttempts : [args.failedAttempts];
        if (args.nextSteps) update.nextSteps = Array.isArray(args.nextSteps) ? args.nextSteps : [args.nextSteps];
        if (args.constraints) update.constraints = Array.isArray(args.constraints) ? args.constraints : [args.constraints];
        if (args.keyFiles) update.keyFiles = Array.isArray(args.keyFiles) ? args.keyFiles : [args.keyFiles];
        if (args.decisions) update.decisions = Array.isArray(args.decisions) ? args.decisions : [args.decisions];

        const state = scratchpad.update(update);

        return {
          success: true,
          output: `✔ State updated (step ${state.stepCount}). Phase: ${state.phase}. Goal: ${state.goal}`,
        };
      } catch (err: any) {
        return { success: false, output: '', error: err.message };
      }
    },
  });

  // ── recall_memory (Vector RAG) ────────────────────────────
  registry.register({
    name: 'recall_memory',
    description: 'Search long-term memory for relevant past interactions, code, decisions, or errors. Use this when you need to recall something from earlier in a long session or from a previous session.',
    category: 'memory',
    requiresConfirmation: false,
    parameters: {
      query: 'string',
      category: 'string?',
      topK: 'number?',
    },
    handler: async (args): Promise<ToolResult> => {
      try {
        const vectorMemory = registry.getShared('vectorMemory');
        if (!vectorMemory || !vectorMemory.isReady()) {
          return { success: true, output: 'Vector memory not available. Proceeding without long-term recall.' };
        }

        const results = await vectorMemory.retrieve(
          args.query as string,
          (args.topK as number) || 3,
          args.category as string | undefined
        );

        if (results.length === 0) {
          return { success: true, output: 'No relevant memories found.' };
        }

        const formatted = results.map((r: any, i: number) => {
          const age = Math.round((Date.now() - r.timestamp) / 60000);
          return `[${i + 1}] (${r.category}, ${age}min ago, sim=${r.similarity.toFixed(2)})\n${r.content}`;
        }).join('\n\n');

        return { success: true, output: `Found ${results.length} relevant memories:\n\n${formatted}` };
      } catch (err: any) {
        return { success: false, output: '', error: err.message };
      }
    },
  });

  // ── workspace_problems ────────────────────────────
  registry.register({
    name: 'workspace_problems',
    description: 'Scan the workspace for static analysis, typescript, linting, and compilation errors/warnings, similar to the IDE\'s "Problems" tab. Auto-detects project type.',
    category: 'system',
    requiresConfirmation: false,
    parameters: {
      path: 'string?',
    },
    handler: async (args): Promise<ToolResult> => {
      const targetCwd = args.path ? resolve(cwd, sanitizePath(args.path as string)) : cwd;
      const problems: Array<{ file: string; line: number; col: number; severity: 'error' | 'warning'; message: string; code?: string }> = [];

      // Helper to execute and parse commands
      const runCommand = (cmd: string, argsList: string[]): string => {
        try {
          return execFileSync(cmd, argsList, { cwd: targetCwd, encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
        } catch (err: any) {
          if (err.code === 'ENOENT') {
            return ''; // Executable not installed, ignore gracefully
          }
          return (err.stdout || '') + '\n' + (err.stderr || '');
        }
      };

      const hasPackage = (pkg: string): boolean => {
        try {
          const pkgJsonPath = join(targetCwd, 'package.json');
          if (existsSync(pkgJsonPath)) {
            const pkgData = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
            return !!(pkgData.dependencies?.[pkg] || pkgData.devDependencies?.[pkg]);
          }
        } catch {}
        return false;
      };

      // 1. TypeScript diagnostics
      const tsConfigExists = existsSync(join(targetCwd, 'tsconfig.json'));
      if (tsConfigExists) {
        // Run tsc --noEmit
        const tscOutput = runCommand(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--noEmit', '--pretty', 'false']);
        
        // Parse TypeScript error lines: e.g. "src/core/telegram-bot.ts:741:32 - error TS2339: Property 'config' does not exist on type 'TelegramBotService'."
        const tsLines = tscOutput.split('\n');
        for (const line of tsLines) {
          const match = line.match(/^([^(].+?):(\d+):(\d+)\s*-\s*(error|warning)\s+([A-Z0-9]+):\s*(.+)$/i);
          if (match) {
            problems.push({
              file: match[1].trim(),
              line: parseInt(match[2], 10),
              col: parseInt(match[3], 10),
              severity: match[4].toLowerCase() === 'warning' ? 'warning' : 'error',
              code: match[5].trim(),
              message: match[6].trim(),
            });
          }
        }
      }

      // 2. ESLint diagnostics
      const hasEslint = hasPackage('eslint') || 
                        existsSync(join(targetCwd, '.eslintrc.json')) || 
                        existsSync(join(targetCwd, '.eslintrc.js')) || 
                        existsSync(join(targetCwd, 'eslint.config.js')) || 
                        existsSync(join(targetCwd, 'eslint.config.mjs'));
      if (hasEslint) {
        const eslintOutput = runCommand(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['eslint', '.', '--format', 'compact']);
        const esLines = eslintOutput.split('\n');
        for (const line of esLines) {
          const match = line.match(/^(.+?):\s*line\s*(\d+),\s*col\s*(\d+),\s*(Error|Warning)\s*-\s*(.+?)(?:\s*\((.+)\))?$/i);
          if (match) {
            const relPath = relative(targetCwd, match[1].trim());
            problems.push({
              file: relPath,
              line: parseInt(match[2], 10),
              col: parseInt(match[3], 10),
              severity: match[4].toLowerCase() === 'warning' ? 'warning' : 'error',
              message: match[5].trim(),
              code: match[6] ? match[6].trim() : undefined,
            });
          }
        }
      }

      // 3. Rust Diagnostics
      if (existsSync(join(targetCwd, 'Cargo.toml'))) {
        const cargoOutput = runCommand('cargo', ['check', '--message-format=short']);
        const cargoLines = cargoOutput.split('\n');
        for (const line of cargoLines) {
          const match = line.match(/^(.+?):(\d+):(\d+):\s*(error|warning):\s*(.+)$/i);
          if (match) {
            problems.push({
              file: match[1].trim(),
              line: parseInt(match[2], 10),
              col: parseInt(match[3], 10),
              severity: match[4].toLowerCase() === 'warning' ? 'warning' : 'error',
              message: match[5].trim(),
            });
          }
        }
      }

      // 4. Python Diagnostics
      if (existsSync(join(targetCwd, 'requirements.txt')) || existsSync(join(targetCwd, 'pyproject.toml'))) {
        const mypyOutput = runCommand('mypy', ['.', '--hide-error-context', '--no-color']);
        if (mypyOutput && !mypyOutput.includes('not found') && !mypyOutput.includes('command not found')) {
          const pyLines = mypyOutput.split('\n');
          for (const line of pyLines) {
            const match = line.match(/^(.+?):(\d+):\s*(error|warning|note):\s*(.+?)(?:\s*\[(.+)\])?$/i);
            if (match) {
              problems.push({
                file: match[1].trim(),
                line: parseInt(match[2], 10),
                col: 0,
                severity: match[3].toLowerCase() === 'error' ? 'error' : 'warning',
                message: match[4].trim(),
                code: match[5] ? match[5].trim() : undefined,
              });
            }
          }
        }
      }

      // 5. Go Diagnostics
      if (existsSync(join(targetCwd, 'go.mod'))) {
        const goOutput = runCommand('go', ['vet', './...']);
        const goLines = goOutput.split('\n');
        for (const line of goLines) {
          const match = line.match(/^(.+?):(\d+):(\d+):\s*(.+)$/);
          if (match) {
            problems.push({
              file: match[1].trim(),
              line: parseInt(match[2], 10),
              col: parseInt(match[3], 10),
              severity: 'error',
              message: match[4].trim(),
            });
          }
        }
      }

      if (problems.length === 0) {
        return {
          success: true,
          output: '✨ No problems found in the workspace! Working tree is completely healthy.',
        };
      }

      const formatted = problems.map(p => {
        const sevIcon = p.severity === 'error' ? '❌' : '⚠️';
        const codeStr = p.code ? ` (${p.code})` : '';
        return `[${p.file}:${p.line}:${p.col}] ${sevIcon} ${p.severity.toUpperCase()}: ${p.message}${codeStr}`;
      }).join('\n');

      return {
        success: true,
        output: `🔍 Found ${problems.length} problems in the workspace:\n\n${formatted}`,
        metadata: { count: problems.length, problems },
      };
    },
  });
}

