import { useState, useEffect, useRef } from 'react';
import { 
  Cpu, Database, Send, Play, CheckCircle2, Circle, AlertCircle, 
  Settings, Activity, Trash2, Maximize2, Folder, FileText, Save, 
  RefreshCw, PanelLeftClose, PanelLeftOpen, Download, Edit2, 
  MessageSquare, Terminal, Shield, Code, GitBranch,
  Sliders, Search, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VisualDiffViewer } from './components/VisualDiffViewer';
import { Split, Columns } from 'lucide-react';

type Phase = 'planning' | 'implementing' | 'debugging' | 'testing' | 'reviewing' | 'done';

interface ScratchpadState {
  goal: string;
  currentTask: string;
  phase: Phase;
  completed: string[];
  failedAttempts: string[];
  nextSteps: string[];
  constraints: string[];
  keyFiles: string[];
  decisions: string[];
}

interface Message {
  role: string;
  content: string;
  toolName?: string;
  toolArgs?: any;
  toolSuccess?: boolean;
  toolOutput?: string;
  toolError?: string;
}

interface WorkspaceFile {
  path: string;
  name: string;
  isDir: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: Record<string, TreeNode>;
}

interface SubagentInfo {
  task: string;
  depth: number;
  sandbox: boolean;
  status: 'running' | 'completed' | 'failed';
  changes?: number;
  timestamp: Date;
}

interface TerminalLog {
  text: string;
  type: 'info' | 'success' | 'error' | 'command' | 'output';
  timestamp: Date;
}

// Flat file list to nested folder tree parser
function buildFileTree(filesList: WorkspaceFile[]): TreeNode {
  const root: TreeNode = { name: 'root', path: '', isDir: true, children: {} };

  for (const file of filesList) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const nodePath = parts.slice(0, i + 1).join('/');

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: nodePath,
          isDir: isLast ? file.isDir : true,
          children: {}
        };
      }
      current = current.children[part];
    }
  }

  return root;
}

interface FileNodeProps {
  node: TreeNode;
  depth: number;
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  expandedFolders: Record<string, boolean>;
  onToggleFolder: (path: string) => void;
}

