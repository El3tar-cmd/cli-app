/**
 * 🗺️  NOVA Project Map — Persistent mental model of the codebase
 *
 * • Scans on first run → caches to .nova/project-map.json
 * • Watches for file changes via fs.watch (debounced 2 s)
 * • Provides fast snapshot() for system-prompt injection
 * • Never re-scans if map is fresh — no wasted tokens
 */

import {
  readFileSync, writeFileSync, existsSync,
  mkdirSync, statSync, readdirSync,
  watch as fsWatch,
} from 'node:fs';
import { join, extname, relative, basename } from 'node:path';

// ── Constants ──────────────────────────────────────────────────────────────
const IGNORED = new Set([
  'node_modules', '.git', 'dist', 'build', '.cache',
  'coverage', '__pycache__', '.next', '.nuxt', 'vendor',
  '.nova', 'tmp', '.tmp',
]);

const KEY_FILE_NAMES = [
  'package.json', 'tsconfig.json', 'pyproject.toml', 'Cargo.toml',
  'go.mod', 'Dockerfile', 'docker-compose.yml', 'NOVA.md', 'README.md',
  '.env.example', 'vite.config.ts', 'vite.config.js',
];

const MAX_TREE_DEPTH   = 4;
const MAX_TREE_ENTRIES = 30;   // per directory
const MAX_KEY_CHARS    = 1200; // truncate key-file previews
const RESCAN_DEBOUNCE  = 2500; // ms

// ── Types ──────────────────────────────────────────────────────────────────
export interface ProjectMapData {
  lastUpdated: string;
  rootDir:     string;
  totalFiles:  number;
  totalDirs:   number;
  techStack:   string[];
  entryPoints: string[];
  languages:   Record<string, number>;
  dirTree:     string;
  keyFiles:    Record<string, string>;
  packageInfo?: {
    name:            string;
    version:         string;
    scripts:         Record<string, string>;
    dependencies:    string[];
    devDependencies: string[];
  };
}

// ── ProjectMap class ───────────────────────────────────────────────────────
export class ProjectMap {
  private cwd:      string;
  private mapPath:  string;
  private data:     ProjectMapData | null = null;
  private watcher:  ReturnType<typeof fsWatch> | null = null;
  private debTimer: ReturnType<typeof setTimeout> | null = null;
  private scanning  = false;

  constructor(cwd: string) {
    this.cwd     = cwd;
    this.mapPath = join(cwd, '.nova', 'project-map.json');
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /** Initialize: load cache or scan fresh, then start watcher */
  async init(): Promise<void> {
    const novaDir = join(this.cwd, '.nova');
    if (!existsSync(novaDir)) mkdirSync(novaDir, { recursive: true });

    if (existsSync(this.mapPath)) {
      try {
        this.data = JSON.parse(readFileSync(this.mapPath, 'utf-8'));
      } catch {
        await this.scan();
      }
    } else {
      await this.scan();
    }

    this._startWatcher();
  }

  /** Force a full re-scan (exposed as a tool) */
  async scan(): Promise<ProjectMapData> {
    if (this.scanning) return this.data!;
    this.scanning = true;

    try {
      const langs:  Record<string, number> = {};
      const files:  string[] = [];
      const dirs:   string[] = [];

      this._walk(this.cwd, files, dirs, langs);

      const dirTree   = this._buildTree(this.cwd, 0);
      const techStack = this._detectStack(files);
      const entries   = this._detectEntries(files);
      const keyFiles  = this._readKeyFiles();
      const pkgInfo   = this._parsePackageJson(keyFiles['package.json']);

      this.data = {
        lastUpdated: new Date().toISOString(),
        rootDir:     this.cwd,
        totalFiles:  files.length,
        totalDirs:   dirs.length,
        techStack,
        entryPoints: entries,
        languages:   langs,
        dirTree,
        keyFiles,
        packageInfo: pkgInfo,
      };

      this._save();
      return this.data;
    } finally {
      this.scanning = false;
    }
  }

  /** Compact one-shot string for system prompt injection */
  snapshot(): string {
    const m = this.data;
    if (!m) return '(project map not ready)';

    const age = Math.round((Date.now() - new Date(m.lastUpdated).getTime()) / 1000);
    const ageStr = age < 60 ? `${age}s ago` : `${Math.round(age / 60)}m ago`;

    const lines: string[] = [
      `📊 PROJECT MAP  [updated ${ageStr}]`,
      `Stack : ${m.techStack.join(', ') || 'unknown'}`,
      `Files : ${m.totalFiles}  Dirs: ${m.totalDirs}`,
    ];

    if (m.packageInfo) {
      lines.push(`Pkg   : ${m.packageInfo.name} ${m.packageInfo.version}`);
      const scripts = Object.keys(m.packageInfo.scripts);
      if (scripts.length) lines.push(`Scripts: ${scripts.join(', ')}`);
      if (m.packageInfo.dependencies.length)
        lines.push(`Deps  : ${m.packageInfo.dependencies.slice(0, 12).join(', ')}`);
    }

    if (m.entryPoints.length)
      lines.push(`Entry : ${m.entryPoints.join(', ')}`);

    const topLangs = Object.entries(m.languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([e, n]) => `${e}:${n}`)
      .join('  ');
    if (topLangs) lines.push(`Langs : ${topLangs}`);

    lines.push('', 'Structure:', m.dirTree.slice(0, 700).trimEnd());

    return lines.join('\n');
  }

  /** Quick patch hint (no re-scan needed for trivial changes) */
  touch(filePath: string, action: 'add' | 'modify' | 'delete'): void {
    // Just schedule a debounced rescan — no in-memory patch to avoid drift
    this._scheduleRescan();
  }

  /** Raw data access */
  getData(): ProjectMapData | null { return this.data; }

  /** Stop watching (call on shutdown) */
  destroy(): void {
    if (this.watcher)  { this.watcher.close();  this.watcher  = null; }
    if (this.debTimer) { clearTimeout(this.debTimer); this.debTimer = null; }
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private _walk(
    dir:   string,
    files: string[],
    dirs:  string[],
    langs: Record<string, number>,
    depth = 0,
  ): void {
    if (depth > 8) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const e of entries) {
      if (IGNORED.has(e.name) || e.name.startsWith('.')) continue;
      const full = join(dir, e.name);
      const rel  = relative(this.cwd, full);

      if (e.isDirectory()) {
        dirs.push(rel);
        this._walk(full, files, dirs, langs, depth + 1);
      } else {
        files.push(rel);
        const ext = extname(e.name).slice(1);
        if (ext) langs[ext] = (langs[ext] || 0) + 1;
      }
    }
  }

  private _buildTree(dir: string, depth: number): string {
    if (depth > MAX_TREE_DEPTH) return '';
    let out = '';
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return ''; }

    const visible = entries
      .filter(e => !IGNORED.has(e.name) && !e.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, MAX_TREE_ENTRIES);

    const pad = '  '.repeat(depth);
    for (const e of visible) {
      if (e.isDirectory()) {
        out += `${pad}${e.name}/\n`;
        out += this._buildTree(join(dir, e.name), depth + 1);
      } else {
        out += `${pad}${e.name}\n`;
      }
    }
    return out;
  }

