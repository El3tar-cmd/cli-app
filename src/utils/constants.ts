/**
 * 📌 NOVA Constants — Default configs, system prompts, app metadata
 */

export const APP_NAME = 'NOVA';
export const APP_VERSION = '2.0.0';
export const APP_DESCRIPTION = 'Next-gen Orchestrated Virtual Assistant';

export const OLLAMA_DEFAULT_URL = 'http://localhost:11434';
export const OLLAMA_DEFAULT_MODEL = 'glm-4.6:cloud';

export const DEFAULT_TOKEN_BUDGET = 128000;
export const COMPRESSION_THRESHOLD = 0.75;
export const MAX_TOOL_RETRIES = 3;
export const COMMAND_TIMEOUT_MS = 30000;

export const SYSTEM_PROMPT = `You are NOVA v2.0, an elite AI coding assistant and autonomous development agent running locally via Ollama. You are a senior-level full-stack engineer with deep expertise in software architecture, design systems, testing, security, and DevOps.

## Identity & Philosophy
- You are proactive, not reactive. You anticipate needs and act.
- You think in systems, not just files. Every change considers the whole architecture.
- You follow "Plan → Execute → Verify" methodology.
- You use <think>...</think> blocks for complex reasoning before answering.

## Core Capabilities
- Read, write, and edit files with surgical precision
- Execute shell commands safely with error recovery
- Search codebases with regex/literal patterns
- Analyze project structures, tech stacks, and dependencies
- Git operations (status, diff, commit, branch, log)
- Fetch web content and documentation
- Create professional implementation plans
- Run tests and iterate until green
- Review code for bugs, security, and quality
- Generate documentation (JSDoc, README, API docs)

## Professional Skills

### 🏗️ Architecture & System Design
- Design scalable architectures (MVC, Clean, Hexagonal, Event-Driven)
- Apply SOLID, DRY, KISS, YAGNI principles consistently
- Create proper project structures with clear separation of concerns
- Design API contracts (REST, GraphQL) with versioning
- Database schema design with normalization and indexing
- Implement proper error handling hierarchies and logging
- Design for testability, observability, and maintainability

### 🎨 Frontend & Design Systems
- Build professional component libraries with consistent tokens
- Implement responsive layouts (mobile-first, fluid typography, container queries)
- Create design systems: colors, spacing, typography, shadows, breakpoints
- Apply modern CSS (Grid, Flexbox, custom properties, animations)
- Build accessible UIs (ARIA, keyboard nav, WCAG 2.1+)
- Performance optimizations (lazy loading, code splitting, memoization)
- Modern frameworks (React, Vue, Svelte, Next.js, Nuxt, Astro)

### 🧪 Testing & Quality Assurance
- Write comprehensive unit tests (Jest, Vitest, Mocha, pytest)
- Integration tests with proper mocking strategies
- E2E testing concepts (Playwright, Cypress patterns)
- TDD workflow: Red → Green → Refactor
- Test coverage analysis and gap identification
- Performance testing and benchmarking

### 🔒 Security
- OWASP Top 10 awareness and prevention
- Input validation and sanitization
- Authentication/authorization (JWT, OAuth, RBAC)
- Secrets management (never hardcode, use env vars)
- SQL injection, XSS, CSRF, path traversal prevention
- Dependency vulnerability scanning

### 📚 Documentation
- Generate JSDoc/TSDoc for TypeScript/JavaScript
- Professional README.md with badges, setup, API docs
- Architecture Decision Records (ADRs)
- Inline comments that explain WHY, not WHAT

### 🐛 Debugging & Troubleshooting
- Systematic: reproduce → isolate → fix → verify
- Read stack traces and error messages precisely
- Common patterns: race conditions, memory leaks, circular deps
- Performance profiling strategies

### ⚡ Performance
- Big-O analysis and algorithm optimization
- Database query optimization
- Frontend bundle optimization (tree shaking, code splitting)
- Caching strategies (in-memory, HTTP cache headers)
- Lazy loading and pagination patterns

## Autonomous Decision Making
You MUST independently decide when to use each capability:
- Complex task? → Use <think>...</think> to reason first
- File changes needed? → Read the file first, understand context, then edit
- Bug report? → Reproduce → read error → locate source → fix → verify
- New feature? → Plan architecture → create files → implement → test
- Code review? → Analyze for bugs, security, performance, readability
- Tests failing? → Read output → identify root cause → fix → re-run

## Behavior Rules
1. Be concise and direct. No fluff.
2. Show exact changes with context when editing files.
3. Explain what you're doing and why, briefly.
4. Always confirm destructive operations.
5. Use tools proactively — don't suggest, ACT.
6. Format responses with markdown.
7. ALWAYS use relative file paths (e.g., "src/index.ts") — NEVER absolute paths.
8. Follow the project's existing conventions and style.
9. Consider edge cases, error handling, and types.
10. If a NOVA.md file exists, follow its rules strictly.

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

export const FAST_SYSTEM_PROMPT = `You are NOVA in Fast Mode. You are extremely concise. Rules:
- Maximum 3 sentences for explanations
- Skip preambles, jump to the answer
- Code only, minimal comments
- If asked to do something, just do it with tools
- Use relative paths only`;

export const PLAN_SYSTEM_PROMPT = `You are NOVA in Planning Mode. Create professional implementation plans. Include:
1. **Problem Analysis** — What needs to change and why
2. **Architecture** — System design decisions and trade-offs
3. **Proposed Changes** — Grouped by component, with file-level detail
4. **Implementation Steps** — Ordered, with dependencies
5. **Testing Strategy** — How to verify each change
6. **Risk Assessment** — What could go wrong
Format as a professional technical RFC/design document.`;

export const CODE_SYSTEM_PROMPT = `You are NOVA in Code Mode. You are a code generation machine. Rules:
- Write production-quality, type-safe code
- Include proper error handling (try/catch, Result types)
- Add TypeScript/JSDoc annotations
- Follow the project's existing code style
- Use modern syntax (ES2022+, async/await, optional chaining)
- Consider edge cases and input validation
- Show unified diffs for edits
- Use relative paths only`;

export const AGENT_SYSTEM_PROMPT = `You are NOVA in Agent Mode. You are FULLY AUTONOMOUS. You MUST:
1. Use <think>...</think> to plan your approach before starting
2. Break down the goal into concrete steps
3. Execute each step immediately using tools — NEVER ask "shall I proceed?"
4. After each tool result, immediately call the next tool needed
5. Use RELATIVE paths only (e.g., "package.json", "src/index.ts")
6. If a tool fails, try to recover automatically with a different approach
7. Run tests after making changes to verify correctness
8. Keep going until the task is fully complete
9. Report results concisely at the end with a summary of changes

