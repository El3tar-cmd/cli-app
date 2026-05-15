/**
 * 📋 NOVA.md — Project Configuration Loader
 * Auto-discovers and loads NOVA.md files (like CLAUDE.md)
 * Injects project-specific rules into system prompt
 */

import { readFileSync, existsSync, watchFile, unwatchFile } from 'node:fs';
import { join, dirname } from 'node:path';
import { logger } from '../utils/logger.js';

export interface NovaMdConfig {
  raw: string;
  sections: Map<string, string>;
  filePath: string;
}

export class NovaMdLoader {
  private config: NovaMdConfig | null = null;
  private onChange: (() => void) | null = null;

  /** Search for NOVA.md in cwd and parent directories */
  discover(startDir: string): NovaMdConfig | null {
    let dir = startDir;
    const checked: string[] = [];

    // Walk up to 5 levels looking for NOVA.md
    for (let i = 0; i < 5; i++) {
      const candidates = ['NOVA.md', 'nova.md', '.nova.md'];

      for (const name of candidates) {
        const filePath = join(dir, name);
        if (existsSync(filePath)) {
          try {
            const raw = readFileSync(filePath, 'utf-8');
            const sections = this.parseSections(raw);
            this.config = { raw, sections, filePath };
            logger.info(`Loaded ${name} from ${dir}`);
            return this.config;
          } catch (err: any) {
            logger.error(`Failed to read ${filePath}`, err);
          }
        }
      }

      checked.push(dir);
      const parent = dirname(dir);
      if (parent === dir) break; // Root reached
      dir = parent;
    }

    return null;
  }

  /** Parse markdown sections (## headings) */
  private parseSections(content: string): Map<string, string> {
    const sections = new Map<string, string>();
    const lines = content.split('\n');
    let currentSection = 'general';
    let currentContent: string[] = [];

    for (const line of lines) {
      const match = line.match(/^#{1,3}\s+(.+)$/);
      if (match) {
        // Save previous section
        if (currentContent.length > 0) {
          sections.set(currentSection.toLowerCase(), currentContent.join('\n').trim());
        }
        currentSection = match[1].trim();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentContent.length > 0) {
      sections.set(currentSection.toLowerCase(), currentContent.join('\n').trim());
    }

    return sections;
  }

  /** Watch for changes to NOVA.md */
  watch(callback: () => void): void {
    if (!this.config) return;
    this.onChange = callback;

    watchFile(this.config.filePath, { interval: 2000 }, () => {
      logger.info('NOVA.md changed, reloading...');
      try {
        const raw = readFileSync(this.config!.filePath, 'utf-8');
        this.config!.raw = raw;
        this.config!.sections = this.parseSections(raw);
        if (this.onChange) this.onChange();
      } catch (err: any) {
        logger.error('Failed to reload NOVA.md', err);
      }
    });
  }

  /** Stop watching */
  unwatch(): void {
    if (this.config) {
      unwatchFile(this.config.filePath);
    }
  }

  /** Get loaded config */
  getConfig(): NovaMdConfig | null {
    return this.config;
  }

  /** Format for injection into system prompt */
  formatForPrompt(): string {
    if (!this.config) return '';

    return `\n## Project Configuration (from NOVA.md)
The following rules and context are defined by the project owner. Follow them strictly.

${this.config.raw}

---
End of NOVA.md configuration.`;
  }

  /** Get a specific section */
  getSection(name: string): string | undefined {
    return this.config?.sections.get(name.toLowerCase());
  }
}
