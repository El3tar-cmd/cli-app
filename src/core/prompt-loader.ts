/**
 * 📚 NOVA Prompt Loader — Dynamic markdown-based prompt system
 * Reads identity, skills, modes, and tools from .md files
 * instead of hardcoded strings. Enables hot-reload and easy customization.
 */

import { readFileSync, readdirSync, existsSync, watchFile, unwatchFile } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { logger } from '../utils/logger.js';

export interface PromptSection {
  name: string;
  filename: string;
  content: string;
  metadata: Record<string, string>;
}

export interface ModeConfig {
  name: string;
  content: string;
  temperature: number;
  contextLength: number;
}

export interface LoadedPrompts {
  identity: string;
  skills: PromptSection[];
  modes: Map<string, ModeConfig>;
  toolUsage: string;
}

export class PromptLoader {
  private promptsDir: string;
  private cache = new Map<string, string>();
  private watchers = new Map<string, ReturnType<typeof watchFile>>();
  private onChangeCallback: (() => void) | null = null;

  constructor(promptsDir: string) {
    this.promptsDir = promptsDir;
  }

  /** Load all prompts from the directory structure */
  loadAll(): LoadedPrompts {
    const identity = this.loadFile(join(this.promptsDir, 'identity.md'));
    const skills = this.loadDirectory(join(this.promptsDir, 'skills'));
    const modesRaw = this.loadDirectory(join(this.promptsDir, 'modes'));
    const toolUsage = this.loadFile(join(this.promptsDir, 'tool-usage.md'));

    // Parse mode configs
    const modes = new Map<string, ModeConfig>();
    for (const section of modesRaw) {
      const temp = this.extractMetaValue(section.content, 'Temperature');
      const ctx = this.extractMetaValue(section.content, 'Context');
      modes.set(section.name, {
        name: section.name,
        content: this.stripMetaSections(section.content),
        temperature: temp ? parseFloat(temp) : 0.7,
        contextLength: ctx ? parseInt(ctx.replace(/[^0-9]/g, ''), 10) : 128000,
      });
    }

    return { identity, skills, modes, toolUsage };
  }

  /** Build the full system prompt for a given mode */
  buildSystemPrompt(mode: string, extraContext?: string, activeSkills?: string[]): string {
    const prompts = this.loadAll();
    const parts: string[] = [];

    // 1. Identity (always first)
    if (prompts.identity) {
      parts.push(prompts.identity);
    }

    // 2. Skills (filtered if activeSkills is provided)
    if (prompts.skills.length > 0) {
      parts.push('\n## Professional Skills\n');
      for (const skill of prompts.skills) {
        if (!activeSkills || activeSkills.includes(skill.name)) {
          parts.push(skill.content);
        }
      }
    }

    // 3. Mode-specific instructions
    const modeConfig = prompts.modes.get(mode);
    if (modeConfig) {
      parts.push(`\n## Current Mode: ${modeConfig.name}\n`);
      parts.push(modeConfig.content);
    }

    // 4. Tool usage guide
    if (prompts.toolUsage) {
      parts.push('\n## Tool Usage\n');
      parts.push(prompts.toolUsage);
    }

    // 5. Extra context (NOVA.md, project-specific)
    if (extraContext) {
      parts.push('\n## Project Context\n');
      parts.push(extraContext);
    }

    return parts.join('\n\n');
  }

  /** Get mode configuration (temperature, context length) */
  getModeConfig(mode: string): ModeConfig | null {
    const prompts = this.loadAll();
    return prompts.modes.get(mode) || null;
  }

  /** Get list of available modes */
  getAvailableModes(): string[] {
    const modesDir = join(this.promptsDir, 'modes');
    if (!existsSync(modesDir)) return [];
    return readdirSync(modesDir)
      .filter(f => extname(f) === '.md')
      .map(f => basename(f, '.md'));
  }

  /** Get list of available skills */
  getAvailableSkills(): string[] {
    const skillsDir = join(this.promptsDir, 'skills');
    if (!existsSync(skillsDir)) return [];
    return readdirSync(skillsDir)
      .filter(f => extname(f) === '.md')
      .map(f => basename(f, '.md'));
  }

  /** Watch for file changes and trigger callback */
  watchForChanges(callback: () => void): void {
    this.onChangeCallback = callback;
    const dirs = [
      this.promptsDir,
      join(this.promptsDir, 'skills'),
      join(this.promptsDir, 'modes'),
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter(f => extname(f) === '.md');
      for (const file of files) {
        const fullPath = join(dir, file);
        watchFile(fullPath, { interval: 2000 }, () => {
          logger.info(`Prompt file changed: ${file}`);
          this.cache.delete(fullPath);
          this.onChangeCallback?.();
        });
        this.watchers.set(fullPath, undefined as any);
      }
    }
  }

  /** Stop watching files */
  stopWatching(): void {
    for (const path of this.watchers.keys()) {
      try { unwatchFile(path); } catch {}
    }
    this.watchers.clear();
  }

  // ─── Private helpers ─────────────────────────

  /** Load a single .md file */
  private loadFile(path: string): string {
    if (!existsSync(path)) return '';
    if (this.cache.has(path)) return this.cache.get(path)!;
    try {
      const content = readFileSync(path, 'utf-8');
      this.cache.set(path, content);
      return content;
    } catch (err: any) {
      logger.warn(`Failed to load prompt: ${path} — ${err.message}`);
      return '';
    }
  }

  /** Load all .md files from a directory */
  private loadDirectory(dirPath: string): PromptSection[] {
    if (!existsSync(dirPath)) return [];
    const sections: PromptSection[] = [];

    const files = readdirSync(dirPath)
      .filter(f => extname(f) === '.md')
      .sort();

    for (const file of files) {
      const fullPath = join(dirPath, file);
      const content = this.loadFile(fullPath);
      if (content) {
        sections.push({
          name: basename(file, '.md'),
          filename: file,
          content,
          metadata: this.extractMetadata(content),
        });
      }
    }

    return sections;
  }

  /** Extract key-value metadata from ## sections */
  private extractMetadata(content: string): Record<string, string> {
    const metadata: Record<string, string> = {};
    const regex = /^## (\w[\w\s]*)\n\n([^\n#]+)/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
      metadata[match[1].trim().toLowerCase()] = match[2].trim();
    }
    return metadata;
  }

  /** Extract a specific metadata value by section header */
  private extractMetaValue(content: string, header: string): string | null {
    const regex = new RegExp(`## ${header}\\s*\\n\\n([^\\n#]+)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  /** Remove metadata sections (Temperature, Context) from content */
  private stripMetaSections(content: string): string {
    return content
      .replace(/## Temperature\s*\n\n[^\n]+\n?/gi, '')
      .replace(/## Context\s*\n\n[^\n]+\n?/gi, '')
      .trim();
  }
}
