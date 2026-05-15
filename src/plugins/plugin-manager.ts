/**
 * 🔌 NOVA Plugin System — Dynamic plugin loading and management
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getNovaSubDir } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';
import type { ToolRegistry, ToolResult } from '../tools/tool-registry.js';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  main: string;
  tools?: PluginToolDef[];
  hooks?: string[];
}

export interface PluginToolDef {
  name: string;
  description: string;
  category: string;
  parameters: Record<string, string>;
}

export interface NovaPlugin {
  manifest: PluginManifest;
  activate?: () => Promise<void>;
  deactivate?: () => Promise<void>;
  tools?: Record<string, (args: Record<string, unknown>) => Promise<ToolResult>>;
  hooks?: Record<string, (...args: any[]) => any>;
}

export class PluginManager {
  private plugins = new Map<string, NovaPlugin>();
  private pluginDir: string;
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry, pluginDir?: string) {
    this.toolRegistry = toolRegistry;
    this.pluginDir = pluginDir || getNovaSubDir('plugins');
  }

  /** Discover and load all plugins */
  async loadAll(): Promise<number> {
    if (!existsSync(this.pluginDir)) return 0;

    const dirs = readdirSync(this.pluginDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    let loaded = 0;
    for (const dir of dirs) {
      try {
        const success = await this.loadPlugin(join(this.pluginDir, dir.name));
        if (success) loaded++;
      } catch (err: any) {
        logger.warn(`Failed to load plugin ${dir.name}: ${err.message}`);
      }
    }
    return loaded;
  }

  /** Load a single plugin from directory */
  async loadPlugin(pluginPath: string): Promise<boolean> {
    const manifestPath = join(pluginPath, 'manifest.json');
    if (!existsSync(manifestPath)) {
      logger.debug(`No manifest.json in ${pluginPath}`);
      return false;
    }

    const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const mainPath = join(pluginPath, manifest.main);

    if (!existsSync(mainPath)) {
      logger.warn(`Plugin main file not found: ${mainPath}`);
      return false;
    }

    // Dynamic import
    const moduleUrl = pathToFileURL(mainPath).href;
    const mod = await import(moduleUrl);
    const plugin: NovaPlugin = {
      manifest,
      ...mod.default || mod,
    };

    // Activate plugin
    if (plugin.activate) {
      await plugin.activate();
    }

    // Register plugin tools
    if (plugin.tools) {
      for (const [name, handler] of Object.entries(plugin.tools)) {
        const toolDef = manifest.tools?.find(t => t.name === name);
        this.toolRegistry.register({
          name: `${manifest.name}.${name}`,
          description: toolDef?.description || `Plugin tool: ${name}`,
          category: (toolDef?.category || 'system') as any,
          parameters: toolDef?.parameters || {},
          requiresConfirmation: true,
          handler,
        });
      }
    }

    this.plugins.set(manifest.name, plugin);
    logger.info(`Loaded plugin: ${manifest.name} v${manifest.version}`);
    return true;
  }

  /** Unload a plugin */
  async unloadPlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    if (plugin.deactivate) {
      await plugin.deactivate();
    }

    this.plugins.delete(name);
    return true;
  }

  /** Get loaded plugins */
  getPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values()).map(p => p.manifest);
  }

  /** Get plugin count */
  getCount(): number {
    return this.plugins.size;
  }

  /** Execute a hook across all plugins */
  async executeHook(hookName: string, ...args: any[]): Promise<void> {
    for (const [, plugin] of this.plugins) {
      if (plugin.hooks?.[hookName]) {
        try {
          await plugin.hooks[hookName](...args);
        } catch (err: any) {
          logger.warn(`Hook ${hookName} failed in ${plugin.manifest.name}: ${err.message}`);
        }
      }
    }
  }
}
