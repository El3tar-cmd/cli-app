#!/usr/bin/env node

/**
 * 🚀 NOVA CLI — Entry Point
 * Next-gen Orchestrated Virtual Assistant
 * 
 * Usage:
 *   nova                    — Interactive mode
 *   nova "fix the bug"      — One-shot mode
 *   nova --mode plan "..."  — Planning mode
 *   nova --model llama3.2   — Use specific model
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';

// Store spans in global memory instead of spamming stdout
class GlobalSpanExporter implements SpanExporter {
  export(spans: ReadableSpan[], resultCallback: (result: any) => void): void {
    if (!(globalThis as any).novaSpans) {
      (globalThis as any).novaSpans = [];
    }
    (globalThis as any).novaSpans.push(...spans);
    // Limit cache to last 50 spans
    if ((globalThis as any).novaSpans.length > 50) {
      (globalThis as any).novaSpans = (globalThis as any).novaSpans.slice(-50);
    }
    resultCallback({ code: 0 });
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

const sdk = new NodeSDK({
  traceExporter: new GlobalSpanExporter(),
  instrumentations: [new HttpInstrumentation()],
});
sdk.start();

import { Command } from 'commander';
import { Nova } from './nova.js';
import { APP_VERSION, APP_DESCRIPTION } from './utils/constants.js';

const program = new Command();

program
  .name('nova')
  .description(`🚀 ${APP_DESCRIPTION}`)
  .version(APP_VERSION, '-v, --version')
  .option('-m, --model <model>', 'Ollama model to use')
  .option('--mode <mode>', 'Operating mode (chat|fast|plan|code|agent)', 'chat')
  .option('--cwd <path>', 'Working directory', process.cwd())
  .option('--no-animation', 'Skip startup animation')
  .argument('[prompt...]', 'One-shot prompt (optional)')
  .action(async (promptParts: string[], options) => {
    const prompt = promptParts.join(' ').trim();
    const oneShot = prompt || undefined;

    const nova = new Nova({
      model: options.model,
      mode: options.mode,
      cwd: options.cwd,
      noAnimation: oneShot ? true : !options.animation,
      oneShot,
    });

    await nova.start();
  });

program
  .command('ui')
  .description('Launch NOVA Studio (Local Web Dashboard)')
  .option('-p, --port <number>', 'Port for the server', '3141')
  .action(async (options) => {
    // Dynamically import to avoid loading UI deps if not needed
    const { NovaStudioServer } = await import('./ui/server.js');
    const { Engine } = await import('./core/engine.js');
    const { ConfigManager } = await import('./core/config.js');
    const { ToolRegistry } = await import('./tools/tool-registry.js');
    const { registerBuiltinTools } = await import('./tools/built-in.js');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const config = new ConfigManager();
    const tools = new ToolRegistry();
    registerBuiltinTools(tools, process.cwd());

    const { McpClient } = await import('./core/mcp-client.js');
    const mcpClient = new McpClient(tools, process.cwd());
    await mcpClient.init();

    const { registerSubagentTools } = await import('./tools/subagent.js');

    const promptsDir = join(__dirname, '..', 'prompts');

    const engine = new Engine(config, tools, promptsDir, process.cwd());
    registerSubagentTools(tools, process.cwd(), config, promptsDir, engine);
    const server = new NovaStudioServer(engine, parseInt(options.port));
    
    await server.start();

    const cleanup = () => {
      mcpClient.cleanup();
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // Automatically open browser
    const { exec } = await import('node:child_process');
    const url = `http://localhost:${options.port}?token=${server.getAuthToken()}`;
    if (process.platform === 'win32') {
      exec(`start "${url}"`);
    } else if (process.platform === 'darwin') {
      exec(`open "${url}"`);
    } else {
      exec(`xdg-open "${url}"`);
    }
  });

program
  .command('telegram')
  .description('Launch NOVA Telegram Bot Gateway')
  .requiredOption('-t, --token <string>', 'Telegram Bot Token')
  .requiredOption('-a, --allowed <numbers>', 'Comma-separated authorized Telegram User IDs')
  .action(async (options) => {
    const { TelegramBotService } = await import('./core/telegram-bot.js');
    const { Engine } = await import('./core/engine.js');
    const { ConfigManager } = await import('./core/config.js');
    const { ToolRegistry } = await import('./tools/tool-registry.js');
    const { registerBuiltinTools } = await import('./tools/built-in.js');
    const { registerBrowserTools } = await import('./tools/browser.js');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const config = new ConfigManager();
    const tools = new ToolRegistry();
    registerBuiltinTools(tools, process.cwd());
    registerBrowserTools(tools, process.cwd());

    const { McpClient } = await import('./core/mcp-client.js');
    const mcpClient = new McpClient(tools, process.cwd());
    await mcpClient.init();

    const { registerSubagentTools } = await import('./tools/subagent.js');

    const promptsDir = join(__dirname, '..', 'prompts');

    // Create silent engine for Telegram background runner
    const engine = new Engine(config, tools, promptsDir, process.cwd(), { silent: true });
    registerSubagentTools(tools, process.cwd(), config, promptsDir, engine);
    
    // Parse allowed user IDs
    const allowedUserIds = options.allowed.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id));

    console.log(`🤖 Starting Nova Telegram Bot Gateway...`);
    const botService = new TelegramBotService(options.token, allowedUserIds, engine);
    await botService.start();

    const cleanup = () => {
      mcpClient.cleanup();
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });

program.parse();
