/**
 * 🧠 NOVA Model Router — Intelligent multi-model orchestration
 * Routes queries to the optimal model based on task complexity,
 * mode, and configured profiles
 */

import type { ConfigManager } from './config.js';
import { OllamaClient } from './ollama-client.js';
import { logger } from '../utils/logger.js';

export interface ModelProfile {
  model: string;
  contextLength: number;
  temperature: number;
  description: string;
}

export interface ModelProfiles {
  chat: ModelProfile;
  code: ModelProfile;
  fast: ModelProfile;
  agent: ModelProfile;
  plan: ModelProfile;
}

// Default profiles — users can override via config
const DEFAULT_PROFILES: ModelProfiles = {
  chat: {
    model: '',    // Empty = use global default
    contextLength: 128000,
    temperature: 0.7,
    description: 'General conversation with balanced creativity',
  },
  code: {
    model: '',
    contextLength: 128000,
    temperature: 0.3,
    description: 'Code generation — low temperature for precision',
  },
  fast: {
    model: '',
    contextLength: 32000,
    temperature: 0.5,
    description: 'Quick responses with smaller context',
  },
  agent: {
    model: '',
    contextLength: 128000,
    temperature: 0.4,
    description: 'Autonomous execution — balanced for tool use',
  },
  plan: {
    model: '',
    contextLength: 128000,
    temperature: 0.5,
    description: 'Planning and architecture — structured output',
  },
};

export type NovaMode = 'chat' | 'code' | 'fast' | 'agent' | 'plan';

export class ModelRouter {
  private profiles: ModelProfiles;
  private globalModel: string;
  private ollamaClient: OllamaClient;
  private availableModels: string[] = [];

  constructor(ollamaClient: OllamaClient, globalModel: string, customProfiles?: Partial<ModelProfiles>) {
    this.ollamaClient = ollamaClient;
    this.globalModel = globalModel;
    this.profiles = { ...DEFAULT_PROFILES };

    // Apply custom profiles
    if (customProfiles) {
      for (const [mode, profile] of Object.entries(customProfiles)) {
        if (mode in this.profiles) {
          this.profiles[mode as NovaMode] = { ...this.profiles[mode as NovaMode], ...profile };
        }
      }
    }
  }

  /** Get the model to use for a given mode */
  getModelForMode(mode: NovaMode): string {
    const profile = this.profiles[mode];
    return profile?.model || this.globalModel;
  }

  /** Get the full profile for a mode */
  getProfile(mode: NovaMode): ModelProfile {
    const profile = this.profiles[mode] || DEFAULT_PROFILES.chat;
    return {
      ...profile,
      model: profile.model || this.globalModel,
    };
  }

  /** Set model for a specific mode */
  setModelForMode(mode: NovaMode, model: string): void {
    if (this.profiles[mode]) {
      this.profiles[mode].model = model;
      logger.info(`Model for ${mode} mode set to: ${model}`);
    }
  }

  /** Set the global default model */
  setGlobalModel(model: string): void {
    this.globalModel = model;
  }

  /** Get all profiles as a display-friendly format */
  getProfilesDisplay(): Array<{ mode: string; model: string; temp: number; ctx: number; desc: string }> {
    return (Object.entries(this.profiles) as [NovaMode, ModelProfile][]).map(([mode, profile]) => ({
      mode,
      model: profile.model || `${this.globalModel} (default)`,
      temp: profile.temperature,
      ctx: profile.contextLength,
      desc: profile.description,
    }));
  }

  /** Auto-detect complexity and suggest the best mode */
  suggestMode(query: string): NovaMode {
    const lower = query.toLowerCase();

    // Agent mode indicators
    const agentKeywords = [
      'build', 'create project', 'implement', 'set up', 'scaffold',
      'fix all', 'refactor', 'migrate', 'deploy', 'install',
      'run tests', 'debug', 'optimize',
    ];
    if (agentKeywords.some(k => lower.includes(k))) return 'agent';

    // Code mode indicators
    const codeKeywords = [
      'write a function', 'implement', 'code', 'class', 'interface',
      'component', 'api', 'endpoint', 'hook', 'type',
      'regex', 'algorithm', 'sort', 'parse',
    ];
    if (codeKeywords.some(k => lower.includes(k))) return 'code';

    // Plan mode indicators
    const planKeywords = [
      'plan', 'design', 'architect', 'propose', 'strategy',
      'how should', 'what approach', 'rfc', 'spec',
    ];
    if (planKeywords.some(k => lower.includes(k))) return 'plan';

    // Fast mode for short queries
    if (query.length < 50 && !query.includes('\n')) return 'fast';

    return 'chat';
  }

  /** Refresh the list of available models from Ollama */
  async refreshAvailableModels(): Promise<string[]> {
    try {
      const models = await this.ollamaClient.listModels();
      this.availableModels = models.map((m: any) => m.name || m.model || String(m));
      return this.availableModels;
    } catch {
      return this.availableModels;
    }
  }

  /** Check if a model is available */
  isModelAvailable(model: string): boolean {
    return this.availableModels.includes(model);
  }

  /** Get available models */
  getAvailableModels(): string[] {
    return [...this.availableModels];
  }

  /** Export profiles for serialization */
  exportProfiles(): ModelProfiles {
    return JSON.parse(JSON.stringify(this.profiles));
  }
}
