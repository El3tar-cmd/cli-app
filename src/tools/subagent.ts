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

const SUB_AGENT_NAMES = [
  'عبدالرحمن', // Abdelrahman (Strongest, level 0)
  'العطار',      // El-Attar (level 1)
  'الخوارزمي',    // Al-Khwarizmi (level 2)
  'ابن سينا',     // Ibn Sina (level 3)
  'ابن الهيثم',   // Ibn al-Haytham
  'جابر بن حيان', // Jaber Ibn Hayyan
  'الفارابي',    // Al-Farabi
  'البيروني',     // Al-Biruni
  'ابن رشد',     // Ibn Rushd
  'الإدريسي'    // Al-Idrisi
];

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

      const agentName = SUB_AGENT_NAMES[depth % SUB_AGENT_NAMES.length];
      let sandboxManager: SandboxManager | null = null;
      try {
        const isParallel = args.parallel === true;
        const useSandbox = args.sandbox !== false;
        const focusFiles = (args.focusFiles as string[]) || [];

        if (!isParallel) {
          process.stdout.write(chalk.hex(getTheme().warning)(`\n  🤖 Spawning Sub-Agent (${agentName}) for task...\n`));
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
            name: `🤖 [Sub-Agent: ${agentName}] ${data.name}`
          });
        };
        const onSubToolEnd = (data: any) => {
          masterEngine.emit('tool_end', {
            ...data,
            name: `🤖 [Sub-Agent: ${agentName}] ${data.name}`
          });
        };

        subEngine.on('token', onSubToken);
        subEngine.on('tool_start', onSubToolStart);
        subEngine.on('tool_end', onSubToolEnd);

        let result;
        try {
          // Inject context about the delegation
          let prompt = `You are a Sub-Agent named "${agentName}" spawned by the Master NOVA Agent.\nYour specific task: ${args.task}\n`;
          if (focusFiles.length > 0) {
            prompt += `Please focus on these files: ${focusFiles.join(', ')}\n`;
          }
          prompt += `When you are done, summarize your exact changes and results so the Master Agent can continue.`;

          // Execute task
          masterEngine.emit('subagent_spawned', { name: agentName, task: args.task, depth, sandbox: useSandbox });
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
          process.stdout.write(chalk.hex(getTheme().success)(`\n  🏁 Sub-Agent (${agentName}) completed task.\n`));
        }

        masterEngine.emit('subagent_completed', { name: agentName, task: args.task as string, success: true, changes: numChanges });

        return {
          success: true,
          output: `Sub-Agent (${agentName}) Result:\n${result}\n${changesSummary}`,
        };
      } catch (err: any) {
        masterEngine.emit('subagent_completed', { name: agentName, task: args.task as string, success: false, changes: 0 });
        if (sandboxManager) {
          try {
            sandboxManager.destroy();
          } catch {}
        }
        return { success: false, output: '', error: `Sub-Agent (${agentName}) failed: ${err.message}` };
      }
    },
  });

  // ─── Parallel Task Delegation ─────────────────────────────────────────
  registry.register({
    name: 'delegate_parallel_tasks',
    description: 'Spawn multiple independent Sub-Agents simultaneously and run them in parallel. Significantly faster than sequential delegation for unrelated tasks. Each agent gets its own sandbox and clean context. All results are collected and returned after all agents complete.',
    category: 'system',
    requiresConfirmation: true,
    parameters: {
      tasks: 'array',
    },
    handler: async (args): Promise<{ success: boolean; output: string; error?: string }> => {
      if (depth >= MAX_AGENT_DEPTH) {
        return { success: false, output: '', error: `Maximum sub-agent nesting depth (${MAX_AGENT_DEPTH}) reached.` };
      }

      const taskList = args.tasks as Array<{ task: string; focusFiles?: string[]; sandbox?: boolean }>;
      if (!Array.isArray(taskList) || taskList.length === 0) {
        return { success: false, output: '', error: '`tasks` must be a non-empty array of { task, focusFiles?, sandbox? } objects.' };
      }

      process.stdout.write(chalk.hex(getTheme().primary).bold(`\n  🚀 Spawning ${taskList.length} Sub-Agents in parallel...\n`));
      masterEngine.emit('parallel_batch_start', { count: taskList.length, tasks: taskList.map(t => t.task) });

      const runSingleTask = async (
        taskDef: { task: string; focusFiles?: string[]; sandbox?: boolean },
        idx: number
      ): Promise<{
        agentIndex: number;
        agentName: string;
        task: string;
        success: boolean;
        result: string;
        changesSummary: string;
        numChanges: number;
        error?: string;
      }> => {
        const agentName = SUB_AGENT_NAMES[(depth + idx) % SUB_AGENT_NAMES.length];
        let sandboxManager: SandboxManager | null = null;
        try {
          const useSandbox = taskDef.sandbox !== false;
          const focusFiles = taskDef.focusFiles || [];
          let workspacePath = cwd;
          const subTools = new ToolRegistry();

          if (useSandbox) {
            sandboxManager = new SandboxManager(cwd);
            sandboxManager.init(focusFiles);
            workspacePath = sandboxManager.getPath();
            registerBuiltinTools(subTools, workspacePath);
            registerBrowserTools(subTools, workspacePath);
            registerSubagentTools(subTools, workspacePath, config, promptsDir, masterEngine, depth + 1);
          } else {
            registerBuiltinTools(subTools, cwd);
            registerBrowserTools(subTools, cwd);
            registerSubagentTools(subTools, cwd, config, promptsDir, masterEngine, depth + 1);
          }

          const subEngine = new Engine(config, subTools, promptsDir, workspacePath, { silent: true });
          subEngine.setMode('agent');

          const onToken = (token: string) => masterEngine.emit('token', token);
          const onToolStart = (data: any) => masterEngine.emit('tool_start', {
            ...data, name: `🤖 [Parallel Sub-Agent: ${agentName}] ${data.name}`
          });
          const onToolEnd = (data: any) => masterEngine.emit('tool_end', {
            ...data, name: `🤖 [Parallel Sub-Agent: ${agentName}] ${data.name}`
          });

          subEngine.on('token', onToken);
          subEngine.on('tool_start', onToolStart);
          subEngine.on('tool_end', onToolEnd);

          masterEngine.emit('subagent_spawned', {
            name: agentName,
            task: taskDef.task,
            depth,
            sandbox: useSandbox,
            parallel: true,
            agentIndex: idx,
            totalAgents: taskList.length,
          });

          let result = '';
          try {
            let prompt = `You are a Sub-Agent named "${agentName}" (#${idx + 1} of ${taskList.length}) running in parallel.\n`;
            prompt += `Your specific task: ${taskDef.task}\n`;
            if (focusFiles.length > 0) prompt += `Focus on these files: ${focusFiles.join(', ')}\n`;
            prompt += `When done, summarize your exact changes and results concisely so the Master Agent can consolidate all parallel results.`;
            result = await subEngine.processMessage(prompt);
          } finally {
            subEngine.off('token', onToken);
            subEngine.off('tool_start', onToolStart);
            subEngine.off('tool_end', onToolEnd);
          }

          let changesSummary = '';
          let numChanges = 0;
          if (useSandbox && sandboxManager) {
            const changes = sandboxManager.compareChanges();
            numChanges = changes.length;
            for (const change of changes) {
              const realDest = join(cwd, change.path);
              const realDir = dirname(realDest);
              if (change.type === 'NEW' || change.type === 'MODIFY') {
                if (!existsSync(realDir)) mkdirSync(realDir, { recursive: true });
                writeFileSync(realDest, change.content || '', 'utf-8');
              } else if (change.type === 'DELETE') {
                if (existsSync(realDest)) rmSync(realDest, { force: true });
              }
              changesSummary += `   - [${change.type}] ${change.path}\n`;
            }
            sandboxManager.destroy();
          }

          masterEngine.emit('subagent_completed', { name: agentName, task: taskDef.task, success: true, changes: numChanges });
          return { agentIndex: idx, agentName, task: taskDef.task, success: true, result, changesSummary, numChanges };
        } catch (err: any) {
          masterEngine.emit('subagent_completed', { name: agentName, task: taskDef.task, success: false, changes: 0 });
          if (sandboxManager) { try { sandboxManager.destroy(); } catch {} }
          return { agentIndex: idx, agentName, task: taskDef.task, success: false, result: '', changesSummary: '', numChanges: 0, error: err.message };
        }
      };

      // Run all tasks in true parallel
      const results = await Promise.all(taskList.map((t, i) => runSingleTask(t, i)));

      const successCount = results.filter(r => r.success).length;
      const totalChanges = results.reduce((sum, r) => sum + r.numChanges, 0);

      masterEngine.emit('parallel_batch_end', {
        count: taskList.length,
        successCount,
        totalChanges,
        results: results.map(r => ({ task: r.task, success: r.success, changes: r.numChanges })),
      });

      process.stdout.write(
        chalk.hex(getTheme().success)(
          `\n  ✅ Parallel batch complete: ${successCount}/${taskList.length} agents succeeded, ${totalChanges} total file changes.\n`
        )
      );

      const outputLines = results.map((r) => {
        const badge = r.success ? '✅' : '❌';
        const changes = r.numChanges > 0 ? `\n${r.changesSummary}` : '';
        return `${badge} Agent (${r.agentName}): ${r.task}\n${r.result}${changes}`;
      });

      return {
        success: successCount > 0,
        output: `Parallel Execution Results (${successCount}/${taskList.length} succeeded, ${totalChanges} files changed):\n\n${outputLines.join('\n\n---\n\n')}`,
      };
    },
  });
}
