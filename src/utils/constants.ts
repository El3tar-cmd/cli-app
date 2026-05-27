/**
 * 📌 NOVA Constants — Default configs, system prompts, app metadata
 */

export const APP_NAME = 'NOVA';
export const APP_VERSION = '2.1.0';
export const APP_DESCRIPTION = 'Next-gen Orchestrated Virtual Assistant';

export const OLLAMA_DEFAULT_URL = 'http://localhost:11434';
export const OLLAMA_DEFAULT_MODEL = 'glm-4.6:cloud';

export const DEFAULT_TOKEN_BUDGET = 128000;
export const COMPRESSION_THRESHOLD = 0.75;
export const MAX_TOOL_RETRIES = 3;
export const COMMAND_TIMEOUT_MS = 30000;

export const SYSTEM_PROMPT = `You are NOVA v2.1, an elite AI coding assistant and autonomous development agent. [Fallback — See prompts/identity.md for full prompt]`;

export const FAST_SYSTEM_PROMPT = `You are NOVA in Fast Mode. Be extremely concise. [Fallback — See prompts/modes/fast.md]`;

export const PLAN_SYSTEM_PROMPT = `You are NOVA in Planning Mode. Create professional implementation plans. [Fallback — See prompts/modes/plan.md]`;

export const CODE_SYSTEM_PROMPT = `You are NOVA in Code Mode. You are a code generation machine. [Fallback — See prompts/modes/code.md]`;

export const AGENT_SYSTEM_PROMPT = `You are NOVA in Agent Mode. You are fully autonomous. [Fallback — See prompts/modes/agent.md]`;

