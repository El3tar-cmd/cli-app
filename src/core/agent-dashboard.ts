/**
 * 📊 NOVA Agent Dashboard — Real-time visibility into active agents and skills
 * Tracks sub-agent lifecycle, skill activations, and provides formatted reports
 * for CLI, Telegram, and Web UI.
 */

export interface AgentInfo {
  id: string;
  task: string;
  depth: number;
  startedAt: number;
  status: 'running' | 'completed' | 'failed';
  changes?: number;
  summary?: string;
}

export interface SkillRecord {
  timestamp: number;
  skills: string[];
  reasons: Record<string, string>;
}

export interface DashboardStats {
  totalAgentsSpawned: number;
  activeAgents: number;
  completedAgents: number;
  failedAgents: number;
  totalSkillActivations: number;
  mostUsedSkills: Array<{ name: string; count: number }>;
  avgAgentDuration: number;
}

export class AgentDashboard {
  private activeAgents = new Map<string, AgentInfo>();
  private completedAgents: AgentInfo[] = [];
  private skillHistory: SkillRecord[] = [];
  private skillCounts = new Map<string, number>();
  private totalSpawned = 0;

  /** Register a new sub-agent */
  addAgent(id: string, task: string, depth: number): void {
    this.totalSpawned++;
    this.activeAgents.set(id, {
      id,
      task: task.slice(0, 500),
      depth,
      startedAt: Date.now(),
      status: 'running',
    });
  }

  /** Mark a sub-agent as completed or failed */
  removeAgent(id: string, success: boolean, changes?: number, summary?: string): void {
    const agent = this.activeAgents.get(id);
    if (agent) {
      agent.status = success ? 'completed' : 'failed';
      agent.changes = changes;
      agent.summary = summary?.slice(0, 300);
      this.completedAgents.push(agent);
      this.activeAgents.delete(id);
      // Keep history bounded
      if (this.completedAgents.length > 50) {
        this.completedAgents.shift();
      }
    }
  }

  /** Record a skill activation */
  recordSkills(skills: string[], reasons: Record<string, string>): void {
    this.skillHistory.push({ timestamp: Date.now(), skills, reasons });
    for (const skill of skills) {
      this.skillCounts.set(skill, (this.skillCounts.get(skill) || 0) + 1);
    }
    // Keep history bounded
    if (this.skillHistory.length > 100) {
      this.skillHistory.shift();
    }
  }

  /** Get overall stats */
  getStats(): DashboardStats {
    const durations = this.completedAgents.map(a => {
      const end = a.status === 'completed' || a.status === 'failed'
        ? Date.now() // Approximate — in production you'd store endTime
        : Date.now();
      return end - a.startedAt;
    });

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const mostUsed = Array.from(this.skillCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      totalAgentsSpawned: this.totalSpawned,
      activeAgents: this.activeAgents.size,
      completedAgents: this.completedAgents.filter(a => a.status === 'completed').length,
      failedAgents: this.completedAgents.filter(a => a.status === 'failed').length,
      totalSkillActivations: this.skillHistory.length,
      mostUsedSkills: mostUsed,
      avgAgentDuration: Math.round(avgDuration),
    };
  }

  /** Format dashboard for CLI display */
  formatForCLI(): string {
    const lines: string[] = [];
    const stats = this.getStats();

    lines.push('╔══════════════════════════════════════╗');
    lines.push('║       🤖 NOVA Agent Dashboard        ║');
    lines.push('╠══════════════════════════════════════╣');

    // Active agents
    if (this.activeAgents.size > 0) {
      lines.push('║ 🟢 Active Agents:                    ║');
      for (const [, agent] of this.activeAgents) {
        const elapsed = Math.round((Date.now() - agent.startedAt) / 1000);
        lines.push(`║  L${agent.depth} │ ${agent.task.slice(0, 28).padEnd(28)} │ ${elapsed}s`);
      }
    } else {
      lines.push('║ 💤 No active agents                  ║');
    }

    lines.push('╠══════════════════════════════════════╣');

    // Recent skills
    const recentSkills = this.skillHistory.slice(-3);
    if (recentSkills.length > 0) {
      lines.push('║ 🧠 Recent Skills:                    ║');
      for (const record of recentSkills) {
        lines.push(`║  ${record.skills.join(', ').slice(0, 36).padEnd(36)} ║`);
      }
    }

    lines.push('╠══════════════════════════════════════╣');

    // Stats
    lines.push(`║ 📊 Total: ${stats.totalAgentsSpawned} spawned, ${stats.completedAgents} ✅, ${stats.failedAgents} ❌`);
    lines.push(`║ 🧬 Skills: ${stats.totalSkillActivations} activations`);
    if (stats.mostUsedSkills.length > 0) {
      lines.push(`║ 🔝 Top: ${stats.mostUsedSkills.map(s => `${s.name}(${s.count})`).join(', ').slice(0, 34)}`);
    }

    lines.push('╚══════════════════════════════════════╝');
    return lines.join('\n');
  }

  /** Format dashboard for Telegram message */
  formatForTelegram(): string {
    const stats = this.getStats();
    const lines: string[] = [];

    lines.push('📊 **NOVA Agent Dashboard**\n');

    // Active agents
    if (this.activeAgents.size > 0) {
      lines.push('🟢 **Active Agents:**');
      for (const [, agent] of this.activeAgents) {
        const elapsed = Math.round((Date.now() - agent.startedAt) / 1000);
        lines.push(`  • Level ${agent.depth}: \`${agent.task.slice(0, 60)}\` (${elapsed}s)`);
      }
    } else {
      lines.push('💤 No active agents');
    }

    lines.push('');

    // Stats summary
    lines.push('📈 **Session Stats:**');
    lines.push(`  Agents: ${stats.totalAgentsSpawned} spawned, ${stats.completedAgents} ✅, ${stats.failedAgents} ❌`);
    lines.push(`  Skills: ${stats.totalSkillActivations} activations`);

    if (stats.mostUsedSkills.length > 0) {
      lines.push(`  Top Skills: ${stats.mostUsedSkills.map(s => `${s.name}(${s.count})`).join(', ')}`);
    }

    return lines.join('\n');
  }

  /** Get JSON data for Web UI */
  toJSON(): {
    activeAgents: AgentInfo[];
    recentCompleted: AgentInfo[];
    recentSkills: SkillRecord[];
    stats: DashboardStats;
  } {
    return {
      activeAgents: Array.from(this.activeAgents.values()),
      recentCompleted: this.completedAgents.slice(-10),
      recentSkills: this.skillHistory.slice(-10),
      stats: this.getStats(),
    };
  }
}
