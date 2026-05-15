#!/usr/bin/env node

/**
 * 🚀 NOVA CLI — Next-gen Orchestrated Virtual Assistant
 * Enterprise AI coding assistant powered by Ollama
 */

import('../dist/index.js').catch((err) => {
  console.error('\x1b[31m✖ Failed to start NOVA:\x1b[0m', err.message);
  console.error('\x1b[33m⚠ Run "npm run build" first if you haven\'t compiled yet.\x1b[0m');
  process.exit(1);
});
