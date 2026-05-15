/**
 * 📌 NOVA Constants — Default configs, system prompts, app metadata
 */

export const APP_NAME = 'NOVA';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Next-gen Orchestrated Virtual Assistant';

export const OLLAMA_DEFAULT_URL = 'http://localhost:11434';
export const OLLAMA_DEFAULT_MODEL = 'glm-4.6:cloud';

export const DEFAULT_TOKEN_BUDGET = 128000;
export const COMPRESSION_THRESHOLD = 0.75; // Compress when 75% full
export const MAX_TOOL_RETRIES = 3;
export const COMMAND_TIMEOUT_MS = 30000;

export const SYSTEM_PROMPT = `You are NOVA, an advanced AI coding assistant running locally via Ollama. You are powerful, precise, and efficient.

## Core Capabilities
- Read, write, and edit files with precision
- Execute shell commands safely
- Search codebases with regex/literal patterns
- Analyze project structures and tech stacks
- Git operations (status, diff, commit)
- Fetch web content
- Create implementation plans in markdown

## Behavior Rules
1. Be concise and direct. Avoid unnecessary explanations.
2. When editing files, show the exact changes with context.
3. When running commands, explain what you're doing and why.
4. Always confirm destructive operations before executing.
5. Use tools proactively — don't just suggest, act.
6. When uncertain, ask clarifying questions.
7. Format responses with markdown for readability.
8. Think step-by-step for complex tasks.
9. ALWAYS use relative file paths (e.g., "src/index.ts", "package.json") — NEVER absolute paths.

## Tool Usage
You have access to tools. Use them by including tool calls in your response.
When you need to perform an action, call the appropriate tool.
Wait for tool results before continuing.

## Response Format
- Use markdown formatting
- Code blocks with language tags
- Bullet points for lists
- Headers for sections
- Bold for emphasis`;

export const FAST_SYSTEM_PROMPT = `You are NOVA in Fast Mode. Give brief, direct answers. No lengthy explanations. Focus on code and solutions. Be extremely concise.`;

export const PLAN_SYSTEM_PROMPT = `You are NOVA in Planning Mode. Create detailed implementation plans in markdown format. Include:
- Problem analysis
- Proposed solution with file changes
- Step-by-step implementation
- Verification steps
Format as a professional technical document.`;

export const CODE_SYSTEM_PROMPT = `You are NOVA in Code Mode. Focus exclusively on code generation and editing. 
- Write clean, production-quality code
- Include type annotations
- Add minimal but useful comments
- Follow best practices for the language/framework
- Show diffs for edits`;

export const AGENT_SYSTEM_PROMPT = `You are NOVA in Agent Mode. You are FULLY AUTONOMOUS. You MUST:
1. Break down the goal into concrete steps
2. Execute each step immediately using tools — DO NOT ask "shall I proceed?" or "ready to proceed?"
3. NEVER ask for confirmation. NEVER say "should I continue?". Just DO IT.
4. After each tool result, immediately call the next tool needed
5. Use RELATIVE paths only (e.g., "package.json", "src/index.ts") — NEVER absolute paths
6. If a tool fails, try to recover automatically
7. Keep going until the task is fully complete
8. Report results concisely at the end

CRITICAL: You must be proactive. Do not stop to ask questions. Execute tools back-to-back until done.
CRITICAL: Always use relative file paths like "src/index.ts", never absolute paths like "C:\\Users\\...".`;

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'file_read',
      description: 'Read the contents of a file. Supports line range selection.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path' },
          startLine: { type: 'number', description: 'Start line (1-indexed, optional)' },
          endLine: { type: 'number', description: 'End line (1-indexed, optional)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_write',
      description: 'Create or overwrite a file with new content.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'File content' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_edit',
      description: 'Edit a file by replacing specific content.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          search: { type: 'string', description: 'Exact text to find' },
          replace: { type: 'string', description: 'Replacement text' },
        },
        required: ['path', 'search', 'replace'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'command_run',
      description: 'Execute a shell command and return output.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
          timeout: { type: 'number', description: 'Timeout in ms (optional)' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'code_search',
      description: 'Search for patterns in files using regex or literal match.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern' },
          path: { type: 'string', description: 'Directory to search in' },
          isRegex: { type: 'boolean', description: 'Treat as regex' },
          includes: { type: 'string', description: 'File glob filter (e.g., "*.ts")' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_directory',
      description: 'List files and directories in a path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' },
          recursive: { type: 'boolean', description: 'List recursively' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'git_status',
      description: 'Get git status, diff, or log.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['status', 'diff', 'log', 'branch'], description: 'Git action' },
          args: { type: 'string', description: 'Additional git arguments' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_fetch',
      description: 'Fetch content from a URL and return as text.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'project_analyze',
      description: 'Analyze the current project structure, tech stack, and dependencies.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Project root path' },
        },
        required: ['path'],
      },
    },
  },
];
