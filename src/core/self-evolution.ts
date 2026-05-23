/**
 * 🧬 NOVA Self-Evolution Engine
 * Analyzes platform performance, discovers patterns, and suggests/applies
 * data-driven improvements to configuration, prompts, and tool behavior.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getNovaSubDir } from '../utils/helpers.js';

// ── Types ─────────────────────────────────────────────

export interface ToolMetrics {
  success: number;
  fail: number;
  totalDuration: number;
  avgDuration: number;
}

export interface EvolutionEntry {
  timestamp: number;
  type: 'config' | 'prompt' | 'skill' | 'tool';
  key: string;
  before: any;
  after: any;
  reason: string;
  outcome?: 'improved' | 'degraded' | 'neutral';
}

export interface EvolutionReport {
  sessionDuration: number;
  totalRequests: number;
  avgResponseTime: number;
  tokenEfficiency: number;
  toolFailureRates: Array<{ tool: string; rate: number; total: number }>;
  contextCompressions: number;
  userSentiment: { positive: number; negative: number; neutral: number };
  bottlenecks: string[];
  strengths: string[];
}

export interface Improvement {
  id: string;
  type: 'config' | 'prompt' | 'skill' | 'tool';
  key: string;
  description: string;
  currentValue: any;
  suggestedValue: any;
  confidence: number; // 0-1
  reason: string;
}

// ── Main Class ────────────────────────────────────────

export class SelfEvolution {
  private responseTimes: number[] = [];
  private tokenUsage: Array<{ input: number; output: number }> = [];
  private toolMetrics = new Map<string, ToolMetrics>();
  private compressionCount = 0;
  private userSignals: Array<{ type: 'positive' | 'negative' | 'neutral'; text: string }> = [];
  private evolutionLog: EvolutionEntry[] = [];
  private sessionStart = Date.now();
  private requestCount = 0;
  private logDir: string;

  constructor() {
    this.logDir = getNovaSubDir('evolution');
    this.loadLog();
  }

  // ── Data Collection ─────────────────────────────────

  /** Record a request's response time */
  recordResponse(durationMs: number, tokensIn: number, tokensOut: number): void {
    this.requestCount++;
    this.responseTimes.push(durationMs);
    this.tokenUsage.push({ input: tokensIn, output: tokensOut });

    // Keep arrays bounded
    if (this.responseTimes.length > 500) this.responseTimes.shift();
    if (this.tokenUsage.length > 500) this.tokenUsage.shift();
  }

  /** Record a tool execution result */
  recordToolUse(toolName: string, success: boolean, durationMs: number): void {
    const existing = this.toolMetrics.get(toolName) || {
      success: 0, fail: 0, totalDuration: 0, avgDuration: 0,
    };
    if (success) existing.success++;
    else existing.fail++;
    existing.totalDuration += durationMs;
    existing.avgDuration = existing.totalDuration / (existing.success + existing.fail);
    this.toolMetrics.set(toolName, existing);
  }

  /** Record a context compression event */
  recordCompression(): void {
    this.compressionCount++;
  }

  /** Analyze user message for satisfaction signals */
  recordUserMessage(message: string): void {
    const lower = message.toLowerCase();
    const positiveWords = ['شكرا', 'thanks', 'perfect', 'excellent', 'great', 'ممتاز', 'تمام', 'amazing', 'awesome', 'good job', 'well done', 'بالظبط', 'حلو', 'رائع'];
    const negativeWords = ['wrong', 'غلط', 'no', 'لا', 'error', 'broken', 'خطأ', 'مش صح', 'مش شغال', 'bad', 'terrible', 'worst'];

    if (positiveWords.some(w => lower.includes(w))) {
      this.userSignals.push({ type: 'positive', text: message.slice(0, 100) });
    } else if (negativeWords.some(w => lower.includes(w))) {
      this.userSignals.push({ type: 'negative', text: message.slice(0, 100) });
    } else {
      this.userSignals.push({ type: 'neutral', text: message.slice(0, 100) });
    }

    // Keep bounded
    if (this.userSignals.length > 200) this.userSignals.shift();
  }

  // ── Analysis ────────────────────────────────────────

  /** Generate a comprehensive performance report */
  analyzePerformance(): EvolutionReport {
    const avgResponse = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;

    const totalTokensOut = this.tokenUsage.reduce((a, b) => a + b.output, 0);
    const totalTokensIn = this.tokenUsage.reduce((a, b) => a + b.input, 0);
    const tokenEfficiency = totalTokensIn > 0 ? totalTokensOut / totalTokensIn : 0;

    // Tool failure rates
    const failureRates: EvolutionReport['toolFailureRates'] = [];
    for (const [tool, metrics] of this.toolMetrics) {
      const total = metrics.success + metrics.fail;
      if (total >= 3) { // Only report tools with enough samples
        failureRates.push({
          tool,
          rate: metrics.fail / total,
          total,
        });
      }
    }
    failureRates.sort((a, b) => b.rate - a.rate);

    // User sentiment
    const positive = this.userSignals.filter(s => s.type === 'positive').length;
    const negative = this.userSignals.filter(s => s.type === 'negative').length;
    const neutral = this.userSignals.filter(s => s.type === 'neutral').length;

    // Identify bottlenecks
    const bottlenecks: string[] = [];
    const strengths: string[] = [];

    if (avgResponse > 15000) bottlenecks.push('High average response time (>15s)');
    if (this.compressionCount > 5) bottlenecks.push(`Frequent context compressions (${this.compressionCount}x) — consider shorter outputs`);
    if (tokenEfficiency > 3) bottlenecks.push('Token output/input ratio is high — model may be verbose');

    const highFailTools = failureRates.filter(t => t.rate > 0.3);
    for (const t of highFailTools) {
      bottlenecks.push(`Tool "${t.tool}" has ${Math.round(t.rate * 100)}% failure rate (${t.total} uses)`);
    }

    if (avgResponse < 5000 && avgResponse > 0) strengths.push('Fast response times (<5s)');
    if (negative === 0 && positive > 0) strengths.push('All user feedback is positive');
    if (this.compressionCount === 0 && this.requestCount > 5) strengths.push('No context compressions needed');

    return {
      sessionDuration: Date.now() - this.sessionStart,
      totalRequests: this.requestCount,
      avgResponseTime: Math.round(avgResponse),
      tokenEfficiency: Math.round(tokenEfficiency * 100) / 100,
      toolFailureRates: failureRates,
      contextCompressions: this.compressionCount,
      userSentiment: { positive, negative, neutral },
      bottlenecks,
      strengths,
    };
  }

  /** Suggest data-driven improvements */
  suggestImprovements(): Improvement[] {
    const report = this.analyzePerformance();
    const improvements: Improvement[] = [];
    let idCounter = 0;

    // 1. Auto-approve tools that never fail
    const neverFail = Array.from(this.toolMetrics.entries())
      .filter(([, m]) => m.fail === 0 && (m.success + m.fail) >= 5);
    if (neverFail.length > 0) {
      improvements.push({
        id: `imp-${++idCounter}`,
        type: 'config',
        key: 'tools.autoApprove',
        description: `Add ${neverFail.length} reliable tools to auto-approve list`,
        currentValue: '(current list)',
        suggestedValue: neverFail.map(([name]) => name),
        confidence: 0.85,
        reason: `These tools have 100% success rate over ${neverFail.reduce((a, [, m]) => a + m.success, 0)} combined uses`,
      });
    }

    // 2. Suggest compression threshold adjustment
    if (report.contextCompressions > 3 && report.totalRequests > 10) {
      const ratio = report.contextCompressions / report.totalRequests;
      if (ratio > 0.2) {
        improvements.push({
          id: `imp-${++idCounter}`,
          type: 'config',
          key: 'context.compressionThreshold',
          description: 'Lower compression threshold to compress earlier',
          currentValue: 0.65,
          suggestedValue: 0.55,
          confidence: 0.7,
          reason: `Context compression happening too frequently (${report.contextCompressions}x in ${report.totalRequests} requests). Earlier compression will prevent quality degradation.`,
        });
      }
    }

    // 3. Suggest disabling or fixing broken tools
    for (const tool of report.toolFailureRates) {
      if (tool.rate > 0.5 && tool.total >= 5) {
        improvements.push({
          id: `imp-${++idCounter}`,
          type: 'tool',
          key: `tools.${tool.tool}`,
          description: `Investigate or disable tool "${tool.tool}" — high failure rate`,
          currentValue: 'enabled',
          suggestedValue: 'needs investigation',
          confidence: 0.9,
          reason: `${Math.round(tool.rate * 100)}% failure rate over ${tool.total} uses`,
        });
      }
    }

    // 4. Suggest skill routing updates based on usage
    const skillUsage = new Map<string, number>();
    for (const entry of this.evolutionLog) {
      if (entry.type === 'skill') {
        skillUsage.set(entry.key, (skillUsage.get(entry.key) || 0) + 1);
      }
    }

    return improvements;
  }

  /** Apply an improvement (conservative — config-only) */
  async applyImprovement(improvement: Improvement, config: any): Promise<boolean> {
    try {
      const entry: EvolutionEntry = {
        timestamp: Date.now(),
        type: improvement.type,
        key: improvement.key,
        before: improvement.currentValue,
        after: improvement.suggestedValue,
        reason: improvement.reason,
      };

      // Only apply config changes automatically
      if (improvement.type === 'config' && config?.set) {
        config.set(improvement.key, improvement.suggestedValue);
        entry.outcome = 'neutral'; // Will be evaluated later
      }

      this.evolutionLog.push(entry);
      this.saveLog();
      return true;
    } catch {
      return false;
    }
  }

  /** Format report as readable text */
  formatReport(report: EvolutionReport): string {
    const lines: string[] = [];
    const dur = Math.round(report.sessionDuration / 60000);

    lines.push('🧬 NOVA Self-Evolution Report');
    lines.push('═'.repeat(40));
    lines.push('');
    lines.push(`📊 Session: ${dur} min, ${report.totalRequests} requests`);
    lines.push(`⏱️ Avg Response: ${report.avgResponseTime}ms`);
    lines.push(`📈 Token Efficiency: ${report.tokenEfficiency} (output/input ratio)`);
    lines.push(`🗜️ Context Compressions: ${report.contextCompressions}`);
    lines.push('');

    // User sentiment
    const { positive, negative, neutral } = report.userSentiment;
    lines.push(`😊 User Sentiment: +${positive} / -${negative} / ~${neutral}`);
    lines.push('');

    // Tool failure rates
    if (report.toolFailureRates.length > 0) {
      lines.push('🔧 Tool Reliability:');
      for (const t of report.toolFailureRates.slice(0, 8)) {
        const bar = '█'.repeat(Math.round((1 - t.rate) * 10)) + '░'.repeat(Math.round(t.rate * 10));
        lines.push(`  ${t.tool.padEnd(20)} ${bar} ${Math.round((1 - t.rate) * 100)}% (${t.total} uses)`);
      }
      lines.push('');
    }

    // Bottlenecks
    if (report.bottlenecks.length > 0) {
      lines.push('⚠️ Bottlenecks:');
      for (const b of report.bottlenecks) {
        lines.push(`  • ${b}`);
      }
      lines.push('');
    }

    // Strengths
    if (report.strengths.length > 0) {
      lines.push('✅ Strengths:');
      for (const s of report.strengths) {
        lines.push(`  • ${s}`);
      }
    }

    return lines.join('\n');
  }

  // ── Persistence ─────────────────────────────────────

  private getLogPath(): string {
    return join(this.logDir, 'evolution-log.json');
  }

  private loadLog(): void {
    try {
      const logPath = this.getLogPath();
      if (existsSync(logPath)) {
        const data = JSON.parse(readFileSync(logPath, 'utf-8'));
        this.evolutionLog = data.entries || [];
      }
    } catch {
      this.evolutionLog = [];
    }
  }

  private saveLog(): void {
    try {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }
      writeFileSync(this.getLogPath(), JSON.stringify({
        version: 1,
        lastUpdated: Date.now(),
        entries: this.evolutionLog.slice(-100), // Keep last 100 entries
      }, null, 2));
    } catch {
      // Silent fail — evolution logging is non-critical
    }
  }

  /** Get the full evolution log */
  getLog(): EvolutionEntry[] {
    return [...this.evolutionLog];
  }
}