export const GOAL_SYSTEM_PROMPT = `You are NOVA in Goal Mode. Persistent thorough execution. [Fallback — See prompts/modes/goal.md]`;

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
      name: 'git_commit',
      description: 'Stage files and create a git commit. Use all=true to stage everything, or specify files.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Commit message (use conventional commit format)' },
          files: { type: 'string', description: 'Space-separated file paths to stage (optional)' },
          all: { type: 'boolean', description: 'Stage all changes (git add -A) before committing' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_patch',
      description: 'Apply a unified diff patch to a file. Use for precise multi-hunk edits that are safer than search/replace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to patch' },
          patch: { type: 'string', description: 'Unified diff patch content' },
        },
        required: ['path', 'patch'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'file_multi_edit',
      description: 'Apply multiple search/replace edits to a file atomically. All succeed or all roll back.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          edits: { type: 'string', description: 'JSON array of {search, replace} objects' },
        },
        required: ['path', 'edits'],
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
      name: 'browser_navigate',
      description: 'Open a URL in a headless browser (Puppeteer). Use to test websites, preview local dev servers, or inspect pages programmatically. Returns page title.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to navigate to' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_screenshot',
      description: 'Take a screenshot of the current browser page. Saves as PNG file. Use to visually verify UI changes.',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Output filename (optional, defaults to screenshot-<timestamp>.png)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_click',
      description: 'Click an element on the page using a CSS selector.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the element to click' },
        },
        required: ['selector'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_type',
      description: 'Type text into an input field identified by CSS selector.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the input field' },
          text: { type: 'string', description: 'Text to type' },
        },
        required: ['selector', 'text'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_eval',
      description: 'Execute JavaScript in the browser and return the result. Use to inspect DOM, check values, or run tests.',
      parameters: {
        type: 'object',
        properties: {
          script: { type: 'string', description: 'JavaScript code to execute' },
        },
        required: ['script'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_content',
      description: 'Get the text content of the current page or a specific element.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector (optional, defaults to entire page body)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_console',
      description: 'Get console logs (errors, warnings) from the browser. Useful for debugging.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_close',
      description: 'Close the browser instance.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'sequential_thinking',
      description: 'Record a thinking step for complex problem-solving. Call multiple times to build a chain of thought. The server auto-tracks step numbers. Just provide your thought text. Set done=true on your final thought.',
      parameters: {
        type: 'object',
        properties: {
          thought: { type: 'string', description: 'Your current thinking step' },
          totalThoughts: { type: 'number', description: 'Estimated total steps (only needed on first call)' },
          done: { type: 'boolean', description: 'Set true when thinking is complete' },
        },
        required: ['thought'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_state',
      description: 'Update the agent scratchpad/state to maintain focus during long tasks. MUST be called after every significant action (file creation, bug fix, decision). This prevents losing track of the goal.',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The ultimate objective the user wants' },
          currentTask: { type: 'string', description: 'What you are currently working on' },
          phase: { type: 'string', enum: ['planning', 'implementing', 'debugging', 'testing', 'reviewing', 'done'], description: 'Current phase' },
          completed: { type: 'array', items: { type: 'string' }, description: 'Steps just completed (appended to history)' },
          failedAttempts: { type: 'array', items: { type: 'string' }, description: 'Failed approaches to avoid repeating' },
          nextSteps: { type: 'array', items: { type: 'string' }, description: 'Planned next actions' },
          constraints: { type: 'array', items: { type: 'string' }, description: 'Critical rules that must not be forgotten' },
          keyFiles: { type: 'array', items: { type: 'string' }, description: 'Important file paths for current task' },
          decisions: { type: 'array', items: { type: 'string' }, description: 'Technical decisions made' },
        },
        required: ['goal'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'recall_memory',
      description: 'Search long-term vector memory for relevant past interactions, code snippets, decisions, or errors from this or previous sessions. Use when you need to remember something specific.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for in memory' },
          category: { type: 'string', enum: ['interaction', 'code', 'decision', 'error', 'plan'], description: 'Optional category filter' },
          topK: { type: 'number', description: 'Number of results (default 3)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delegate_task',
      description: 'Delegate a complex sub-task to a fresh Sub-Agent. The Sub-Agent starts with a clean context window, preventing pollution of your master context. Use this for building isolated features, writing specific tests, or debugging isolated files. DO NOT use this for simple one-line changes.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Detailed explanation of what the sub-agent needs to accomplish' },
          focusFiles: { type: 'array', items: { type: 'string' }, description: 'Specific files the sub-agent should focus on' },
          sandbox: { type: 'boolean', description: 'Whether to isolate this sub-agent inside a temporary sandbox directory (highly recommended for safety)' },
          parallel: { type: 'boolean', description: 'Whether to execute this task asynchronously in parallel with other delegated tasks' },
        },
        required: ['task'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the internet for up-to-date documentation, solutions, package releases, or news using Tavily, Brave Search, SerpApi, or a Puppeteer-based DuckDuckGo fallback.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query string' },
          provider: { type: 'string', enum: ['auto', 'tavily', 'brave', 'serpapi', 'duckduckgo'], description: 'The search provider to use (optional, defaults to auto)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'workspace_problems',
      description: 'Scan the workspace for static analysis, typescript, linting, and compilation errors/warnings. Auto-detects project type.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Target path to scan (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_inspect_ui',
      description: 'Inspect the current browser page layout for non-vision models. Returns a detailed textual wireframe: interactive elements with coordinates, overlapping elements, broken images, off-screen content, truncated text, and console errors. Use this instead of screenshots when the AI model cannot see images.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'Root selector to inspect (optional, defaults to body)' },
          maxElements: { type: 'number', description: 'Maximum number of elements to return (optional, defaults to 100)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delegate_parallel_tasks',
      description: 'Spawn multiple independent Sub-Agents simultaneously and run them in parallel. Significantly faster than sequential delegation for unrelated tasks. Each agent gets its own sandbox and clean context. All results are collected and returned after all agents complete.',
      parameters: {
        type: 'object',
        properties: {
          tasks: { 
            type: 'array', 
            description: 'Array of task objects: { task: string, focusFiles?: string[], sandbox?: boolean }' 
          },
        },
        required: ['tasks'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'render_graphics',
      description: 'Render visual diagrams (Mermaid.js), custom SVG markup, or HTML5 Canvas drawing scripts into high-quality PNG or SVG image files. Useful for generating flowcharts, system architectures, database schemas, and custom drawings.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['mermaid', 'svg', 'canvas'], description: 'Type of graphic to render' },
          code: { type: 'string', description: 'The input markup code or JavaScript canvas script code' },
          outputPath: { type: 'string', description: 'Destination path for the output image file (relative to workspace, e.g. "architecture.png" or "flowchart.svg")' },
          width: { type: 'number', description: 'Viewport or canvas width (optional, default 800)' },
          height: { type: 'number', description: 'Viewport or canvas height (optional, default 600)' },
          backgroundColor: { type: 'string', description: 'Background color of the render (optional, default white)' },
        },
        required: ['type', 'code', 'outputPath'],
      },
    },
  },
];