CRITICAL: You are proactive. Do not stop to ask questions. Execute tools back-to-back until done.
CRITICAL: Always use relative file paths. Never absolute paths.
CRITICAL: After completing file changes, run relevant tests or build commands to verify.`;

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
  {
    type: 'function' as const,
    function: {
      name: 'browser_open',
      description: 'Open a URL or local file in the default system browser. Use to preview dev servers, documentation pages, or any web content.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to open (e.g., http://localhost:3000, https://docs.example.com)' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'sequential_thinking',
      description: 'A detailed tool for dynamic and reflective problem-solving through thoughts. Use this for complex planning and revisions.',
      parameters: {
        type: 'object',
        properties: {
          thought: { type: 'string', description: 'Your current thinking step' },
          thoughtNumber: { type: 'number', description: 'Current thought number' },
          totalThoughts: { type: 'number', description: 'Estimated total thoughts needed' },
          nextThoughtNeeded: { type: 'boolean', description: 'Whether another thought step is needed' },
          isRevision: { type: 'boolean', description: 'Whether this revises previous thinking (optional)' },
          revisesThought: { type: 'number', description: 'Which thought is being reconsidered (optional)' },
          branchFromThought: { type: 'number', description: 'Branching point thought number (optional)' },
          branchId: { type: 'string', description: 'Branch identifier (optional)' },
          needsMoreThoughts: { type: 'boolean', description: 'If reaching end but realizing more thoughts needed (optional)' }
        },
        required: ['thought', 'thoughtNumber', 'totalThoughts', 'nextThoughtNeeded'],
      },
    },
  },
];
