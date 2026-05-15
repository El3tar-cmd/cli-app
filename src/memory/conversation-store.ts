/**
 * 💾 NOVA Conversation Store — Persistent conversation storage
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { getNovaSubDir } from '../utils/helpers.js';

export interface SavedConversation {
  id: string;
  title: string;
  model: string;
  mode: string;
  messages: Array<{ role: string; content: string; timestamp: number }>;
  createdAt: number;
  updatedAt: number;
}

export class ConversationStore {
  private dir: string;

  constructor() {
    this.dir = getNovaSubDir('conversations');
  }

  /** Save a conversation */
  save(conversation: SavedConversation): void {
    const filePath = join(this.dir, `${conversation.id}.json`);
    writeFileSync(filePath, JSON.stringify(conversation, null, 2));
  }

  /** Load a conversation */
  load(id: string): SavedConversation | null {
    const filePath = join(this.dir, `${id}.json`);
    if (!existsSync(filePath)) return null;
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  /** List all saved conversations */
  list(): SavedConversation[] {
    try {
      const files = readdirSync(this.dir).filter(f => f.endsWith('.json'));
      return files
        .map(f => {
          try {
            return JSON.parse(readFileSync(join(this.dir, f), 'utf-8')) as SavedConversation;
          } catch { return null; }
        })
        .filter((c): c is SavedConversation => c !== null)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  /** Delete a conversation */
  delete(id: string): boolean {
    const filePath = join(this.dir, `${id}.json`);
    if (!existsSync(filePath)) return false;
    unlinkSync(filePath);
    return true;
  }

  /** Generate a title from first message */
  generateTitle(firstMessage: string): string {
    const cleaned = firstMessage.replace(/\n/g, ' ').trim();
    if (cleaned.length <= 50) return cleaned;
    return cleaned.slice(0, 47) + '...';
  }
}