  private _detectStack(files: string[]): string[] {
    const stack: string[] = [];
    const has = (name: string) => files.some(f => f.endsWith(name) || basename(f) === name);

    if (has('package.json')) {
      try {
        const pkg = JSON.parse(readFileSync(join(this.cwd, 'package.json'), 'utf-8'));
        const d = { ...pkg.dependencies, ...pkg.devDependencies };
        if (d.react)        stack.push('React');
        if (d.next)         stack.push('Next.js');
        if (d.vue)          stack.push('Vue');
        if (d.svelte)       stack.push('Svelte');
        if (d.express)      stack.push('Express');
        if (d.fastify)      stack.push('Fastify');
        if (d.vite)         stack.push('Vite');
        if (d.typescript || d['ts-node']) stack.push('TypeScript');
        if (d.tailwindcss)  stack.push('Tailwind');
        if (d.prisma)       stack.push('Prisma');
        if (d['better-sqlite3'] || d.drizzle) stack.push('SQLite');
        if (d.jest || d.vitest) stack.push('Testing');
      } catch {}
    }
    if (has('pyproject.toml') || has('requirements.txt')) stack.push('Python');
    if (has('Cargo.toml'))    stack.push('Rust');
    if (has('go.mod'))        stack.push('Go');
    if (has('Dockerfile'))    stack.push('Docker');
    return stack;
  }

  private _detectEntries(files: string[]): string[] {
    const candidates = [
      'src/index.ts','src/main.ts','src/app.ts','src/nova.ts',
      'index.ts','main.ts','app.ts','src/index.js','index.js',
      'main.py','app.py','main.go','src/main.rs',
    ];
    return candidates.filter(c => files.includes(c));
  }

  private _readKeyFiles(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const name of KEY_FILE_NAMES) {
      const p = join(this.cwd, name);
      if (existsSync(p)) {
        try {
          result[name] = readFileSync(p, 'utf-8').slice(0, MAX_KEY_CHARS);
        } catch {}
      }
    }
    return result;
  }

  private _parsePackageJson(raw?: string) {
    if (!raw) return undefined;
    try {
      const pkg = JSON.parse(raw);
      return {
        name:            pkg.name    || '',
        version:         pkg.version || '',
        scripts:         pkg.scripts || {},
        dependencies:    Object.keys(pkg.dependencies    || {}),
        devDependencies: Object.keys(pkg.devDependencies || {}),
      };
    } catch { return undefined; }
  }

  private _scheduleRescan(): void {
    if (this.debTimer) clearTimeout(this.debTimer);
    this.debTimer = setTimeout(() => {
      this.scan().catch(() => {});
    }, RESCAN_DEBOUNCE);
  }

  private _startWatcher(): void {
    try {
      this.watcher = fsWatch(this.cwd, { recursive: true }, (_evt, filename) => {
        if (!filename) return;
        const top = filename.split('/')[0];
        if (IGNORED.has(top) || top.startsWith('.')) return;
        this._scheduleRescan();
      });
    } catch {
      // fs.watch recursive not supported on all platforms — silently skip
    }
  }

  private _save(): void {
    try {
      writeFileSync(this.mapPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch {}
  }
}
