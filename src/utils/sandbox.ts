import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { generateId } from './helpers.js';
import { DiffEditor } from '../tools/diff-editor.js';
import { logger } from './logger.js';

export interface SandboxChange {
  path: string; // Relative path from project root
  type: 'NEW' | 'MODIFY' | 'DELETE';
  content?: string; // New/modified content
  patch?: string; // Unified diff patch
}

export class SandboxManager {
  private id: string;
  private sandboxPath: string;
  private copiedFiles = new Set<string>(); // Relative paths

  constructor(private projectCwd: string) {
    this.id = generateId();
    this.sandboxPath = resolve(projectCwd, '.nova', 'sandboxes', `sb-${this.id}`);
  }

  /** Gets the generated ID of this sandbox */
  getId(): string {
    return this.id;
  }

  /** Gets the absolute path to the sandbox workspace */
  getPath(): string {
    return this.sandboxPath;
  }

  /** Initialize the sandbox and copy standard config files */
  init(focusFiles: string[] = []): void {
    if (!existsSync(this.sandboxPath)) {
      mkdirSync(this.sandboxPath, { recursive: true });
    }

    // Always copy standard configurations to ensure compilation and environment matches
    const configsToCopy = [
      'package.json',
      'tsconfig.json',
      'tsconfig.app.json',
      'tsconfig.node.json',
      'tailwind.config.js',
      'postcss.config.js',
      'vite.config.ts',
      'eslint.config.js',
      '.nova-state.json',
      'NOVA.md',
    ];

    for (const config of configsToCopy) {
      const src = join(this.projectCwd, config);
      if (existsSync(src)) {
        this.copyFile(config);
      }
    }

    // Copy targeted focus files
    for (const file of focusFiles) {
      this.copyFile(file);
    }

    logger.info(`Sandbox ${this.id} initialized with ${this.copiedFiles.size} copied files.`);
  }

  /** Copy a specific file into the sandbox, preserving folder structure */
  copyFile(relativeFilePath: string): boolean {
    try {
      const src = resolve(this.projectCwd, relativeFilePath);
      if (!existsSync(src)) return false;

      // Ensure file stays within project Cwd
      const normalizedSrc = resolve(this.projectCwd);
      if (!src.startsWith(normalizedSrc)) return false;

      const dest = join(this.sandboxPath, relativeFilePath);
      const destDir = dirname(dest);

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      const content = readFileSync(src, 'utf-8');
      writeFileSync(dest, content, 'utf-8');
      this.copiedFiles.add(relativeFilePath);
      return true;
    } catch (err: any) {
      logger.warn(`Failed to copy file ${relativeFilePath} to sandbox: ${err.message}`);
      return false;
    }
  }

  /** Scan the sandbox workspace and compare it against the original project directory */
  compareChanges(): SandboxChange[] {
    const changes: SandboxChange[] = [];
    const scanDir = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = relative(this.sandboxPath, fullPath);

        // Ignore sandbox-only runtime logs or typical modules folder
        if (relPath.startsWith('node_modules') || relPath.startsWith('.git') || relPath.startsWith('.nova')) {
          continue;
        }

        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile()) {
          const originalFile = join(this.projectCwd, relPath);
          const modifiedContent = readFileSync(fullPath, 'utf-8');

          if (!existsSync(originalFile)) {
            // New File
            changes.push({
              path: relPath,
              type: 'NEW',
              content: modifiedContent,
            });
          } else {
            // Modified File
            const originalContent = readFileSync(originalFile, 'utf-8');
            if (originalContent !== modifiedContent) {
              const patch = DiffEditor.createDiff(originalContent, modifiedContent, relPath);
              changes.push({
                path: relPath,
                type: 'MODIFY',
                content: modifiedContent,
                patch,
              });
            }
          }
        }
      }
    };

    if (existsSync(this.sandboxPath)) {
      scanDir(this.sandboxPath);
    }

    // Check for deleted files (if copied initially but missing now)
    for (const relPath of this.copiedFiles) {
      const sandboxFile = join(this.sandboxPath, relPath);
      if (!existsSync(sandboxFile)) {
        changes.push({
          path: relPath,
          type: 'DELETE',
        });
      }
    }

    return changes;
  }

  /** Clean up and recursively delete the sandbox workspace */
  destroy(): void {
    try {
      if (existsSync(this.sandboxPath)) {
        rmSync(this.sandboxPath, { recursive: true, force: true });
        logger.info(`Sandbox ${this.id} destroyed.`);
      }
    } catch (err: any) {
      logger.warn(`Failed to destroy sandbox ${this.id}: ${err.message}`);
    }
  }
}
