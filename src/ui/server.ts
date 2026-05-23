import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { Engine } from '../core/engine.js';
import { logger } from '../utils/logger.js';

export class NovaStudioServer {
  private app = express();
  private wss: WebSocketServer;
  private server: ReturnType<typeof createServer>;
  private authToken = crypto.randomBytes(32).toString('hex');

  constructor(private engine: Engine, private port: number = 3141) {
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSockets();
  }

  private setupMiddleware() {
    this.app.use(cors({
      origin: (origin, callback) => {
        if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          callback(null, true);
        } else {
          callback(new Error('CORS not allowed'));
        }
      }
    }));
    this.app.use(express.json());

    // Auth middleware for all API endpoints
    this.app.use((req, res, next) => {
      if (req.path === '/api/health') return next();
      if (!req.path.startsWith('/api')) return next();

      const ip = req.socket.remoteAddress;
      const host = req.headers.host || '';
      const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' ||
                      host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');

      if (isLocal) {
        return next();
      }

      const token = req.headers.authorization?.replace('Bearer ', '') || (req.query as any).token;
      if (token !== this.authToken) {
        return res.status(401).json({ error: 'Unauthorized — provide token via Authorization header or ?token= query param' });
      }
      next();
    });
    
    // Serve static files from the built web UI
    const webDir = join(__dirname, '..', '..', 'web', 'dist');
    this.app.use(express.static(webDir));
  }

  private getSafePath(reqPath: string, workspaceRoot: string): string {
    const resolved = resolve(workspaceRoot, reqPath);
    const rel = relative(workspaceRoot, resolved);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error('Access denied: Out of workspace bounds.');
    }
    return resolved;
  }

  private listFilesRecursive(dir: string, baseDir: string, visited: Set<string> = new Set(), maxFiles: number = 3000): any[] {
    const items: any[] = [];
    try {
      const resolvedDir = resolve(dir);
      if (visited.has(resolvedDir)) return [];
      visited.add(resolvedDir);

      const files = readdirSync(dir);
      const excludes = [
        'node_modules', '.git', 'dist', '.nova', '.gemini', '.nova-state.json', 
        'package-lock.json', 'venv', '.venv', 'env', '__pycache__', '.next', 
        '.nuxt', '.cache', 'build', 'out', 'target', 'vendor', '.idea', '.vscode'
      ];

      for (const file of files) {
        if (excludes.includes(file)) continue;
        if (items.length >= maxFiles) break;

        const fullPath = join(dir, file);
        const relPath = relative(baseDir, fullPath).replace(/\\/g, '/');
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            items.push({ path: relPath, name: file, isDir: true });
            const subItems = this.listFilesRecursive(fullPath, baseDir, visited, maxFiles - items.length);
            items.push(...subItems);
          } else {
            items.push({ path: relPath, name: file, isDir: false });
          }
        } catch {}
      }
    } catch {}
    return items;
  }

  private setupRoutes() {
    this.app.get('/api/state', (req, res) => {
      res.json(this.engine.getScratchpad().getState());
    });

    this.app.post('/api/state', (req, res) => {
      try {
        const partialState = req.body;
        const updated = this.engine.getScratchpad().update(partialState);
        this.broadcast({ type: 'state', data: updated });
        res.json({ success: true, state: updated });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/files', (req, res) => {
      try {
        const rootDir = (this.engine as any).cwd || process.cwd();
        const items = this.listFilesRecursive(rootDir, rootDir);
        res.json({ files: items });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/file', (req, res) => {
      try {
        const filePath = req.query.path as string;
        if (!filePath) {
          res.status(400).json({ error: 'Path is required' });
          return;
        }
        const rootDir = (this.engine as any).cwd || process.cwd();
        const safePath = this.getSafePath(filePath, rootDir);
        
        if (!existsSync(safePath) || statSync(safePath).isDirectory()) {
          res.status(404).json({ error: 'File not found' });
          return;
        }
        
        const content = readFileSync(safePath, 'utf-8');
        res.json({ content });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/file', (req, res) => {
      try {
        const { path: filePath, content } = req.body;
        if (!filePath || content === undefined) {
          res.status(400).json({ error: 'Path and content are required' });
          return;
        }
        const rootDir = (this.engine as any).cwd || process.cwd();
        const safePath = this.getSafePath(filePath, rootDir);
        
        writeFileSync(safePath, content, 'utf-8');
        
        this.broadcast({ type: 'token', data: `\n\n[SYSTEM] File edited via Web UI: ${filePath}\n\n` });
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/info', async (req, res) => {
      try {
        const models = await this.engine.listModels();
        const stats = this.engine.getStats();
        const currentModel = this.engine.getModel();
        
        // Robust fallback: ensure current model and common coding models are listed
        let modelsList = (models || []).map((m: any) => m.name);
        if (modelsList.length === 0) {
          modelsList = [currentModel, 'qwen2.5-coder:7b', 'qwen2.5-coder:1.5b', 'llama3'];
        } else if (!modelsList.includes(currentModel)) {
          modelsList.unshift(currentModel);
        }

        res.json({
          currentModel,
          currentMode: this.engine.getMode(),
          models: modelsList,
          stats
        });
      } catch (err) {
        // Safe recovery fallback if the whole API or tags fail
        const currentModel = this.engine.getModel();
        res.json({
          currentModel,
          currentMode: this.engine.getMode(),
          models: [currentModel, 'qwen2.5-coder:7b', 'qwen2.5-coder:1.5b', 'llama3'],
          stats: this.engine.getStats()
        });
      }
    });

    this.app.post('/api/settings', (req, res) => {
      const { model, mode } = req.body;
      if (model) this.engine.setModel(model);
      if (mode) this.engine.setMode(mode);
      
      // Let clients know about the update
      this.broadcast({ type: 'token', data: `\n\n[SYSTEM] Settings updated: Mode=${this.engine.getMode()}, Model=${this.engine.getModel()}\n\n` });
      res.json({ success: true });
    });

    this.app.post('/api/chat', async (req, res) => {
      const { message } = req.body;
      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      if (message.startsWith('/')) {
        const cmd = message.slice(1).trim().split(' ')[0];
        try {
          if (cmd === 'compress') {
            await (this.engine as any).compressContext?.();
            this.broadcast({ type: 'token', data: '\n[SYSTEM] Context compressed successfully.\n' });
          } else if (cmd === 'clear') {
            this.engine.getContext().clear();
            this.broadcast({ type: 'token', data: '\n[SYSTEM] Context cleared.\n' });
          } else if (cmd === 'status') {
            const stats = this.engine.getStats();
            this.broadcast({ type: 'token', data: `\n[SYSTEM] Status:\nTokens In: ${stats.totalTokensIn}\nTokens Out: ${stats.totalTokensOut}\nRequests: ${stats.totalRequests}\n` });
          } else if (cmd === 'tools') {
            const toolNames = this.engine.getTools().getNames();
            this.broadcast({ type: 'token', data: `\n[SYSTEM] Tools available: ${toolNames.join(', ')}\n` });
          } else if (cmd === 'model' && message.split(' ')[1]) {
            this.engine.setModel(message.split(' ')[1]);
            this.broadcast({ type: 'token', data: `\n[SYSTEM] Model switched to ${this.engine.getModel()}\n` });
          } else if (cmd === 'mode' && message.split(' ')[1]) {
            this.engine.setMode(message.split(' ')[1] as any);
            this.broadcast({ type: 'token', data: `\n[SYSTEM] Mode switched to ${this.engine.getMode()}\n` });
          } else if (['chat', 'fast', 'agent', 'code', 'plan'].includes(cmd)) {
            this.engine.setMode(cmd as any);
            this.broadcast({ type: 'token', data: `\n[SYSTEM] Mode switched to ${this.engine.getMode()}\n` });
          } else {
            this.broadcast({ type: 'token', data: `\n[SYSTEM] Command ${message} processed (GUI limited execution).\n` });
          }
        } catch (e: any) {
          this.broadcast({ type: 'token', data: `\n[ERROR] Command failed: ${e.message}\n` });
        }
        res.json({ status: 'done' });
        return;
      }

      // Normal chat processing
      this.engine.processMessage(message).catch(err => {
        logger.error('Engine error during studio chat:', err);
      });

      res.json({ status: 'processing' });
    });
  }

  private broadcast(payload: any) {
    const message = JSON.stringify(payload);
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private setupWebSockets() {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('Studio connected via WebSocket');

      // Send initial state
      ws.send(JSON.stringify({
        type: 'state',
        data: this.engine.getScratchpad().getState()
      }));

      // Listen to engine events and broadcast
      const onToken = (token: string) => {
        ws.send(JSON.stringify({ type: 'token', data: token }));
      };

      const onToolStart = (data: any) => {
        ws.send(JSON.stringify({ type: 'tool_start', data }));
      };

      const onToolEnd = (data: any) => {
        ws.send(JSON.stringify({ type: 'tool_end', data }));
        // Also send state update because tool might have updated scratchpad
        ws.send(JSON.stringify({
          type: 'state',
          data: this.engine.getScratchpad().getState()
        }));
      };

      this.engine.on('token', onToken);
      this.engine.on('tool_start', onToolStart);
      this.engine.on('tool_end', onToolEnd);

      // Skills & Sub-Agent visibility events
      const onSkillsActivated = (data: any) => {
        ws.send(JSON.stringify({ type: 'skills_activated', data }));
      };
      const onSubAgentSpawned = (data: any) => {
        ws.send(JSON.stringify({ type: 'subagent_spawned', data }));
      };
      const onSubAgentCompleted = (data: any) => {
        ws.send(JSON.stringify({ type: 'subagent_completed', data }));
      };

      this.engine.on('skills_activated', onSkillsActivated);
      this.engine.on('subagent_spawned', onSubAgentSpawned);
      this.engine.on('subagent_completed', onSubAgentCompleted);

      ws.on('close', () => {
        this.engine.off('token', onToken);
        this.engine.off('tool_start', onToolStart);
        this.engine.off('tool_end', onToolEnd);
        this.engine.off('skills_activated', onSkillsActivated);
        this.engine.off('subagent_spawned', onSubAgentSpawned);
        this.engine.off('subagent_completed', onSubAgentCompleted);
      });
    });
  }

  public getAuthToken(): string {
    return this.authToken;
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`\n🌌 NOVA Studio running at http://localhost:${this.port}\n`);
        resolve();
      });
    });
  }
}
