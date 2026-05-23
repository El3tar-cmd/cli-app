# NOVA.md — nova-cli

> Auto-generated project constitution. Last updated: 2026-05-18
> Edit this file to customize NOVA's behavior for this project.

## Project Overview

- **Name**: nova-cli
- **Description**: 🚀 NOVA — Next-gen Orchestrated Virtual Assistant. Enterprise AI coding assistant powered by Ollama.
- **Type**: library
- **Language**: TypeScript
- **Package Manager**: npm
- **Source Directory**: src/

## Project Structure

```
nova-cli/
├── src/
├── test/
├── README.md
├── package.json
├── tsconfig.json
```

## Rules

- Always use TypeScript with strict mode enabled
- Use proper types — avoid `any`. Use `unknown` with type guards
- Use Zod for runtime validation at boundaries
- Use `npm` for package management — do not use other package managers
- Use relative imports within the project
- Follow existing code style and conventions
- Handle errors gracefully — never swallow exceptions silently

## Available Scripts

- `npm run build` — `tsc && node -e "const{cpSync}=require('fs');cpSync('prompts','dist/prompts',{recursive:true})"`
- `npm run dev` — `tsc --watch`
- `npm run start` — `node dist/index.js`
- `npm run lint` — `eslint src/`

## Key Dependencies

`better-sqlite3`, `chalk`, `chokidar`, `cli-highlight`, `cli-table3`, `commander`, `diff`, `fast-glob`, `figures`, `marked`, `marked-terminal`, `ora`, `puppeteer-core`, `string-width`, `strip-ansi`

## Notes

- This file is auto-maintained by NOVA. Manual edits are preserved.
- NOVA reads this file on startup and on every change (hot-reload).
- Add project-specific instructions below this line.
