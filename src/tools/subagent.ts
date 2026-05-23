import { writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import chalk from 'chalk';
import { Engine } from '../core/engine.js';
import { ToolRegistry } from './tool-registry.js';
import { registerBuiltinTools } from './built-in.js';
import { registerBrowserTools } from './browser.js';
import { SandboxManager } from '../utils/sandbox.js';
import { getTheme } from '../ui/theme.js';
import { ConfigManager } from '../core/config.js';

const MAX_AGENT_DEPTH = 3;

export function registerSubagentTools(
  registry: ToolRegistry,
  cwd: string,
  config: ConfigManager,
  promptsDir: string,
  masterEngine: Engine,
  depth: number = 0
): void {
  registry.register({
    name: 'delegate_task',
    description: 'Delegate a complex sub-task to a fresh Sub-Agent. The Sub-Agent starts with a clean context window, preventing pollution of the master context. Use this for building isolated features, writing specific tests, or debugging isolated files.',
    category: 'system',
    requiresConfirmation: true, // Always ask before spawning a sub-agent to prevent infinite loops
    parameters: {
      task: 'string',
      focusFiles: 'string[]?',
      sandbox: 'boolean?',
      parallel: 'boolean?',
    },
    handler: async (args): Promise<{ success: boolean; output: string; error?: string }> => {
      if (depth >= MAX_AGENT_DEPTH) {
        return { success: false, output: '', error: `Maximum sub-agent nesting depth (${MAX_AGENT_DEPTH}) reached. Cannot spawn deeper sub-agents.` };
      }

      let sandboxManager: SandboxManager | null = null;
      try {
        const isParallel = args.parallel === true;
        const useSandbox = args.sandbox !== false;
        const focusFiles = (args.focusFiles as string[]) || [];

        if (!isParallel) {
          process.stdout.write(chalk.hex(getTheme().warning)(`\n  🤖 Spawning Sub-Agent for task...\n`));
        }

        let workspacePath = cwd;
        const subTools = new ToolRegistry();

        if (useSandbox) {
          sandboxManager = new SandboxManager(cwd);
          sandboxManager.init(focusFiles);
          workspacePath = sandboxManager.getPath();
          
          // Bind tool registry to the sandbox path
          registerBuiltinTools(subTools, workspacePath);
          registerBrowserTools(subTools, workspacePath);
          
          // Allow subagent to spawn child agents recursively using the sandbox as their Cwd
          registerSubagentTools(subTools, workspacePath, config, promptsDir, masterEngine, depth + 1);
          
          if (!isParallel) {
            process.stdout.write(chalk.hex(getTheme().info)(`     Sandbox workspace created at: ${workspacePath}\n`));
          }
        } else {
          // Bind tool registry to the regular workspace path
          registerBuiltinTools(subTools, cwd);
          registerBrowserTools(subTools, cwd);
          registerSubagentTools(subTools, cwd, config, promptsDir, masterEngine, depth + 1);
        }

        // Spawn a fresh engine with the same config and tools
        const subEngine = new Engine(config, subTools, promptsDir, workspacePath, { silent: isParallel });
        subEngine.setMode('agent'); // Sub-agents are autonomous

        // Forward events to the master engine so WebSocket server / Web UI / Telegram Bot broadcast them
        const onSubToken = (token: string) => {
          masterEngine.emit('token', token);
        };
        const onSubToolStart = (data: any) => {
          masterEngine.emit('tool_start', {
            ...data,
            name: `🤖 [Sub-Agent] ${data.name}`
          });
        };
        const onSubToolEnd = (data: any) => {
          masterEngine.emit('tool_end', {
            ...data,
            name: `🤖 [Sub-Agent] ${data.name}`
          });
        };

        subEngine.on('token', onSubToken);
        subEngine.on('tool_start', onSubToolStart);
        subEngine.on('tool_end', onSubToolEnd);

        let result;
        try {
          // Inject context about the delegation
          let prompt = `You are a Sub-Agent spawned by the Master NOVA Agent.\nYour specific task: ${args.task}\n`;
          if (focusFiles.length > 0) {
            prompt += `Please focus on these files: ${focusFiles.join(', ')}\n`;
          }
          prompt += `When you are done, summarize your exact changes and results so the Master Agent can continue.`;

          // Execute task
          masterEngine.emit('subagent_spawned', { task: args.task, depth, sandbox: useSandbox });
          result = await subEngine.processMessage(prompt);
        } finally {
          // Clean up listeners to prevent memory leaks
          subEngine.off('token', onSubToken);
          subEngine.off('tool_start', onSubToolStart);
          subEngine.off('tool_end', onSubToolEnd);
        }

        // Handle sandboxed changes integration
        let changesSummary = '';
        let numChanges = 0;
        if (useSandbox && sandboxManager) {
          const changes = sandboxManager.compareChanges();
          numChanges = changes.length;
          if (changes.length > 0) {
            changesSummary = `\n📦 Sandboxed Changes Detected and Applied:\n`;
            if (!isParallel) {
              process.stdout.write(chalk.hex(getTheme().primary).bold(`\n  📦 Sandboxed Changes Detected:\n`));
            }

            for (const change of changes) {
              const realDest = join(cwd, change.path);
              const realDir = dirname(realDest);

              if (change.type === 'NEW' || change.type === 'MODIFY') {
                if (!isParallel) {
                  const color = change.type === 'NEW' ? chalk.green : chalk.cyan;
                  process.stdout.write(color(`     [${change.type}] ${change.path}\n`));
                }
                changesSummary += `   - [${change.type}] ${change.path}\n`;

                // Apply change to real workspace
                if (!existsSync(realDir)) {
                  mkdirSync(realDir, { recursive: true });
                }
                writeFileSync(realDest, change.content || '', 'utf-8');
              } else if (change.type === 'DELETE') {
                if (!isParallel) {
                  process.stdout.write(chalk.red(`     [DELETE] ${change.path}\n`));
                }
                changesSummary += `   - [DELETE] ${change.path}\n`;

                // Apply deletion to real workspace
                if (existsSync(realDest)) {
                  rmSync(realDest, { force: true });
                }
              }
            }
          } else {
            changesSummary = `\nNo changes were made in the sandbox.\n`;
            if (!isParallel) {
              process.stdout.write(chalk.hex(getTheme().muted)(`     No changes made in sandbox.\n`));
            }
          }
          
          // Destroy sandbox
          sandboxManager.destroy();
        }

        if (!isParallel) {
          process.stdout.write(chalk.hex(getTheme().success)(`\n  🏁 Sub-Agent completed task.\n`));
        }

        masterEngine.emit('subagent_completed', { task: args.task as string, success: true, changes: numChanges });

        return {
          success: true,
          output: `Sub-Agent Result:\n${result}\n${changesSummary}`,
        };
      } catch (err: any) {
        masterEngine.emit('subagent_completed', { task: args.task as string, success: false, changes: 0 });
        if (sandboxManager) {
          try {
            sandboxManager.destroy();
          } catch {}
        }
        return { success: false, output: '', error: `Sub-Agent failed: ${err.message}` };
      }
    },
  });
}
