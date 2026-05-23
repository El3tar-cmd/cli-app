/**
 * 🧠 NOVA Context Manager — Smart context window with token budget tracking
 */

import { TokenCounter } from '../utils/token-counter.js';
import type { OllamaMessage } from '../core/ollama-client.js';

export interface ContextEntry {
  id: string;
  message: OllamaMessage;
  tokens: number;
  timestamp: number;
  pinned: boolean;
  compressed: boolean;
}

export class ContextManager {
  private entries: ContextEntry[] = [];
  private tokenBudget: number;
  private systemPrompt: string = '';
  private systemTokens: number = 0;

  constructor(tokenBudget: number = 128000) {
    this.tokenBudget = tokenBudget;
  }

  /** Set the system prompt */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    this.systemTokens = TokenCounter.count(prompt);
  }

  /** Add a message to context */
  addMessage(message: OllamaMessage, pinned = false): void {
    const tokens = TokenCounter.count(message.content);
    this.entries.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      message,
      tokens,
      timestamp: Date.now(),
      pinned,
      compressed: false,
    });
  }

  /** Get messages for API call, respecting token budget */
  getMessages(): OllamaMessage[] {
    const messages: OllamaMessage[] = [];

    // Always include system prompt
    if (this.systemPrompt) {
      messages.push({ role: 'system', content: this.systemPrompt });
    }

    // Calculate available budget
    let available = this.tokenBudget - this.systemTokens - 1000; // 1K buffer for response

    // Include messages from newest to oldest, respecting budget
    const entries = [...this.entries];
    const selected: ContextEntry[] = [];

    // Always include pinned messages first
    for (const entry of entries) {
      if (entry.pinned) {
        available -= entry.tokens;
        selected.push(entry);
      }
    }

    // Then add recent messages until budget exhausted
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.pinned) continue;
      if (entry.tokens <= available) {
        available -= entry.tokens;
        selected.unshift(entry);
      } else {
        continue; // Continue checking other messages that might fit
      }
    }

    // Sort by timestamp and build message array
    selected.sort((a, b) => a.timestamp - b.timestamp);
    for (const entry of selected) {
      messages.push(entry.message);
    }

    return messages;
  }

  /** Get context usage stats */
  getStats(): { used: number; budget: number; messages: number; percentage: number } {
    const used = this.systemTokens + this.entries.reduce((sum, e) => sum + e.tokens, 0);
    return {
      used,
      budget: this.tokenBudget,
      messages: this.entries.length,
      percentage: TokenCounter.budgetUsage(used, this.tokenBudget),
    };
  }

  /** Clear all non-pinned context */
  clear(): void {
    this.entries = this.entries.filter((e) => e.pinned);
  }

  /** Clear everything */
  clearAll(): void {
    this.entries = [];
  }

  /** Get last N messages */
  getRecent(n: number): ContextEntry[] {
    return this.entries.slice(-n);
  }

  /** Compress old messages by summarizing them */
  async compress(summarizer: (text: string) => Promise<string>): Promise<number> {
    if (this.entries.length < 6) return 0;

    // Take oldest 2/3 of messages (keep recent 1/3)
    const keepCount = Math.max(4, Math.ceil(this.entries.length / 3));
    const toCompress = this.entries.slice(0, this.entries.length - keepCount).filter(e => !e.pinned);

    if (toCompress.length < 3) return 0;

    // Build text to summarize
    const text = toCompress.map(e => `${e.message.role}: ${e.message.content}`).join('\n\n');
    const originalTokens = toCompress.reduce((sum, e) => sum + e.tokens, 0);

    try {
      const summary = await summarizer(text);
      const summaryTokens = TokenCounter.count(summary);

      // Remove compressed entries
      const compressedIds = new Set(toCompress.map(e => e.id));
      this.entries = this.entries.filter(e => !compressedIds.has(e.id));

      // Add summary as a single entry
      this.entries.unshift({
        id: 'compressed-' + Date.now(),
        message: { role: 'system', content: `[Previous conversation summary]\n${summary}` },
        tokens: summaryTokens,
        timestamp: toCompress[0].timestamp,
        pinned: false,
        compressed: true,
      });

      return originalTokens - summaryTokens;
    } catch {
      return 0;
    }
  }

  /** Set token budget */
  setBudget(budget: number): void {
    this.tokenBudget = budget;
  }

  /** Export conversation for saving */
  export(): Array<{ role: string; content: string; timestamp: number }> {
    return this.entries.map(e => ({
      role: e.message.role,
      content: e.message.content,
      timestamp: e.timestamp,
    }));
  }

  /** Import conversation */
  import(data: Array<{ role: string; content: string; timestamp: number }>): void {
    this.entries = data.map(d => ({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      message: { role: d.role as any, content: d.content },
      tokens: TokenCounter.count(d.content),
      timestamp: d.timestamp,
      pinned: false,
      compressed: false,
    }));
  }
}
