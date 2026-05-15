/**
 * 🔢 NOVA Token Counter
 * Approximate token counting for context budget management.
 * Uses a fast heuristic that's ~90% accurate for English text.
 */

export class TokenCounter {
  // Average chars per token varies by model, ~4 for most LLMs
  private static CHARS_PER_TOKEN = 4;

  /**
   * Estimate token count for a string
   */
  static count(text: string): number {
    if (!text) return 0;
    // Heuristic: ~4 chars per token for English, adjusted for code
    const baseCount = Math.ceil(text.length / this.CHARS_PER_TOKEN);
    // Code tends to have more tokens per char due to symbols
    const codeBonus = (text.match(/[{}()\[\];=<>]/g)?.length || 0) * 0.3;
    return Math.ceil(baseCount + codeBonus);
  }

  /**
   * Count tokens in a message array
   */
  static countMessages(messages: Array<{ role: string; content: string }>): number {
    let total = 0;
    for (const msg of messages) {
      // Each message has ~4 tokens overhead for role/formatting
      total += 4;
      total += this.count(msg.content);
    }
    return total;
  }

  /**
   * Format token count for display
   */
  static format(tokens: number): string {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
    return tokens.toString();
  }

  /**
   * Calculate percentage of budget used
   */
  static budgetUsage(used: number, total: number): number {
    if (total === 0) return 0;
    return Math.min(100, Math.round((used / total) * 100));
  }

  /**
   * Create a visual progress bar for token usage
   */
  static progressBar(used: number, total: number, width = 20): string {
    const pct = this.budgetUsage(used, total);
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${bar} ${pct}%`;
  }

  /**
   * Truncate text to fit within a token budget
   */
  static truncateToFit(text: string, maxTokens: number): string {
    const maxChars = maxTokens * this.CHARS_PER_TOKEN;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 3) + '...';
  }
}
