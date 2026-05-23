/**
 * ⚙ NOVA Config Manager — Persistent configuration with defaults
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getNovaDir } from '../utils/helpers.js';
import { OLLAMA_DEFAULT_URL, OLLAMA_DEFAULT_MODEL, DEFAULT_TOKEN_BUDGET } from '../utils/constants.js';

export interface NovaConfig {
  ollama: {
    url: string;
    model: string;
    temperature: number;
    topP: number;
    contextLength: number;
    keepAliveSeconds?: number; // keep‑alive for Ollama cloud connections
    autoUpdateModels?: boolean; // disable automatic pull of new model versions
    compressionAlgorithm?: string;
    security?: {
      policyFile: string;
    };
  };
  memory: {
    tokenBudget: number;
    compressionEnabled: boolean;
    compressionThreshold: number;
    compressionAlgorithm?: string;
    flushImmediately?: boolean;
    maxConversations: number;
  };
  ui: {
    theme: string;
    showStatusBar: boolean;
    showTokenCount: boolean;
    streamingSpeed: 'instant' | 'fast' | 'normal';
    showToolConfirmation: boolean;
  };
  tools: {
    autoApprove: string[];
    notifyApprove?: string[];
    confirmTimeout?: number;
    commandTimeout: number;
    maxFileSize: number;
    maxConcurrentAgents?: number;
    maxRetries?: number;
    requestTimeoutMs?: number;
  };
  plugins: {
    enabled: boolean;
    directory: string;
    autoLoad: boolean;
  };
  modes: {
    default: string;
  };
}

  const DEFAULT_CONFIG: NovaConfig = {
    ollama: {
      url: OLLAMA_DEFAULT_URL,
      model: OLLAMA_DEFAULT_MODEL,
      temperature: 0.1,
      topP: 0.9,
      contextLength: 524288, // 512k tokens for enterprise-level context
      keepAliveSeconds: 86400, // 24 hours default for enterprise projects
      autoUpdateModels: false,
      compressionAlgorithm: 'gzip', // enable gzip compression by default
      security: {
        policyFile: 'policies/policy.rego',
      },
    },
    memory: {
      tokenBudget: DEFAULT_TOKEN_BUDGET,
      compressionEnabled: true, // enabled for enterprise context compression
      compressionThreshold: 0.75,
      compressionAlgorithm: 'gzip', // gzip compression algorithm
      flushImmediately: true,
      maxConversations: 100,
    },
    ui: {
      theme: 'cyberpunk',
      showStatusBar: true,
      showTokenCount: true,
      streamingSpeed: 'instant',
      showToolConfirmation: true,
    },
    tools: {
      autoApprove: [
        'file_read', 'list_directory', 'code_search', 'git_status', 
        'project_analyze', 'web_fetch', 'sequential_thinking', 
        'update_state', 'recall_memory', 'browser_content', 
        'browser_console', 'browser_screenshot', 'ollama_health', 'model_pull'
      ],
      notifyApprove: [
        'file_write', 'file_edit', 'file_patch', 'file_multi_edit', 
        'browser_navigate', 'browser_click', 'browser_type', 
        'browser_eval', 'git_commit'
      ],
      confirmTimeout: 15000,
      commandTimeout: 30000,
      maxFileSize: 1024 * 1024, // 1MB
      maxConcurrentAgents: 5,
      maxRetries: 5,
      requestTimeoutMs: 15000,
    },
    plugins: {
      enabled: true,
      directory: join(getNovaDir(), 'plugins'),
      autoLoad: true,
    },
    modes: {
      default: 'chat',
    },
  };


export class ConfigManager {
  private config: NovaConfig;
  private configPath: string;

  constructor() {
    this.configPath = join(getNovaDir(), 'config.json');
    this.config = this.load();
  }

  private load(): NovaConfig {
    try {
      if (existsSync(this.configPath)) {
        const raw = readFileSync(this.configPath, 'utf-8');
        const saved = JSON.parse(raw);
        return this.merge(DEFAULT_CONFIG, saved);
      }
    } catch {}
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  private merge(defaults: any, overrides: any): any {
    const result = { ...defaults };
    for (const key of Object.keys(overrides)) {
      if (typeof overrides[key] === 'object' && !Array.isArray(overrides[key]) && defaults[key]) {
        result[key] = this.merge(defaults[key], overrides[key]);
      } else {
        result[key] = overrides[key];
      }
    }
    return result;
  }

  save(): void {
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  get<K extends keyof NovaConfig>(section: K): NovaConfig[K] {
    return this.config[section];
  }

  getAll(): NovaConfig {
    return this.config;
  }

  set<K extends keyof NovaConfig>(section: K, value: Partial<NovaConfig[K]>): void {
    this.config[section] = { ...this.config[section], ...value };
    this.save();
  }

  setField(path: string, value: unknown): void {
    const parts = path.split('.');
    let obj: any = this.config;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    this.save();
  }

  getField(path: string): unknown {
    const parts = path.split('.');
    let obj: any = this.config;
    for (const part of parts) {
      if (obj === undefined) return undefined;
      obj = obj[part];
    }
    return obj;
  }

  reset(): void {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    this.save();
  }
}
