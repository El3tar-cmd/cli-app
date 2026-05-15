# 🚀 NOVA CLI

> **Next-gen Orchestrated Virtual Assistant** — Enterprise AI coding assistant powered by Ollama

An advanced, interactive CLI tool that competes with Claude CLI, Claude Code, and Claude Desktop. 100% local, 100% private, powered by your Ollama models.

## ✨ Features

- **🤖 Multi-Mode System** — Chat, Fast, Plan, Code, and Agent modes
- **🧠 Smart Context Memory** — Token budget tracking with auto-compression (60-70% savings)
- **🔧 9+ Built-in Tools** — File ops, command execution, git, search, web fetch, project analysis
- **🎨 Cyberpunk Design** — 5 beautiful themes with gradient text and unicode art
- **⚡ Real-time Streaming** — Live markdown rendering as tokens arrive
- **📋 Planning Mode** — Generate implementation plans as MD files
- **🔌 Plugin System** — Extensible architecture with dynamic plugin loading
- **💾 Conversation Memory** — Auto-save, load, export conversations
- **📊 Project Analysis** — Auto-detect tech stack, framework, and dependencies
- **🌐 Multi-Model** — Switch between any Ollama model on the fly

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run NOVA
node bin/nova.js

# Or with options
node bin/nova.js --model llama3.2:3b --mode code
node bin/nova.js "explain this error" # one-shot mode
```

## 📋 Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/model <name>` | Switch Ollama model |
| `/models` | List available models |
| `/mode <mode>` | Switch mode (chat/fast/plan/code/agent) |
| `/chat` `/fast` `/code` `/agent` | Mode shortcuts |
| `/plan <goal>` | Generate implementation plan (MD file) |
| `/context` | View context/token usage |
| `/compress` | Compress context to save tokens |
| `/tools` | List available tools |
| `/status` | System dashboard |
| `/project` | Analyze current project |
| `/save [name]` | Save conversation |
| `/load <id>` | Load conversation |
| `/history` | List saved conversations |
| `/export [md\|json]` | Export conversation |
| `/theme <name>` | Switch theme (cyberpunk/nord/dracula/matrix/sunset) |
| `/config` | View/set configuration |
| `/quit` | Exit NOVA |

## 🎨 Themes

- **Cyberpunk** (default) — Cyan/Magenta/Purple on dark
- **Nord** — Cool blues and greens
- **Dracula** — Purple and pink
- **Matrix** — Green on black
- **Sunset** — Warm oranges and reds

## 🔧 Tools

NOVA can use tools to interact with your system:

- `file_read` — Read files with line ranges
- `file_write` — Create/overwrite files
- `file_edit` — Search & replace editing
- `command_run` — Execute shell commands
- `code_search` — Search patterns in code
- `list_directory` — List directory contents
- `git_status` — Git status, diff, log
- `web_fetch` — Fetch URL content
- `project_analyze` — Analyze project structure

## 🔌 Plugins

Place plugins in `~/.nova/plugins/<plugin-name>/`:

```
~/.nova/plugins/my-plugin/
├── manifest.json
└── index.js
```

## 📁 Architecture

```
src/
├── index.ts              # CLI entry point
├── nova.ts               # Main app class
├── core/
│   ├── engine.ts          # AI engine (LLM orchestration)
│   ├── ollama-client.ts   # Ollama API client + streaming
│   ├── stream-renderer.ts # Real-time markdown renderer
│   ├── config.ts          # Configuration management
│   └── router.ts          # Command router
├── memory/
│   ├── context-manager.ts # Token budget & context window
│   ├── conversation-store.ts # Persistent conversations
│   ├── project-index.ts   # Project structure cache
│   └── knowledge-base.ts  # Cross-session facts
├── tools/
│   ├── tool-registry.ts   # Tool registration
│   └── built-in.ts        # 9 built-in tools
├── plugins/
│   └── plugin-manager.ts  # Dynamic plugin loading
├── ui/
│   └── theme.ts           # Design system + 5 themes
└── utils/
    ├── constants.ts        # System prompts & tool defs
    ├── helpers.ts          # Utility functions
    ├── logger.ts           # Structured logging
    └── token-counter.ts    # Token estimation
```

## License

MIT
