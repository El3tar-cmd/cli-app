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

program.parse();
