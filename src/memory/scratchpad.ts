/**
 * 📋 NOVA Scratchpad — Persistent Agent State for Long-Running Tasks
 * 
 * Solves "Attention Degradation" by maintaining a structured state document
 * that is always pinned at the top of the context window. The agent updates
 * this state after every significant action, ensuring it never loses track
 * of the goal, completed steps, or important constraints.
 * 
 * Architecture: Agent writes → Scratchpad formats → Engine injects into system prompt
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { TokenCounter } from '../utils/token-counter.js';
import { logger } from '../utils/logger.js';

export interface TaskState {
  /** The ultimate objective the user wants to achieve */
  goal: string;
  /** Current task being worked on */
  currentTask: string;
  /** Status: planning | implementing | debugging | testing | done */
  phase: 'planning' | 'implementing' | 'debugging' | 'testing' | 'reviewing' | 'done';
  /** Completed steps with brief descriptions */
  completed: string[];
  /** Failed attempts to avoid repeating mistakes */
  failedAttempts: string[];
  /** Next planned steps */
  nextSteps: string[];
  /** Critical constraints or decisions that must not be forgotten */
  constraints: string[];
  /** Key file paths involved in the current task */
  keyFiles: string[];
  /** Important technical decisions made */
  decisions: string[];
  /** Timestamp of last update */
  lastUpdated: number;
  /** Total steps taken */
  stepCount: number;
}

const DEFAULT_STATE: TaskState = {
  goal: '',
  currentTask: '',
  phase: 'planning',
  completed: [],
  failedAttempts: [],
  nextSteps: [],
  constraints: [],
  keyFiles: [],
  decisions: [],
  lastUpdated: Date.now(),
  stepCount: 0,
};

export class Scratchpad {
  private state: TaskState;
  private cwd: string;
  private filePath: string;

  constructor(cwd: string) {
    this.cwd = cwd;
    this.filePath = join(cwd, '.nova-state.json');
    this.state = this.load();
  }

