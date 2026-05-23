/**
 * 📊 NOVA Project Index — Caches project structure and tech stack
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

export interface ProjectInfo {
  name: string;
  path: string;
  type: string;
  language: string;
  framework: string;
  packageManager: string;
  hasGit: boolean;
  hasDocker: boolean;
  hasCI: boolean;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  structure: FileNode[];
  keyFiles: string[];
  totalFiles: number;
  totalSize: number;
}

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
  children?: FileNode[];
  ext?: string;
}

export class ProjectIndex {
  private cache = new Map<string, ProjectInfo>();

  /** Analyze a project directory */
  analyze(projectPath: string): ProjectInfo {
    if (this.cache.has(projectPath)) return this.cache.get(projectPath)!;

    const info: ProjectInfo = {
      name: projectPath.split(/[/\\]/).pop() || 'unknown',
      path: projectPath,
      type: 'unknown',
      language: 'unknown',
      framework: 'none',
      packageManager: 'none',
      hasGit: existsSync(join(projectPath, '.git')),
      hasDocker: existsSync(join(projectPath, 'Dockerfile')),
      hasCI: existsSync(join(projectPath, '.github')) || existsSync(join(projectPath, '.gitlab-ci.yml')),
      dependencies: [],
      devDependencies: [],
      scripts: {},
      structure: [],
      keyFiles: [],
      totalFiles: 0,
      totalSize: 0,
    };

    // Detect from package.json
    const pkgPath = join(projectPath, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        info.name = pkg.name || info.name;
        info.type = pkg.type === 'module' ? 'ESM' : 'CommonJS';
        info.dependencies = Object.keys(pkg.dependencies || {});
        info.devDependencies = Object.keys(pkg.devDependencies || {});
        info.scripts = pkg.scripts || {};

        const allDeps = [...info.dependencies, ...info.devDependencies];
        if (allDeps.includes('next')) info.framework = 'Next.js';
        else if (allDeps.includes('nuxt')) info.framework = 'Nuxt';
        else if (allDeps.includes('react')) info.framework = 'React';
        else if (allDeps.includes('vue')) info.framework = 'Vue';
        else if (allDeps.includes('angular')) info.framework = 'Angular';
        else if (allDeps.includes('svelte')) info.framework = 'Svelte';
        else if (allDeps.includes('express')) info.framework = 'Express';
        else if (allDeps.includes('fastify')) info.framework = 'Fastify';
        else if (allDeps.includes('nest')) info.framework = 'NestJS';
      } catch {}
    }

    // Detect language
    if (existsSync(join(projectPath, 'tsconfig.json'))) info.language = 'TypeScript';
    else if (existsSync(join(projectPath, 'jsconfig.json'))) info.language = 'JavaScript';
    else if (existsSync(join(projectPath, 'Cargo.toml'))) { info.language = 'Rust'; info.type = 'Rust'; }
    else if (existsSync(join(projectPath, 'go.mod'))) { info.language = 'Go'; info.type = 'Go'; }
    else if (existsSync(join(projectPath, 'requirements.txt')) || existsSync(join(projectPath, 'pyproject.toml'))) { info.language = 'Python'; info.type = 'Python'; }

    // Detect package manager
    if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) info.packageManager = 'pnpm';
    else if (existsSync(join(projectPath, 'yarn.lock'))) info.packageManager = 'yarn';
    else if (existsSync(join(projectPath, 'bun.lockb'))) info.packageManager = 'bun';
    else if (existsSync(join(projectPath, 'package-lock.json'))) info.packageManager = 'npm';

    // Build file structure (2 levels deep)
    info.structure = this.buildTree(projectPath, 2);

    // Identify key files
    const keyFileNames = [
      'package.json', 'tsconfig.json', 'README.md', '.env', '.env.example',
      'Dockerfile', 'docker-compose.yml', '.gitignore', 'next.config.js',
      'vite.config.ts', 'tailwind.config.js', 'prisma/schema.prisma',
    ];
    for (const kf of keyFileNames) {
      if (existsSync(join(projectPath, kf))) info.keyFiles.push(kf);
    }

    this.cache.set(projectPath, info);
    return info;
  }

  private buildTree(dirPath: string, maxDepth: number, depth = 0): FileNode[] {
    if (depth >= maxDepth) return [];

    const ignoreList = ['node_modules', '.git', 'dist', '.next', '__pycache__', '.cache', 'coverage', '.turbo'];
    const nodes: FileNode[] = [];

    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (ignoreList.includes(entry.name)) continue;
        if (entry.name.startsWith('.') && depth > 0) continue;

        const fullPath = join(dirPath, entry.name);
        const node: FileNode = {
          name: entry.name,
          path: relative(dirPath, fullPath),
          isDir: entry.isDirectory(),
        };

        if (entry.isDirectory()) {
          node.children = this.buildTree(fullPath, maxDepth, depth + 1);
        } else {
          try {
            const stat = statSync(fullPath);
            node.size = stat.size;
          } catch {}
          node.ext = extname(entry.name);
        }
        nodes.push(node);
      }
    } catch {}

    return nodes;
  }

  /** Format project info for context injection */
  formatForContext(info: ProjectInfo): string {
    const lines = [
      `## Project: ${info.name}`,
      `- Language: ${info.language}`,
      `- Framework: ${info.framework}`,
      `- Type: ${info.type}`,
      `- Package Manager: ${info.packageManager}`,
      `- Git: ${info.hasGit ? 'Yes' : 'No'}`,
      `- Docker: ${info.hasDocker ? 'Yes' : 'No'}`,
    ];

    if (info.keyFiles.length > 0) {
      lines.push(`- Key Files: ${info.keyFiles.join(', ')}`);
    }

    if (info.dependencies.length > 0) {
      lines.push(`- Dependencies (${info.dependencies.length}): ${info.dependencies.slice(0, 15).join(', ')}${info.dependencies.length > 15 ? '...' : ''}`);
    }

    if (Object.keys(info.scripts).length > 0) {
      lines.push(`- Scripts: ${Object.keys(info.scripts).join(', ')}`);
    }

    return lines.join('\n');
  }

  /** Clear cache */
  clearCache(): void {
    this.cache.clear();
  }
}
