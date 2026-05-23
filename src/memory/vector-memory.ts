/**
 * 🔮 NOVA Vector Memory — Local Semantic Memory using Embeddings
 * 
 * Stores embeddings of past interactions, code snippets, and decisions
 * in a local SQLite database. Enables the agent to retrieve relevant
 * past context by meaning (not just recency), drastically reducing
 * hallucination and improving accuracy on long-running tasks.
 * 
 * Uses Ollama's embedding API for local, private vector generation.
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { logger } from '../utils/logger.js';

export interface MemoryEntry {
  id: number;
  content: string;
  category: 'interaction' | 'code' | 'decision' | 'error' | 'plan';
  embedding: number[];
  metadata: string;
  timestamp: number;
  tokens: number;
}

export interface RetrievedMemory {
  content: string;
  category: string;
  similarity: number;
  timestamp: number;
}

export class VectorMemory {
  private db: Database.Database | null = null;
  private embedFn: ((text: string) => Promise<number[]>) | null = null;
  private dimension: number = 0;

  constructor(private storagePath: string) {}

  /** Initialize the database and embedding function */
  async init(embedFn: (text: string) => Promise<number[]>): Promise<void> {
    this.embedFn = embedFn;

    // Ensure storage directory exists
    const dir = this.storagePath;
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const dbPath = join(dir, 'vector-memory.db');

    try {
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');

      // Create table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS memories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'interaction',
          embedding BLOB NOT NULL,
          metadata TEXT DEFAULT '{}',
          tokens INTEGER DEFAULT 0,
          timestamp INTEGER NOT NULL,
          session_id TEXT DEFAULT ''
        )
      `);

      // Create index on category and timestamp
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
        CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp);
      `);

      // Detect embedding dimension with a test embed
      try {
        const testEmbed = await embedFn('test');
        this.dimension = testEmbed.length;
        logger.info(`Vector memory initialized (dim=${this.dimension}, db=${dbPath})`);
      } catch {
        logger.warn('Could not detect embedding dimension — vector memory will use fallback');
        this.dimension = 0;
      }

    } catch (err: any) {
      logger.warn(`Failed to initialize vector memory: ${err.message}`);
      this.db = null;
    }
  }

  /** Store a memory with its embedding */
  async store(content: string, category: MemoryEntry['category'], metadata: Record<string, any> = {}): Promise<boolean> {
    if (!this.db || !this.embedFn || !content.trim()) return false;

    try {
      const embedding = await this.embedFn(content);
      const embeddingBlob = Buffer.from(new Float32Array(embedding).buffer);

      const stmt = this.db.prepare(`
        INSERT INTO memories (content, category, embedding, metadata, tokens, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        content.slice(0, 5000), // Cap content to prevent huge entries
        category,
        embeddingBlob,
        JSON.stringify(metadata),
        Math.ceil(content.length / 4), // rough token estimate
        Date.now()
      );

      return true;
    } catch (err: any) {
      logger.warn(`Failed to store memory: ${err.message}`);
      return false;
    }
  }

  /** Retrieve the most relevant memories for a query */
  async retrieve(query: string, topK: number = 3, category?: string): Promise<RetrievedMemory[]> {
    if (!this.db || !this.embedFn || this.dimension === 0) return [];

    try {
      const queryEmbedding = await this.embedFn(query);

      // Get all memories (or filtered by category)
      let rows: any[];
      if (category) {
        const stmt = this.db.prepare('SELECT content, category, embedding, timestamp FROM memories WHERE category = ? ORDER BY timestamp DESC LIMIT 200');
        rows = stmt.all(category);
      } else {
        const stmt = this.db.prepare('SELECT content, category, embedding, timestamp FROM memories ORDER BY timestamp DESC LIMIT 200');
        rows = stmt.all();
      }

      // Compute cosine similarity for each
      const scored: RetrievedMemory[] = [];
      for (const row of rows) {
        const stored = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
        const sim = this.cosineSimilarity(queryEmbedding, Array.from(stored));

        if (sim > 0.3) { // Minimum relevance threshold
          scored.push({
            content: row.content,
            category: row.category,
            similarity: sim,
            timestamp: row.timestamp,
          });
        }
      }

      // Sort by similarity (descending) and return top K
      scored.sort((a, b) => b.similarity - a.similarity);
      return scored.slice(0, topK);

    } catch (err: any) {
      logger.warn(`Failed to retrieve memories: ${err.message}`);
      return [];
    }
  }

  /** Get memory stats */
  getStats(): { totalEntries: number; categories: Record<string, number> } {
    if (!this.db) return { totalEntries: 0, categories: {} };

    try {
      const total = this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as any;
      const cats = this.db.prepare('SELECT category, COUNT(*) as count FROM memories GROUP BY category').all() as any[];

      const categories: Record<string, number> = {};
      for (const cat of cats) {
        categories[cat.category] = cat.count;
      }

      return { totalEntries: total.count, categories };
    } catch {
      return { totalEntries: 0, categories: {} };
    }
  }

  /** Clear old memories (keep last N days) */
  prune(daysToKeep: number = 30): number {
    if (!this.db) return 0;

    try {
      const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      const result = this.db.prepare('DELETE FROM memories WHERE timestamp < ?').run(cutoff);
      return result.changes;
    } catch {
      return 0;
    }
  }

  /** Check if initialized */
  isReady(): boolean {
    return this.db !== null && this.dimension > 0;
  }

  /** Close database */
  close(): void {
    this.db?.close();
  }

  /** Cosine similarity between two vectors */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
