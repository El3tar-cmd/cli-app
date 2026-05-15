/**
 * 🧠 NOVA Knowledge Base — Persistent cross-session memory
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getNovaSubDir } from '../utils/helpers.js';

interface KnowledgeEntry {
  key: string;
  value: string;
  source: string;
  timestamp: number;
  project?: string;
}

export class KnowledgeBase {
  private store = new Map<string, KnowledgeEntry>();
  private filePath: string;

  constructor() {
    this.filePath = join(getNovaSubDir('memory'), 'knowledge.json');
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const data: KnowledgeEntry[] = JSON.parse(readFileSync(this.filePath, 'utf-8'));
        for (const entry of data) this.store.set(entry.key, entry);
      }
    } catch {}
  }

  private save(): void {
    writeFileSync(this.filePath, JSON.stringify(Array.from(this.store.values()), null, 2));
  }

  /** Store a fact */
  set(key: string, value: string, source = 'user', project?: string): void {
    this.store.set(key, { key, value, source, timestamp: Date.now(), project });
    this.save();
  }

  /** Retrieve a fact */
  get(key: string): string | undefined {
    return this.store.get(key)?.value;
  }

  /** Search facts by keyword */
  search(query: string): KnowledgeEntry[] {
    const q = query.toLowerCase();
    return Array.from(this.store.values()).filter(
      e => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q)
    );
  }

  /** Get all facts for a project */
  getProjectFacts(project: string): KnowledgeEntry[] {
    return Array.from(this.store.values()).filter(e => e.project === project);
  }

  /** Format knowledge for context injection */
  formatForContext(project?: string): string {
    const entries = project ? this.getProjectFacts(project) : Array.from(this.store.values());
    if (entries.length === 0) return '';
    const lines = entries.slice(-20).map(e => `- ${e.key}: ${e.value}`);
    return `## Known Facts\n${lines.join('\n')}`;
  }

  /** Delete a fact */
  delete(key: string): boolean {
    const result = this.store.delete(key);
    if (result) this.save();
    return result;
  }

  /** Clear all knowledge */
  clear(): void {
    this.store.clear();
    this.save();
  }

  /** Get count */
  getCount(): number {
    return this.store.size;
  }
}
