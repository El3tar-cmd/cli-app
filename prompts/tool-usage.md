# 🔧 Tool Usage Guide

> Reference for how to use each available tool effectively.

## File Tools

### file_read
Read contents of a file with line numbers.
```
path: "src/index.ts"           (required)
startLine: 1                   (optional)
endLine: 50                    (optional)
```

### file_write
Create or overwrite a file. **Blocked if secrets detected.**
```
path: "src/new-file.ts"       (required)
content: "file contents..."    (required)
```

### file_edit
Search and replace text in a file (replaces ALL occurrences).
```
path: "src/index.ts"          (required)
search: "old text"             (required)
replace: "new text"            (required)
```

### file_patch
Apply unified diff patches for precise multi-hunk edits.
```
path: "src/index.ts"          (required)
patch: "unified diff content"  (required)
```

### file_multi_edit
Apply multiple search/replace edits atomically — all succeed or all roll back.
```
path: "src/index.ts"          (required)
edits: '[{"search":"old","replace":"new"}, ...]'  (required, JSON string)
```

### list_directory
List directory contents with file sizes. Supports recursive mode.
```
path: "src"                    (required)
recursive: true                (optional)
```

## Command Tools

### command_run
Execute a shell command asynchronously with timeout.
```
command: "npm test"            (required)
cwd: "packages/app"           (optional)
timeout: 30000                 (optional, ms)
```

## Search Tools

### code_search
Search for text patterns across files. Supports regex.
```
pattern: "function.*export"    (required)
path: "src"                    (optional)
includes: "*.ts"               (optional)
isRegex: true                  (optional)
```

## Git Tools

### git_status
Git operations: status, diff, log, branch.
```
action: "status"               (required: status|diff|log|branch)
args: "--staged"               (optional)
```

### git_commit
Stage files and commit with a message.
```
message: "feat: add login"     (required)
files: "src/auth.ts"           (optional)
all: true                      (optional, stages all)
```

## Web Tools

### web_fetch
Fetch URL content (strips HTML). **SSRF-protected.**
```
url: "https://api.example.com" (required, http/https only)
```

### browser_open
Open URL in the system's default browser.
```
url: "http://localhost:3000"   (required)
```

## Browser Automation Tools

### browser_navigate, browser_screenshot, browser_click, browser_type, browser_eval, browser_content, browser_console, browser_close

Full headless browser automation via Puppeteer. Use for:
- Testing web applications visually
- Scraping dynamic content
- Debugging frontend issues

## System Tools

### project_analyze
Analyze a project's structure, framework, dependencies.
```
path: "."                      (required)
```

### sequential_thinking
Multi-step reasoning for complex problems. Server tracks steps automatically.
```
thought: "Step 1: analyze..."  (required)
totalThoughts: 5               (optional, first call)
done: true                     (optional, to finish)
```

## Memory Tools (Cognitive Architecture)

### update_state
**CRITICAL for long tasks.** Updates the agent scratchpad to maintain focus.
Call this after every significant action (file created, bug fixed, decision made).
The scratchpad is always injected into the system prompt so you never lose the goal.
```
goal: "Build e-commerce app"      (required on first call)
currentTask: "Setting up DB"      (optional)
phase: "implementing"             (optional: planning|implementing|debugging|testing|reviewing|done)
completed: ["Created schema"]     (optional, appended to history)
failedAttempts: ["Raw SQL failed"] (optional, things to avoid)
nextSteps: ["Add seed data"]      (optional)
constraints: ["Use PostgreSQL"]   (optional)
keyFiles: ["src/db/schema.ts"]    (optional)
decisions: ["Using Drizzle ORM"]  (optional)
```

### recall_memory
Search long-term vector memory for relevant past interactions, code, decisions, or errors.
Memories persist across sessions. Use when you need to recall something specific.
```
query: "how did we set up auth?"  (required)
category: "code"                  (optional: interaction|code|decision|error|plan)
topK: 5                           (optional, default 3)
```

### delegate_task
**CRITICAL for massive tasks.** Spawns a completely new "Sub-Agent" with a fresh, clean context window.
Use this when you are doing something complex (like building a whole new component or debugging a deep issue) and you don't want to pollute your master context. 
The Sub-Agent will do the work and report back the results.
```
task: "Build the Login React component using Tailwind" (required)
focusFiles: ["src/components/Login.tsx"]               (optional)
```

## Best Practices

1. **Always read before editing** — understand the file first
2. **Use file_edit for small changes** — search/replace is safer than full rewrites
3. **Use file_patch for complex edits** — unified diffs are more precise
4. **Run tests after changes** — verify with `command_run`
5. **Use relative paths always** — never absolute paths
6. **Check git status** — before and after changes
7. **Update state after every significant action** — use `update_state` to prevent losing focus
8. **Use recall_memory for long sessions** — retrieve past decisions before making new ones
9. **Set the goal first** — always call `update_state` with `goal` at the start of complex tasks