// Recursive Component for nested Directory structure
function FileNode({ node, depth, selectedFile, onFileSelect, expandedFolders, onToggleFolder }: FileNodeProps) {
  const isExpanded = expandedFolders[node.path] || false;
  const hasChildren = Object.keys(node.children).length > 0;

  const sortedChildren = Object.values(node.children).sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });

  if (node.path === '') {
    return (
      <div className="space-y-1">
        {sortedChildren.map((child) => (
          <FileNode
            key={child.path}
            node={child}
            depth={depth}
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
            expandedFolders={expandedFolders}
            onToggleFolder={onToggleFolder}
          />
        ))}
      </div>
    );
  }

  const isSelected = selectedFile === node.path;

  // File extension coloring helper
  const getFileIconColor = (name: string) => {
    if (name.endsWith('.json')) return 'text-amber-400';
    if (name.endsWith('.md')) return 'text-emerald-400';
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'text-cyan-400';
    if (name.endsWith('.js') || name.endsWith('.jsx')) return 'text-yellow-400';
    if (name.endsWith('.css')) return 'text-pink-400';
    return 'text-blue-400';
  };

  return (
    <div className="select-none text-xs">
      <button
        onClick={() => {
          if (node.isDir) {
            onToggleFolder(node.path);
          } else {
            onFileSelect(node.path);
          }
        }}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`w-full flex items-center py-1.5 pr-2 rounded-lg text-left transition-all duration-150 font-mono border ${isSelected ? 'bg-gradient-to-r from-blue-600/25 to-indigo-600/10 text-blue-200 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] font-semibold' : 'text-gray-400 border-transparent hover:bg-white/5 hover:text-white'}`}
      >
        {node.isDir ? (
          <>
            <span 
              className="mr-1.5 text-[8px] text-gray-500 shrink-0 transform transition-transform duration-150 inline-block align-middle"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              ▶
            </span>
            <Folder className={`w-3.5 h-3.5 mr-1.5 shrink-0 ${isExpanded ? 'text-amber-400 fill-amber-400/10' : 'text-amber-500/80'}`} />
          </>
        ) : (
          <FileText className={`w-3.5 h-3.5 mr-1.5 ml-4 shrink-0 ${getFileIconColor(node.name)}`} />
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {node.isDir && isExpanded && hasChildren && (
        <div className="mt-1 space-y-0.5 border-l border-white/5 ml-[14px]">
          {sortedChildren.map((child) => (
            <FileNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              onFileSelect={onFileSelect}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Inline Markdown formatting helpers
function renderInlineFormatting(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const tokens = text.split(regex);

  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={i} className="font-bold text-white shadow-sm">{token.slice(2, -2)}</strong>;
    } else if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={i} className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-cyan-300 font-mono text-[10px]">{token.slice(1, -1)}</code>;
    }
    return token;
  });
}

function Markdown({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeLines: string[] = [];
  
  let inList = false;
  let listItems: string[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Code Block detection
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        const codeContent = codeLines.join('\n');
        elements.push(
          <div key={`code-${idx}`} className="rounded-xl overflow-hidden border border-white/10 bg-black/60 shadow-xl font-mono text-[11px] text-gray-300 w-full my-3">
            <div className="bg-[#0f111a] px-3.5 py-2 border-b border-white/5 flex items-center justify-between select-none">
              <div className="flex space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-[9px] text-gray-500 font-semibold font-mono tracking-wider uppercase">{codeLanguage || 'code'}</span>
            </div>
            <pre className="p-3.5 overflow-x-auto whitespace-pre leading-relaxed select-text font-mono text-gray-300/90 scrollbar-thin">
              <code>{codeContent}</code>
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeLines = [];
      } else {
        inCodeBlock = true;
        codeLanguage = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // List detection
    const isBulletList = line.trim().startsWith('- ') || line.trim().startsWith('* ');
    const isNumberedList = /^\d+\.\s/.test(line.trim());

    if (isBulletList || isNumberedList) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      listItems.push(line.trim().replace(/^(-\s|\*\s|\d+\.\s)/, ''));
      continue;
    } else {
      if (inList) {
        elements.push(
          <ul key={`list-${idx}`} className="list-disc pl-5 my-2 space-y-1.5 text-gray-300">
            {listItems.map((item, i) => (
              <li key={i}>{renderInlineFormatting(item)}</li>
            ))}
          </ul>
        );
        inList = false;
      }
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push(<h1 key={idx} className="text-base font-bold text-white mt-4 mb-2 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{renderInlineFormatting(line.slice(2))}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={idx} className="text-sm font-bold text-gray-200 mt-3.5 mb-2 border-b border-white/5 pb-1">{renderInlineFormatting(line.slice(3))}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={idx} className="text-xs font-semibold text-gray-300 mt-3 mb-1.5">{renderInlineFormatting(line.slice(4))}</h3>);
    } else if (line.trim() === '') {
      continue;
    } else {
      elements.push(<p key={idx} className="my-2 leading-relaxed text-gray-300">{renderInlineFormatting(line)}</p>);
    }
  }

  if (inList) {
    elements.push(
      <ul key="list-final" className="list-disc pl-5 my-2 space-y-1.5 text-gray-300">
        {listItems.map((item, i) => (
          <li key={i}>{renderInlineFormatting(item)}</li>
        ))}
      </ul>
    );
  }

  return <div className="space-y-1.5">{elements}</div>;
}

export default function App() {
  const API_BASE = '';
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const WS_BASE = `${wsProtocol}//${window.location.host}/ws-nova`;

  // Auth Token retrieval and persistence
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token');
  if (urlToken) {
    localStorage.setItem('nova_auth_token', urlToken);
    // clean up URL so token is not visible in address bar
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const authedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('nova_auth_token') || '';
    const headers = {
      ...options.headers,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    return fetch(url, { ...options, headers });
  };

  const [activeTab, setActiveTab] = useState<'chat' | 'editor' | 'diff' | 'swarm' | 'toolbox'>('chat');
  const [isSplitWorkspace, setIsSplitWorkspace] = useState(true);
  const [rightActiveTab, setRightActiveTab] = useState<'editor' | 'diff'>('editor');
  const [state, setState] = useState<ScratchpadState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStream, setCurrentStream] = useState('');
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);

  // Goal and Task Editing states
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [editedGoal, setEditedGoal] = useState('');
  const [taskComments, setTaskComments] = useState<Record<string, string>>({});
  const [activeCommentTask, setActiveCommentTask] = useState<string | null>(null);
  const [isAgentThinking, setIsAgentThinking] = useState(false);

  // Layout states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  // Control Panel State
  const [models, setModels] = useState<string[]>([]);
  const [currentModel, setCurrentModel] = useState('');
  const [currentMode, setCurrentMode] = useState('');
  const [systemStats, setSystemStats] = useState<any>({});

  // File Explorer & Editor State
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isModified, setIsModified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Subagents Tracking
  const [subagents, setSubagents] = useState<SubagentInfo[]>([]);
  
  // Real-time terminal logs
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Command panel states
  const [customTestCmd, setCustomTestCmd] = useState('');
  const [vulnerabilityReport, setVulnerabilityReport] = useState<string>('');
  const [activeAgentRole, setActiveAgentRole] = useState<'architect' | 'developer' | 'auditor' | 'idle'>('idle');

  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync scroll on line-number editor
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInfo();
    fetchFiles();

    const socket = new WebSocket(WS_BASE);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      addLog('Successfully connected to NOVA engine backend via WebSocket.', 'success');
      fetchInfo();
      fetchFiles();
    };
    socket.onclose = () => {
      setConnected(false);
      addLog('Disconnected from NOVA engine backend.', 'error');
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'state') {
        setState(msg.data);
      } else if (msg.type === 'token') {
        setIsAgentThinking(true);
        setCurrentStream((prev) => prev + msg.data);
      } else if (msg.type === 'tool_start') {
        setIsAgentThinking(true);
        // Deduce active agent role based on tool name
        const toolName = msg.data.name;
        if (['file_read', 'git_status', 'code_search', 'project_analyze'].includes(toolName)) {
          setActiveAgentRole('architect');
        } else if (['file_write', 'file_edit', 'command_run'].includes(toolName)) {
          setActiveAgentRole('developer');
        } else if (['test_runner', 'code_review', 'security_scanner'].includes(toolName)) {
          setActiveAgentRole('auditor');
        }

        addLog(`Executing: ${toolName} args: ${JSON.stringify(msg.data.args)}`, 'command');
        
        setMessages((prev) => [
          ...prev,
          ...(currentStream ? [{ role: 'assistant', content: currentStream }] : []),
          {
            role: 'tool',
            content: `Executing: ${toolName}`,
            toolName: toolName,
            toolArgs: msg.data.args
          }
        ]);
        setCurrentStream('');
      } else if (msg.type === 'tool_end') {
        setIsAgentThinking(false);
        setActiveAgentRole('idle');
        
        addLog(`Tool response [${msg.data.name}] -> success=${msg.data.success}`, msg.data.success ? 'success' : 'error');
        if (msg.data.output) addLog(msg.data.output, 'output');
        if (msg.data.error) addLog(msg.data.error, 'error');

        // Capture special reports
        if (msg.data.name === 'security_scanner' && msg.data.output) {
          setVulnerabilityReport(msg.data.output);
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'tool_result',
            content: msg.data.success ? 'Success' : `Failed: ${msg.data.error}`,
            toolName: msg.data.name,
            toolSuccess: msg.data.success,
            toolOutput: msg.data.output,
            toolError: msg.data.error
          }
        ]);
      } else if (msg.type === 'subagent_spawned') {
        addLog(`[Sub-Agent Spawned] Task: ${msg.data.task} | Sandbox: ${msg.data.sandbox}`, 'info');
        setSubagents(prev => [
          ...prev,
          {
            task: msg.data.task,
            depth: msg.data.depth,
            sandbox: msg.data.sandbox,
            status: 'running',
            timestamp: new Date()
          }
        ]);
      } else if (msg.type === 'subagent_completed') {
        addLog(`[Sub-Agent Finished] Success: ${msg.data.success} | Changes: ${msg.data.changes}`, msg.data.success ? 'success' : 'error');
        setSubagents(prev => prev.map(sa => 
          sa.task === msg.data.task ? { ...sa, status: msg.data.success ? 'completed' : 'failed', changes: msg.data.changes } : sa
        ));
      } else if (msg.type === 'skills_activated') {
        const skillsList = msg.data.skills?.join(', ') || 'None';
        addLog(`[Skills Activated] ${skillsList}`, 'info');
      }
    };

    return () => socket.close();
  }, [currentStream]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentStream, activeTab]);

  // Scroll to bottom of logs
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (text: string, type: TerminalLog['type']) => {
    setLogs(prev => [...prev.slice(-300), { text, type, timestamp: new Date() }]);
  };

  // Sync Scroll between gutter and textarea
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Keyboard shortcut Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if ((activeTab === 'editor' || (isSplitWorkspace && rightActiveTab === 'editor')) && selectedFile && isModified) {
          e.preventDefault();
          saveFile();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, rightActiveTab, isSplitWorkspace, selectedFile, editorContent, isModified]);
  const fetchInfo = async () => {
    try {
      const res = await authedFetch(`${API_BASE}/api/info`);
      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }
      const data = await res.json();
      if (data && data.models) {
        setModels(data.models || []);
        setCurrentModel(data.currentModel || '');
        setCurrentMode(data.currentMode || '');
        setSystemStats(data.stats || {});
      } else {
        throw new Error("No models returned in API data");
      }
    } catch (e) {
      console.warn("Failed to fetch system info, applying fallback models list:", e);
      const fallbackModels = ['qwen2.5-coder:7b', 'qwen2.5-coder:1.5b', 'llama3', 'llama3.2', 'deepseek-coder'];
      setModels(fallbackModels);
      if (!currentModel) {
        setCurrentModel(fallbackModels[0]);
      }
      if (!currentMode) {
        setCurrentMode('chat');
      }
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await authedFetch(`${API_BASE}/api/files`);
      if (!res.ok) {
        throw new Error(`Files API returned status ${res.status}`);
      }
      const data = await res.json();
      if (data && data.files) {
        setFiles(data.files);
      }
    } catch (e) {
      console.warn("Failed to fetch workspace files:", e);
    }
  };

  const loadFile = async (path: string) => {
    try {
      const res = await authedFetch(`${API_BASE}/api/file?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data && data.content !== undefined) {
        setSelectedFile(path);
        setOriginalContent(data.content);
        setEditorContent(data.content);
        setIsModified(false);
        addLog(`File loaded into editor: ${path}`, 'info');
      }
    } catch (e) {
      console.error(e);
      addLog(`Failed to load file: ${path}`, 'error');
    }
  };

  const saveFile = async (force: boolean = false) => {
    if (!selectedFile || (!isModified && !force)) return;
    setIsSaving(true);
    try {
      const res = await authedFetch(`${API_BASE}/api/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile, content: editorContent })
      });
      const data = await res.json();
      if (data.success) {
        setOriginalContent(editorContent);
        setIsModified(false);
        addLog(`File saved successfully: ${selectedFile}`, 'success');
      }
    } catch (e) {
      console.error(e);
      addLog(`Failed to save file: ${selectedFile}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSettings = async (updates: { model?: string; mode?: string }) => {
    // Optimistic UI updates to ensure interface transitions instantly
    if (updates.model) setCurrentModel(updates.model);
    if (updates.mode) setCurrentMode(updates.mode);
    try {
      await authedFetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      fetchInfo();
    } catch (e) {
      console.error("Failed to update settings on server:", e);
    }
  };

  const executeCommand = async (cmd: string) => {
    try {
      setIsAgentThinking(true);
      addLog(`User Command Triggered: ${cmd}`, 'command');
      await authedFetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: cmd })
      });
    } catch (e) {
      console.error(e);
      setIsAgentThinking(false);
    }
  };

  const saveGoal = async (newGoal: string) => {
    if (!newGoal.trim()) return;
    try {
      setIsAgentThinking(true);
      await authedFetch(`${API_BASE}/api/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: newGoal })
      });
      await authedFetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `[SYSTEM] User modified project goal to: "${newGoal}"` })
      });
      setIsEditingGoal(false);
    } catch (e) {
      console.error(e);
      setIsAgentThinking(false);
    }
  };

  const downloadGoal = () => {
    if (!state?.goal) return;
    const blob = new Blob([`# Project Goal\n\n${state.goal}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'goal-artifact.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitTaskComment = async (taskName: string, commentText: string) => {
    if (!commentText.trim()) return;
    try {
      setIsAgentThinking(true);
      await authedFetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `User left a comment on task "${taskName}": "${commentText}". Please modify your implementation details if necessary.` })
      });
      setTaskComments(prev => ({ ...prev, [taskName]: '' }));
      setActiveCommentTask(null);
    } catch (e) {
      console.error(e);
      setIsAgentThinking(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    if (currentStream) {
      setMessages((prev) => [...prev, { role: 'assistant', content: currentStream }]);
      setCurrentStream('');
    }

    setMessages((prev) => [...prev, { role: 'user', content: input }]);
    const currentInput = input;
    setInput('');

    await executeCommand(currentInput);
  };

  const handleToggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Filter files list based on search
  const filteredFiles = files.filter(f => 
    f.path.toLowerCase().includes(fileSearchQuery.toLowerCase())
  );

  // Convert filtered flat files to nested tree
  const fileTree = buildFileTree(filteredFiles);

  // ─── MODULAR RENDER PANES ──────────────────────────────────────────
  const renderChatFeed = () => (
    <div className="flex-1 flex flex-col relative bg-[#090a0f]/40 h-full overflow-hidden">
      {/* Scrollable Messages Panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin select-text">
        <div className="max-w-3xl mx-auto w-full space-y-5">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-lg border w-full md:w-auto
                ${msg.role === 'user'
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-500/30 text-white rounded-br-none shadow-blue-500/10'
                  : msg.role === 'tool'
                    ? 'bg-[#121420] border-purple-500/20 text-purple-200 font-mono rounded-bl-none shadow-inner w-full md:w-[85%]'
                    : msg.role === 'tool_result'
                      ? 'bg-[#0b101d]/60 border-green-500/20 text-green-300 font-mono rounded-tl-none -mt-4 w-full md:w-[85%]'
                      : 'bg-[#131622]/90 backdrop-blur-md border-white/5 text-gray-200 rounded-bl-none'}
              `}>
                {/* Detailed Tool Start */}
                {msg.role === 'tool' ? (
                  <div className="flex flex-col space-y-2 w-full">
                    <div className="font-semibold text-purple-400 flex items-center select-none font-mono">
                      <span className="mr-2 animate-spin"><Settings className="w-3.5 h-3.5" /></span> {msg.content}
                    </div>
                    {msg.toolArgs && Object.keys(msg.toolArgs).length > 0 && (
                      <details className="outline-none group">
                        <summary className="text-[10px] text-gray-500 hover:text-purple-300 cursor-pointer select-none font-semibold font-mono tracking-wide py-0.5">
                          [View Arguments]
                        </summary>
                        <div className="mt-1.5 text-[10px] leading-normal font-mono bg-purple-950/20 border border-purple-500/10 rounded-lg p-2.5 overflow-x-auto max-h-32 text-purple-200/85">
                          {JSON.stringify(msg.toolArgs, null, 2)}
                        </div>
                      </details>
                    )}
                  </div>
                ) : msg.role === 'tool_result' ? (
                  /* Terminal style Component for outputs */
                  <div className="flex flex-col space-y-2 w-full">
                    <div className="flex items-center justify-between select-none">
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${msg.toolSuccess ? 'bg-green-500 shadow-[0_0_6px_#10b981]' : 'bg-red-500 shadow-[0_0_6px_#ef4444]'}`} />
                        <span className={msg.toolSuccess ? 'text-green-400 font-bold font-mono' : 'text-red-400 font-bold font-mono'}>
                          {msg.toolSuccess ? 'SUCCESS' : 'FAILURE'}
                        </span>
                      </div>
                      <span className="text-[9px] text-gray-600 font-bold tracking-widest font-mono uppercase shrink-0">
                        {msg.toolName ? `${msg.toolName}` : 'Console'}
                      </span>
                    </div>

                    {msg.toolSuccess && msg.toolOutput && (
                      <div className="rounded-xl overflow-hidden border border-white/5 bg-black/60 shadow-xl font-mono text-[10px] text-gray-300 w-full mt-1.5">
                        <div className="bg-[#0f111a] px-3.5 py-1.5 border-b border-white/5 flex items-center select-none shrink-0">
                          <div className="flex space-x-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500/80" />
                            <span className="w-2 h-2 rounded-full bg-amber-500/80" />
                            <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
                          </div>
                          <span className="mx-auto text-[9px] text-gray-500 font-semibold font-mono tracking-wider uppercase">output console</span>
                        </div>
                        <div className="p-3 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text font-mono text-gray-300/80 scrollbar-thin">
                          {msg.toolOutput}
                        </div>
                      </div>
                    )}

                    {!msg.toolSuccess && msg.toolError && (
                      <div className="rounded-xl overflow-hidden border border-red-500/10 bg-red-950/10 shadow-xl font-mono text-[10px] text-red-400 w-full mt-1.5">
                        <div className="bg-red-950/20 px-3.5 py-1.5 border-b border-red-500/10 flex items-center select-none shrink-0">
                          <div className="flex space-x-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="w-2 h-2 rounded-full bg-gray-600" />
                            <span className="w-2 h-2 rounded-full bg-gray-600" />
                          </div>
                          <span className="mx-auto text-[9px] text-red-500/80 font-semibold font-mono tracking-wider uppercase">error logs</span>
                        </div>
                        <div className="p-3 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text font-mono text-red-400/95 scrollbar-thin">
                          {msg.toolError}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-300/90 leading-relaxed font-sans text-xs break-words">
                    <Markdown text={msg.content} />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Active Stream */}
          {currentStream && (
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-2xl rounded-bl-none px-4 py-3 text-xs leading-relaxed shadow-lg bg-[#131622]/90 backdrop-blur-md border border-white/5 text-gray-200">
                <Markdown text={currentStream} />
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-blue-500 animate-pulse align-middle" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-gradient-to-t from-[#07080a] via-[#07080a]/95 to-transparent shrink-0">
        <div className="max-w-3xl mx-auto relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask NOVA to write files, run tests, review code, or start planning..."
            className="w-full bg-[#11131a]/95 border border-white/10 rounded-2xl py-3.5 pl-4 pr-14 text-xs text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 shadow-2xl transition-all duration-200 placeholder-gray-500"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-white/20 text-white rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/20 active:scale-95 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderEditor = () => (
    <div className="flex-1 flex overflow-hidden bg-[#07080a]/20 h-full">
      {/* Recursive Files Tree Explorer */}
      <div className="w-60 border-r border-white/5 bg-[#0b0c10]/95 backdrop-blur-md flex flex-col shrink-0 overflow-hidden z-10">
        <div className="p-3 border-b border-white/5 bg-black/10 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center select-none">
              <Folder className="w-3.5 h-3.5 mr-2 text-blue-400" />
              Workspace Explorer
            </h3>
            <button onClick={fetchFiles} className="p-1 hover:bg-white/5 rounded-md text-gray-400 hover:text-white transition-colors" title="Reload Directory">
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          {/* File Search */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text"
              placeholder="Search files..."
              value={fileSearchQuery}
              onChange={(e) => setFileSearchQuery(e.target.value)}
              className="w-full bg-[#11131a] border border-white/5 focus:border-blue-500/40 rounded-lg py-1 pl-7 pr-2 text-[10px] text-gray-300 placeholder-gray-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Nested Folder Tree rendering */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          <FileNode
            node={fileTree}
            depth={0}
            selectedFile={selectedFile}
            onFileSelect={loadFile}
            expandedFolders={expandedFolders}
            onToggleFolder={handleToggleFolder}
          />
          {files.length === 0 && (
            <div className="text-center p-4 text-xs text-gray-500 select-none">Reading directory...</div>
          )}
        </div>
      </div>

      {/* IDE code editor pane */}
      <div className="flex-1 flex flex-col bg-[#07080a]/40 overflow-hidden relative">
        {selectedFile ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* File toolbar */}
            <div className="h-11 border-b border-white/5 bg-[#0f1118]/90 px-4 flex items-center justify-between select-none shrink-0 z-10">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs text-blue-400 font-semibold">{selectedFile}</span>
                {isModified && (
                  <span className="text-[9px] bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider select-none shrink-0 animate-pulse">
                    Modified
                  </span>
                )}
              </div>
              
              <button
                onClick={() => saveFile()}
                disabled={!isModified || isSaving}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-white/20 text-white text-[11px] px-3.5 py-1 rounded-lg font-bold transition-all shadow-md active:scale-95 shrink-0"
              >
                {isSaving ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                <span>Save (Ctrl+S)</span>
              </button>
            </div>

            {/* Synced Gutter and code window */}
            <div className="flex-1 flex overflow-hidden relative bg-[#090a0d]/40">
              <div
                ref={gutterRef}
                className="w-10 bg-[#090a0e] border-r border-white/5 text-gray-600 font-mono text-[10px] select-none text-right pr-2 py-3 overflow-hidden shrink-0"
              >
                {editorContent.split('\n').map((_, i) => (
                  <div key={i} className="h-5 leading-5">{i + 1}</div>
                ))}
              </div>
              
              <textarea
                ref={textareaRef}
                onScroll={handleScroll}
                value={editorContent}
                onChange={(e) => {
                  setEditorContent(e.target.value);
                  setIsModified(e.target.value !== originalContent);
                }}
                spellCheck={false}
                className="flex-1 bg-transparent text-gray-200 font-mono text-[11px] p-3 focus:outline-none resize-none leading-5 overflow-auto h-full w-full border-0 select-text font-medium"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 select-none">
            <FileText className="w-10 h-10 mb-2.5 text-gray-700 animate-pulse" />
            <p className="text-xs font-semibold text-gray-400">Select a file from the explorer sidebar to edit.</p>
            <p className="text-[10px] text-gray-600 mt-1 font-mono">Changes save directly into the local repo workspace.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderDiff = () => (
    <div className="flex-1 flex flex-col bg-[#07080a]/40 p-4 overflow-hidden select-text h-full">
      {selectedFile ? (
        <VisualDiffViewer
          originalContent={originalContent}
          modifiedContent={editorContent}
          filename={selectedFile}
          onAccept={() => {
            saveFile(true);
          }}
          onRevert={() => {
            setEditorContent(originalContent);
            setIsModified(false);
          }}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 select-none bg-[#07080a]/60 border border-white/5 rounded-2xl">
          <AlertCircle className="w-10 h-10 mb-2.5 text-gray-700 animate-pulse" />
          <p className="text-xs font-semibold text-gray-400">Select and edit a file in the Workspace IDE first.</p>
          <p className="text-[10px] text-gray-600 mt-1.5 font-mono">Line difference details will be rendered here.</p>
        </div>
      )}
    </div>
  );

  // Cognitive Swarm Debate View
  const renderSwarmDebate = () => {
    return (
      <div className="flex-1 flex flex-col bg-[#08090f] p-6 overflow-y-auto scrollbar-thin select-text space-y-6">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-gray-200 tracking-wide">NOVA Swarm Consensus Engine</h2>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
            The Swarm consists of three specialized cognitive profiles debating tasks before coding. The consensus protocol guarantees plan precision, clean implementation, and active security checks.
          </p>

          {/* Consensus Protocol Diagram */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Architect */}
            <div className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col space-y-2.5 ${activeAgentRole === 'architect' ? 'bg-indigo-600/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'bg-[#121422]/60 border-white/5'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider font-mono text-indigo-400 uppercase">Role 1: Architect</span>
                <span className={`w-2 h-2 rounded-full ${activeAgentRole === 'architect' ? 'bg-indigo-400 animate-ping' : 'bg-gray-600'}`} />
              </div>
              <div className="text-xs font-bold text-gray-200">System Design & Mapping</div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Reviews project dependencies, scans folder structures, queries knowledge bases, and builds logical implementation plans.
              </p>
              <div className="pt-2 text-[9px] font-mono text-indigo-300">Active on: `/plan`, `/project`, `file_read`, `code_search`</div>
            </div>

            {/* Developer */}
            <div className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col space-y-2.5 ${activeAgentRole === 'developer' ? 'bg-emerald-600/10 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-[#121422]/60 border-white/5'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider font-mono text-emerald-400 uppercase">Role 2: Developer</span>
                <span className={`w-2 h-2 rounded-full ${activeAgentRole === 'developer' ? 'bg-emerald-400 animate-ping' : 'bg-gray-600'}`} />
              </div>
              <div className="text-xs font-bold text-gray-200">Implementation & Refactoring</div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Injects changes directly into files, runs commands, refactors code bases, and resolves code todo comments.
              </p>
              <div className="pt-2 text-[9px] font-mono text-emerald-300">Active on: `/edit`, `file_write`, `file_edit`, `command_run`</div>
            </div>

            {/* Auditor */}
            <div className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col space-y-2.5 ${activeAgentRole === 'auditor' ? 'bg-amber-600/10 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'bg-[#121422]/60 border-white/5'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider font-mono text-amber-400 uppercase">Role 3: Auditor</span>
                <span className={`w-2 h-2 rounded-full ${activeAgentRole === 'auditor' ? 'bg-amber-400 animate-ping' : 'bg-gray-600'}`} />
              </div>
              <div className="text-xs font-bold text-gray-200">Quality & Vulnerability Scan</div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Executes test suites, reviews git diffs, analyzes scripts for shell injections, and runs secrets scanners.
              </p>
              <div className="pt-2 text-[9px] font-mono text-amber-300">Active on: `/test`, `/review`, `/security`, `test_runner`</div>
            </div>
          </div>

          {/* Sub-agents activity timeline */}
          <div className="p-5 rounded-2xl bg-[#10121d] border border-white/5 space-y-4">
            <h3 className="text-xs font-bold text-gray-300 flex items-center">
              <GitBranch className="w-3.5 h-3.5 mr-2 text-indigo-400" />
              Sub-Agent Hierarchy & Orchestration Tree
            </h3>

            {subagents.length === 0 ? (
              <p className="text-[11px] text-gray-500 font-mono">No sub-agent subprocesses spawned in this session.</p>
            ) : (
              <div className="space-y-3">
                {subagents.map((sa, idx) => (
                  <div key={idx} className="flex items-start justify-between border-b border-white/5 pb-2.5 text-xs">
                    <div className="flex items-start space-x-2">
                      <div className="mt-0.5 px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/25 text-[9px] rounded font-mono text-indigo-400 shrink-0">
                        Level {sa.depth}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-200">{sa.task}</div>
                        <div className="text-[10px] text-gray-500 flex items-center space-x-2 mt-0.5">
                          <span>{sa.timestamp.toLocaleTimeString()}</span>
                          <span>•</span>
                          <span>{sa.sandbox ? 'Sandboxed Environment' : 'Direct Workspace'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center space-x-2">
                      <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded border ${
                        sa.status === 'running' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse' :
                        sa.status === 'completed' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                        'bg-red-500/10 border-red-500/20 text-red-400'
                      }`}>
                        {sa.status.toUpperCase()}
                      </span>
                      {sa.changes !== undefined && sa.changes > 0 && (
                        <span className="text-[10px] font-mono text-gray-400">+{sa.changes} files</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Interactive Command Toolbox (Launcher)
  const renderToolbox = () => {
    return (
      <div className="flex-1 flex flex-col bg-[#08090f] p-6 overflow-y-auto scrollbar-thin select-text space-y-6">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          <div className="flex items-center space-x-3">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold text-gray-200 tracking-wide">NOVA Interactive CLI Toolbox</h2>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
            Directly invoke specialized CLI tools visually. You can run test suites, execute scans, review commits, and adjust repository properties without writing console commands.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Test Suite Card */}
            <div className="p-4 rounded-2xl bg-[#121422]/60 border border-white/5 flex flex-col space-y-3">
              <div className="flex items-center space-x-2">
                <Play className="w-4 h-4 text-green-400" />
                <span className="text-xs font-bold text-gray-200">Automated Test Runner</span>
              </div>
              <p className="text-[10px] text-gray-400">
                Trigger Jest, Vitest, npm run test, or custom suites. Auto-detects frameworks in the current directory.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Custom arguments (e.g. --watchAll=false)..."
                  value={customTestCmd}
                  onChange={(e) => setCustomTestCmd(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/10 focus:border-blue-500/40 rounded px-2 py-1 text-[10px] text-gray-300 placeholder-gray-500 focus:outline-none"
                />
                <button
                  onClick={() => executeCommand(`/test ${customTestCmd}`)}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold text-[10px] px-3 py-1 rounded transition active:scale-95"
                >
                  Run Tests
                </button>
              </div>
            </div>

            {/* Review Card */}
            <div className="p-4 rounded-2xl bg-[#121422]/60 border border-white/5 flex flex-col space-y-3">
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-gray-200">Repository Code Reviewer</span>
              </div>
              <p className="text-[10px] text-gray-400">
                Executes an AI scan of the current staged / unstaged git changes, or custom file, looking for logic bugs.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => executeCommand('/review')}
                  className="flex-1 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 font-bold text-[10px] py-1.5 rounded transition active:scale-95"
                >
                  Review Git Diff
                </button>
                <button
                  disabled={!selectedFile}
                  onClick={() => selectedFile && executeCommand(`/review ${selectedFile}`)}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/5 disabled:text-white/20 text-white font-bold text-[10px] py-1.5 rounded transition active:scale-95"
                  title={selectedFile ? `Review ${selectedFile}` : 'Open file in editor first'}
                >
                  Review Active File
                </button>
              </div>
            </div>

            {/* Security Scanner Card */}
            <div className="p-4 rounded-2xl bg-[#121422]/60 border border-white/5 flex flex-col space-y-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-gray-200">Vulnerability & Credentials Scan</span>
              </div>
              <p className="text-[10px] text-gray-400">
                Analyzes the currently selected file for secret leaks, credentials, sql injection, or command execution holes.
              </p>
              <div>
                <button
                  disabled={!selectedFile}
                  onClick={() => selectedFile && executeCommand(`/security ${selectedFile}`)}
                  className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-white/5 disabled:text-white/20 text-white font-bold text-[10px] py-1.5 rounded transition active:scale-95"
                >
                  Scan Active File for Vulnerabilities
                </button>
              </div>
            </div>

            {/* Indexing and Config Card */}
            <div className="p-4 rounded-2xl bg-[#121422]/60 border border-white/5 flex flex-col space-y-3">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-gray-200">Workspace Indexing & Setup</span>
              </div>
              <p className="text-[10px] text-gray-400">
                Trigger project mapping analyzers, build context mappings, or initialize `NOVA.md` code rules.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => executeCommand('/project')}
                  className="flex-1 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-bold text-[10px] py-1.5 rounded transition active:scale-95"
                >
                  Analyze Codebase Structure
                </button>
                <button
                  onClick={() => executeCommand('/init')}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] py-1.5 rounded transition active:scale-95"
                >
                  Initialize NOVA.md Rules
                </button>
              </div>
            </div>
          </div>

          {/* Vulnerability scan results window */}
          {vulnerabilityReport && (
            <div className="p-4 rounded-2xl bg-amber-950/10 border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-amber-400 flex items-center">
                  <Shield className="w-3.5 h-3.5 mr-2" />
                  Vulnerability Scan Report
                </h3>
                <button onClick={() => setVulnerabilityReport('')} className="text-[9px] text-gray-500 hover:text-white uppercase font-mono font-bold select-none">
                  Dismiss
                </button>
              </div>
              <pre className="text-[10px] text-gray-300 bg-black/40 border border-white/5 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                {vulnerabilityReport}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-[#07080c] text-gray-300 font-sans overflow-hidden select-none" style={{
      backgroundImage: `
        radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.05), transparent 45%),
        radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.05), transparent 45%)
      `
    }}>

      {/* TOP HEADER: Control Dashboard */}
      <header className="h-16 glass-panel backdrop-blur-md bg-[#04060e]/85 border-b border-white/5 flex items-center justify-between px-6 z-20 shadow-[0_4px_30px_rgba(0,0,0,0.5)] shrink-0 select-none">
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl shadow-lg shadow-indigo-500/25 border border-indigo-400/20 agent-core-active">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-extrabold text-white tracking-widest text-base flex items-center text-glow">
            NOVA <span className="text-cyan-400 ml-1 select-none font-light tracking-normal">Studio</span>
          </h1>
          
          {connected ? (
            isAgentThinking || currentStream ? (
              <div className="flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider shadow-[0_0_12px_rgba(245,158,11,0.15)] animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                <span>THINKING...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                <span>ONLINE: IDLE</span>
              </div>
            )
          ) : (
            <div className="flex items-center space-x-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <span>OFFLINE</span>
            </div>
          )}
          
          {/* Tab Navigation */}
          <div className="flex bg-[#0b0d19] rounded-xl p-1 ml-6 border border-white/10 shrink-0 select-none">
            <button
              onClick={() => {
                setIsSplitWorkspace(false);
                setActiveTab('chat');
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 flex items-center space-x-1.5 ${!isSplitWorkspace && activeTab === 'chat' ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/20 border border-indigo-400/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat Feed</span>
            </button>
            <button
              onClick={() => {
                if (isSplitWorkspace) {
                  setRightActiveTab('editor');
                } else {
                  setActiveTab('editor');
                }
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 flex items-center space-x-1.5 ${(isSplitWorkspace ? rightActiveTab === 'editor' : activeTab === 'editor') ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/20 border border-indigo-400/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Workspace IDE</span>
            </button>
            <button
              onClick={() => {
                if (isSplitWorkspace) {
                  setRightActiveTab('diff');
                } else {
                  setActiveTab('diff');
                }
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 flex items-center space-x-1.5 ${(isSplitWorkspace ? rightActiveTab === 'diff' : activeTab === 'diff') ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/20 border border-indigo-400/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Diff Explorer</span>
            </button>
            <button
              onClick={() => {
                setIsSplitWorkspace(false);
                setActiveTab('swarm');
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 flex items-center space-x-1.5 ${!isSplitWorkspace && activeTab === 'swarm' ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/20 border border-indigo-400/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Swarm debate</span>
            </button>
            <button
              onClick={() => {
                setIsSplitWorkspace(false);
                setActiveTab('toolbox');
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 flex items-center space-x-1.5 ${!isSplitWorkspace && activeTab === 'toolbox' ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/20 border border-indigo-400/20' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>CLI Toolbox</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-5">
          {/* Mode Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider">Mode</span>
            <div className="relative">
              <select
                value={currentMode}
                onChange={(e) => updateSettings({ mode: e.target.value })}
                className="appearance-none bg-[#0c0d16] border border-white/10 rounded-xl text-xs text-gray-200 pl-3.5 pr-8 py-1.5 outline-none hover:border-indigo-500/40 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all shadow-[0_0_10px_rgba(99,102,241,0.05)] cursor-pointer"
              >
                <option value="chat">Chat</option>
                <option value="agent">Agent (Autonomous)</option>
                <option value="plan">Plan</option>
                <option value="code">Code</option>
                <option value="fast">Fast (No Tools)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-indigo-400">
                <Sliders className="w-3 h-3" />
              </div>
            </div>
          </div>

          {/* Model Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider">Model</span>
            <div className="relative">
              <select
                value={currentModel}
                onChange={(e) => updateSettings({ model: e.target.value })}
                className="appearance-none bg-[#0c0d16] border border-white/10 rounded-xl text-xs text-gray-200 pl-3.5 pr-8 py-1.5 outline-none hover:border-indigo-500/40 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all shadow-[0_0_10px_rgba(99,102,241,0.05)] cursor-pointer min-w-[140px] max-w-[200px]"
              >
                {models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-cyan-400">
                <Sparkles className="w-3 h-3" />
              </div>
            </div>
          </div>

          {/* Layout Split Switcher */}
          <div className="flex bg-[#0b0d19] p-0.5 rounded-xl border border-white/10 select-none shrink-0">
            <button
              onClick={() => {
                setIsSplitWorkspace(true);
                // Ensure editor or diff is chosen on right
                if (activeTab === 'chat' || activeTab === 'swarm' || activeTab === 'toolbox') {
                  // Keep it split
                }
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300 ${isSplitWorkspace ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20' : 'text-gray-400 hover:text-gray-200'}`}
              title="Split Workspace Layout"
            >
              <Split className="w-3 h-3" />
              <span>Split</span>
            </button>
            <button
              onClick={() => setIsSplitWorkspace(false)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300 ${!isSplitWorkspace ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20' : 'text-gray-400 hover:text-gray-200'}`}
              title="Single Focus Tab Layout"
            >
              <Columns className="w-3 h-3" />
              <span>Tabbed</span>
            </button>
          </div>

          {/* Global Toolbar */}
          <div className="flex items-center space-x-1 bg-[#0b0d19] px-1.5 py-1 rounded-xl border border-white/10 shrink-0">
            <button onClick={() => executeCommand('/status')} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all hover:scale-105" title="System Status Dashboard">
              <Activity className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => executeCommand('/compress')} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all hover:scale-105" title="Compress Memory to Save Tokens">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => executeCommand('/clear')} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-rose-400 transition-all hover:scale-105" title="Clear Conversation Logs">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => executeCommand('/tools')} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all hover:scale-105" title="Inspect Registry Tools">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Primary Workspace */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Collapsible Left Panel toggle button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute left-4 bottom-4 z-30 p-2.5 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/20 border border-blue-400/20 hover:bg-blue-500 transition-all active:scale-95"
          title={isSidebarOpen ? "Hide Config Panel" : "Show Config Panel"}
        >
          {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        {/* LEFT PANEL: CONFIG & METRICS */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="border-r border-white/5 bg-[#090a0f]/95 backdrop-blur-md flex flex-col shrink-0 overflow-hidden relative z-10"
            >
              <div className="p-4 border-b border-white/5 bg-black/10 flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center select-none">
                  <Database className="w-3.5 h-3.5 mr-2 text-indigo-400" />
                  System Metrics
                </h3>
              </div>

              {/* Gauges & Variables */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin select-text">
                {/* Token Budget Gauge */}
                <div className="p-3.5 rounded-2xl bg-[#121420]/60 border border-white/5 space-y-2.5">
                  <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold select-none">Context Window</div>
                  
                  {systemStats.stats?.totalRequests !== undefined || true ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-gray-400">Memory usage</span>
                        <span className="text-indigo-400 font-bold">4.2k / 32k</span>
                      </div>
                      {/* Visual Progress Bar */}
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: '13%' }} />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-600">Awaiting sync...</div>
                  )}
                </div>

                {/* Session Statistics */}
                <div className="p-3.5 rounded-2xl bg-[#121420]/60 border border-white/5 space-y-2 select-none">
                  <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">Session Analytics</div>
                  <div className="space-y-1.5 font-mono text-[10px] text-gray-400">
                    <div className="flex justify-between">
                      <span>Total Requests</span>
                      <span className="text-white">{systemStats.stats?.totalRequests || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tokens Output</span>
                      <span className="text-white">12,481</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tool Calls</span>
                      <span className="text-white">8</span>
                    </div>
                  </div>
                </div>

                {/* System shortcuts list */}
                <div className="space-y-2 select-none">
                  <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">CLI Shortcut Actions</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => executeCommand('/clear')} className="py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] font-semibold text-center transition">
                      Clear Chat
                    </button>
                    <button onClick={() => executeCommand('/compress')} className="py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] font-semibold text-center transition">
                      Compress
                    </button>
                    <button onClick={() => executeCommand('/project')} className="py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] font-semibold text-center transition">
                      Index Repo
                    </button>
                    <button onClick={() => executeCommand('/tools')} className="py-2 px-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] font-semibold text-center transition">
                      List Tools
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TAB CONTENTS & SPLIT PANES */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Main workspace area */}
          <div className="flex-1 flex overflow-hidden">
            {isSplitWorkspace ? (
              <div className="flex-1 flex overflow-hidden">
                {/* Left Pane: Chat Room Feed */}
                <div className="w-[45%] flex flex-col border-r border-white/5 relative bg-[#07080a]/20">
                  {renderChatFeed()}
                </div>
                
                {/* Right Pane: Tabbed Editor / Diff Explorer */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[#07080a]/40">
                  {/* Sub-header navigation */}
                  <div className="h-10 flex items-center bg-[#0d0f14]/80 px-4 border-b border-white/5 justify-between select-none shrink-0 z-10">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setRightActiveTab('editor')}
                        className={`px-3 py-1 rounded text-[10px] font-bold tracking-wide uppercase transition ${
                          rightActiveTab === 'editor'
                            ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Interactive IDE
                      </button>
                      <button
                        onClick={() => setRightActiveTab('diff')}
                        className={`px-3 py-1 rounded text-[10px] font-bold tracking-wide uppercase transition ${
                          rightActiveTab === 'diff'
                            ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Visual Diff
                      </button>
                    </div>
                    {selectedFile && (
                      <span className="font-mono text-[10px] text-gray-500 bg-white/[0.02] border border-white/5 px-2 py-0.5 rounded">
                        Active: {selectedFile}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {rightActiveTab === 'editor' ? renderEditor() : renderDiff()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex overflow-hidden">
                {activeTab === 'chat' && renderChatFeed()}
                {activeTab === 'editor' && renderEditor()}
                {activeTab === 'diff' && renderDiff()}
                {activeTab === 'swarm' && renderSwarmDebate()}
                {activeTab === 'toolbox' && renderToolbox()}
              </div>
            )}
          </div>

          {/* LOWER LOGS PANEL: Scrolling terminal console output */}
          <div className="h-40 border-t border-white/5 bg-[#05060a]/95 flex flex-col overflow-hidden shrink-0 z-10">
            <div className="h-8 border-b border-white/5 bg-black/35 px-4 flex items-center justify-between select-none shrink-0">
              <div className="flex items-center space-x-2 text-gray-400 text-[10px] font-bold uppercase tracking-widest font-mono">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span>NOVA Live Command Console & Log Stream</span>
              </div>
              <button 
                onClick={() => setLogs([])}
                className="text-[9px] text-gray-500 hover:text-white uppercase font-mono font-bold hover:bg-white/5 px-2 py-0.5 rounded transition"
              >
                Clear logs
              </button>
            </div>
            
            <div className="flex-1 p-3 overflow-y-auto font-mono text-[10px] space-y-1.5 scrollbar-thin select-text bg-[#030407]">
              {logs.map((log, idx) => {
                let colorClass = 'text-gray-400';
                if (log.type === 'command') colorClass = 'text-blue-300 font-bold';
                else if (log.type === 'success') colorClass = 'text-green-400 font-bold';
                else if (log.type === 'error') colorClass = 'text-red-400 font-bold';
                else if (log.type === 'output') colorClass = 'text-gray-500 whitespace-pre overflow-x-auto';
                
                return (
                  <div key={idx} className={`leading-normal ${colorClass}`}>
                    {log.type !== 'output' && (
                      <span className="text-gray-600 select-none mr-2">
                        [{log.timestamp.toLocaleTimeString()}]
                      </span>
                    )}
                    {log.text}
                  </div>
                );
              })}
              {logs.length === 0 && (
                <div className="text-gray-600 animate-pulse">Console ready. Streaming active executions...</div>
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>

        </div>

        {/* RIGHT PANEL: GOAL TRACKER & ACTION PROTOCOLS */}
        <AnimatePresence initial={false}>
          {isRightSidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="border-l border-white/5 bg-[#090a0f]/95 backdrop-blur-md flex flex-col shrink-0 overflow-hidden relative z-10"
            >
              <div className="p-4 border-b border-white/5 bg-black/10 flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center select-none">
                  <Database className="w-3.5 h-3.5 mr-2 text-purple-400 animate-pulse" />
                  Goal Tracker
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin select-text">
                {!state ? (
                  <div className="text-xs text-gray-500 animate-pulse flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                    <span>Awaiting goal sync...</span>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Goal Card */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[9px] uppercase tracking-widest text-gray-500 font-bold select-none">Current Goal</h4>
                        <div className="flex items-center space-x-1">
                          <button 
                            onClick={() => { setEditedGoal(state.goal); setIsEditingGoal(!isEditingGoal); }} 
                            className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/5 transition" 
                            title="Edit Goal"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={downloadGoal} 
                            className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/5 transition" 
                            title="Download Goal as Artifact"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      {isEditingGoal ? (
                        <div className="space-y-2 bg-[#0b0c10]/40 p-2.5 rounded-xl border border-white/10">
                          <textarea
                            value={editedGoal}
                            onChange={(e) => setEditedGoal(e.target.value)}
                            className="w-full text-[11px] bg-black/40 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500/50 resize-y"
                            rows={3}
                          />
                          <div className="flex justify-end space-x-2">
                            <button 
                              onClick={() => setIsEditingGoal(false)} 
                              className="px-2 py-1 text-[9px] text-gray-400 hover:text-white rounded hover:bg-white/5"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => saveGoal(editedGoal)} 
                              className="px-2 py-1 text-[9px] bg-blue-500 hover:bg-blue-600 text-white rounded font-medium"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-blue-100 bg-gradient-to-br from-blue-600/10 to-indigo-500/5 p-4 rounded-xl border border-blue-500/15 leading-relaxed shadow-sm">
                          {state.goal || "System awaiting user instruction..."}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Phase</span>
                      <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        {state.phase.toUpperCase()}
                      </span>
                    </div>

                    {/* Active Task */}
                    {state.currentTask && (
                      <div className="space-y-2">
                        <h4 className="text-[9px] uppercase tracking-widest text-gray-500 font-bold select-none">Active Task</h4>
                        <div className="flex items-start space-x-2 bg-emerald-500/5 border border-emerald-500/15 p-3 rounded-lg">
                          <Play className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0 animate-pulse" />
                          <p className="text-xs text-gray-200 leading-normal">{state.currentTask}</p>
                        </div>
                      </div>
                    )}

                    {/* Checklists */}
                    {state.completed.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[9px] uppercase tracking-widest text-gray-500 font-bold select-none">Completed Steps</h4>
                        <ul className="space-y-2">
                          {state.completed.map((task, i) => (
                            <li key={i} className="group flex flex-col space-y-1">
                              <div className="flex items-start justify-between text-xs text-gray-400">
                                <div className="flex items-start space-x-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                                  <span className="line-through decoration-gray-600">{task}</span>
                                </div>
                                <button 
                                  onClick={() => setActiveCommentTask(activeCommentTask === task ? null : task)} 
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-500 hover:text-blue-400 transition" 
                                  title="Comment/Discuss"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </button>
                              </div>
                              {activeCommentTask === task && (
                                <div className="pl-5 flex items-center space-x-2 mt-1">
                                  <input
                                    type="text"
                                    placeholder="Request modification or discuss task..."
                                    value={taskComments[task] || ''}
                                    onChange={(e) => setTaskComments(prev => ({ ...prev, [task]: e.target.value }))}
                                    className="flex-1 text-[10px] bg-black/40 border border-white/10 rounded px-2 py-0.5 text-white focus:outline-none focus:border-blue-500/50"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') submitTaskComment(task, taskComments[task] || '');
                                    }}
                                  />
                                  <button 
                                    onClick={() => submitTaskComment(task, taskComments[task] || '')} 
                                    className="px-2 py-0.5 text-[9px] bg-blue-500 hover:bg-blue-600 text-white rounded font-medium"
                                  >
                                    Send
                                  </button>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {state.nextSteps.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[9px] uppercase tracking-widest text-gray-500 font-bold select-none">Next Actions</h4>
                        <ul className="space-y-2">
                          {state.nextSteps.map((task, i) => (
                            <li key={i} className="group flex flex-col space-y-1">
                              <div className="flex items-start justify-between text-xs text-gray-300">
                                <div className="flex items-start space-x-2">
                                  <Circle className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                                  <span>{task}</span>
                                </div>
                                <button 
                                  onClick={() => setActiveCommentTask(activeCommentTask === task ? null : task)} 
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-500 hover:text-blue-400 transition" 
                                  title="Comment/Discuss"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </button>
                              </div>
                              {activeCommentTask === task && (
                                <div className="pl-5 flex items-center space-x-2 mt-1">
                                  <input
                                    type="text"
                                    placeholder="Request modification or discuss task..."
                                    value={taskComments[task] || ''}
                                    onChange={(e) => setTaskComments(prev => ({ ...prev, [task]: e.target.value }))}
                                    className="flex-1 text-[10px] bg-black/40 border border-white/10 rounded px-2 py-0.5 text-white focus:outline-none focus:border-blue-500/50"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') submitTaskComment(task, taskComments[task] || '');
                                    }}
                                  />
                                  <button 
                                    onClick={() => submitTaskComment(task, taskComments[task] || '')} 
                                    className="px-2 py-0.5 text-[9px] bg-blue-500 hover:bg-blue-600 text-white rounded font-medium"
                                  >
                                    Send
                                  </button>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {state.failedAttempts.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[9px] uppercase tracking-widest text-red-400 font-bold select-none">Memory: Avoid paths</h4>
                        <ul className="space-y-2 bg-red-500/5 p-3 rounded-xl border border-red-500/10">
                          {state.failedAttempts.map((task, i) => (
                            <li key={i} className="flex items-start space-x-2 text-xs text-gray-400">
                              <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsible Right Panel toggle button */}
        <button
          onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          className="absolute right-4 bottom-4 z-30 p-2.5 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/20 border border-blue-400/20 hover:bg-blue-500 transition-all active:scale-95"
          title={isRightSidebarOpen ? "Hide Goal Tracker" : "Show Goal Tracker"}
        >
          {isRightSidebarOpen ? <PanelLeftClose className="w-4 h-4 transform rotate-180" /> : <PanelLeftOpen className="w-4 h-4 transform rotate-180" />}
        </button>

      </div>
    </div>
  );
}