  /** Load state from disk (or create default) */
  private load(): TaskState {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_STATE, ...parsed };
      }
    } catch (err: any) {
      logger.warn(`Failed to load scratchpad: ${err.message}`);
    }
    return { ...DEFAULT_STATE };
  }

  /** Persist state to disk */
  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf-8');
      this.writeGoalTrackerMarkdown();
    } catch (err: any) {
      logger.warn(`Failed to save scratchpad: ${err.message}`);
    }
  }

  /** Write goal tracker to NOVA_GOAL_TRACKER.md */
  public writeGoalTrackerMarkdown(): void {
    if (!this.state.goal) return;

    try {
      const trackerPath = join(this.cwd, 'NOVA_GOAL_TRACKER.md');
      const total = this.state.completed.length + this.state.nextSteps.length;
      let percent = total > 0 ? Math.round((this.state.completed.length / total) * 100) : 0;
      if (this.state.phase === 'done') percent = 100;

      const barWidth = 20;
      const filled = Math.round((percent / 100) * barWidth);
      const empty = barWidth - filled;
      const barStr = `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`;

      const lines: string[] = [];
      lines.push('# 🎯 NOVA Goal Tracker');
      lines.push('');
      lines.push(`- **Goal**: ${this.state.goal}`);
      lines.push(`- **Current Task**: ${this.state.currentTask || 'None'}`);
      lines.push(`- **Phase**: \`${this.state.phase.toUpperCase()}\``);
      lines.push(`- **Steps Executed**: ${this.state.stepCount}`);
      lines.push(`- **Last Updated**: ${new Date(this.state.lastUpdated).toLocaleString()}`);
      lines.push('');
      lines.push('## 📊 Progress');
      lines.push('`' + barStr + '`');
      lines.push('');

      if (this.state.nextSteps.length > 0) {
        lines.push('## 📝 Next Steps');
        for (const step of this.state.nextSteps) {
          lines.push(`- [ ] ${step}`);
        }
        lines.push('');
      }

      if (this.state.completed.length > 0) {
        lines.push('## ✅ Completed Steps');
        for (const step of this.state.completed) {
          lines.push(`- [x] ${step}`);
        }
        lines.push('');
      }

      if (this.state.constraints.length > 0) {
        lines.push('## ⚠️ Critical Constraints');
        for (const constraint of this.state.constraints) {
          lines.push(`- ${constraint}`);
        }
        lines.push('');
      }

      if (this.state.keyFiles.length > 0) {
        lines.push('## 📂 Key Files');
        for (const file of this.state.keyFiles) {
          lines.push(`- \`${file}\``);
        }
        lines.push('');
      }

      if (this.state.decisions.length > 0) {
        lines.push('## 🔑 Decisions Made');
        for (const dec of this.state.decisions) {
          lines.push(`- ${dec}`);
        }
        lines.push('');
      }

      if (this.state.failedAttempts.length > 0) {
        lines.push('## ❌ Failed Attempts (Avoid)');
        for (const fail of this.state.failedAttempts) {
          lines.push(`- ${fail}`);
        }
        lines.push('');
      }

      writeFileSync(trackerPath, lines.join('\n'), 'utf-8');
    } catch (err: any) {
      logger.warn(`Failed to write NOVA_GOAL_TRACKER.md: ${err.message}`);
    }
  }

  /** Update the scratchpad state (partial update) */
  update(partial: Partial<TaskState>): TaskState {
    // Merge arrays (append, don't replace)
    if (partial.completed) {
      this.state.completed = [...this.state.completed, ...partial.completed].slice(-20);
      delete partial.completed;
    }
    if (partial.failedAttempts) {
      this.state.failedAttempts = [...this.state.failedAttempts, ...partial.failedAttempts].slice(-10);
      delete partial.failedAttempts;
    }
    if (partial.decisions) {
      this.state.decisions = [...this.state.decisions, ...partial.decisions].slice(-10);
      delete partial.decisions;
    }

    // Override other fields
    Object.assign(this.state, partial);
    this.state.lastUpdated = Date.now();
    this.state.stepCount++;
    this.save();

    logger.info(`Scratchpad updated (step ${this.state.stepCount}): ${this.state.currentTask}`);
    return this.state;
  }

  /** Reset the scratchpad for a new task */
  reset(): void {
    this.state = { ...DEFAULT_STATE, lastUpdated: Date.now() };
    this.save();
  }

  /** Get current state */
  getState(): TaskState {
    return { ...this.state };
  }

  /** Check if a task is active */
  isActive(): boolean {
    return this.state.goal !== '' && this.state.phase !== 'done';
  }

  /** Format state for injection into system prompt */
  formatForPrompt(compact: boolean = false): string {
    if (!this.state.goal) return '';

    if (compact) {
      const parts = [
        `## 📋 Agent State (Scratchpad - Compact)`,
        `**🎯 Goal**: ${this.state.goal} | **📌 Current**: ${this.state.currentTask || 'None'} | **📊 Phase**: ${this.state.phase} (Step ${this.state.stepCount})`
      ];
      if (this.state.nextSteps.length > 0) {
        parts.push(`**📝 Next**: ${this.state.nextSteps.slice(0, 2).join('; ')}`);
      }
      if (this.state.completed.length > 0) {
        parts.push(`**✅ Done**: ${this.state.completed.slice(-2).join('; ')}`);
      }
      if (this.state.constraints.length > 0) {
        parts.push(`**⚠️ Constraints**: ${this.state.constraints.slice(0, 3).join('; ')}`);
      }
      return parts.join('\n');
    }

    const lines: string[] = [];
    lines.push('## 📋 Agent State (Scratchpad — Always Current)');
    lines.push('');
    lines.push(`**🎯 Goal**: ${this.state.goal}`);
    lines.push(`**📌 Current Task**: ${this.state.currentTask || 'Not started'}`);
    lines.push(`**📊 Phase**: ${this.state.phase} (Step ${this.state.stepCount})`);

    if (this.state.completed.length > 0) {
      lines.push('');
      lines.push('**✅ Completed:**');
      // Only show last 5 to save tokens
      const recent = this.state.completed.slice(-5);
      if (this.state.completed.length > 5) {
        lines.push(`  - *(${this.state.completed.length - 5} earlier steps omitted)*`);
      }
      for (const item of recent) {
        lines.push(`  - ${item}`);
      }
    }

    if (this.state.failedAttempts.length > 0) {
      lines.push('');
      lines.push('**❌ Failed Attempts (DO NOT REPEAT):**');
      for (const item of this.state.failedAttempts.slice(-3)) {
        lines.push(`  - ${item}`);
      }
    }

    if (this.state.nextSteps.length > 0) {
      lines.push('');
      lines.push('**📝 Next Steps:**');
      for (const item of this.state.nextSteps.slice(0, 3)) {
        lines.push(`  - ${item}`);
      }
    }

    if (this.state.constraints.length > 0) {
      lines.push('');
      lines.push('**⚠️ Critical Constraints:**');
      for (const item of this.state.constraints) {
        lines.push(`  - ${item}`);
      }
    }

    if (this.state.keyFiles.length > 0) {
      lines.push('');
      lines.push(`**📂 Key Files**: ${this.state.keyFiles.join(', ')}`);
    }

    if (this.state.decisions.length > 0) {
      lines.push('');
      lines.push('**🔑 Decisions Made:**');
      for (const item of this.state.decisions.slice(-3)) {
        lines.push(`  - ${item}`);
      }
    }

    lines.push('');
    lines.push('> Use the `update_state` tool to update this scratchpad after every significant action.');
    lines.push('');

    return lines.join('\n');
  }

  /** Get token count of the formatted prompt */
  getTokenCount(): number {
    return TokenCounter.count(this.formatForPrompt());
  }
}
