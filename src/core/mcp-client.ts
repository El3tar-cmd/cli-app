/**
 * 🔌 NOVA Model Context Protocol (MCP) Client v1
 * Enables stdio JSON-RPC 2.0 connections to external MCP servers
 * and dynamic registration of third-party tools.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../utils/logger.js';
import type { ToolRegistry, ToolResult } from '../tools/tool-registry.js';

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpServersFile {
  mcpServers?: Record<string, McpServerConfig>;
}

export class McpClient {
  private servers = new Map<string, { process: ChildProcess; idCounter: number; pendingRequests: Map<number, { resolve: (res: any) => void; reject: (err: Error) => void }> }>();
  private registry: ToolRegistry;
  private cwd: string;

  constructor(registry: ToolRegistry, cwd: string) {
    this.registry = registry;
    this.cwd = cwd;
  }

  /** Initialize and connect to all configured MCP servers */
  async init(): Promise<void> {
    const configPath = join(this.cwd, 'mcp-servers.json');
    if (!existsSync(configPath)) {
      logger.info('💡 No mcp-servers.json found. Skipping MCP initialization.');
      return;
    }

    try {
      const content = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content) as McpServersFile;

      if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
        logger.info('💡 mcp-servers.json is empty or contains no servers.');
        return;
      }

      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        await this.connectServer(name, serverConfig);
      }
    } catch (err: any) {
      logger.error(`Failed to initialize MCP: ${err.message}`);
    }
  }

  /** Connect to a single stdio MCP server */
  private async connectServer(name: string, config: McpServerConfig): Promise<void> {
    logger.info(`🔌 Connecting to MCP Server: "${name}" via "${config.command} ${config.args?.join(' ') || ''}"`);

    const child = spawn(config.command, config.args || [], {
      cwd: this.cwd,
      env: { ...process.env, ...config.env },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const serverState = {
      process: child,
      idCounter: 0,
      pendingRequests: new Map<number, { resolve: (res: any) => void; reject: (err: Error) => void }>(),
    };

    this.servers.set(name, serverState);

    let buffer = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const response = JSON.parse(trimmed);
          if (response && typeof response.id === 'number') {
            const pending = serverState.pendingRequests.get(response.id);
            if (pending) {
              serverState.pendingRequests.delete(response.id);
              if (response.error) {
                pending.reject(new Error(response.error.message || 'JSON-RPC error'));
              } else {
                pending.resolve(response.result);
              }
            }
          }
        } catch {
          logger.debug(`[MCP Server ${name}] raw output: ${trimmed}`);
        }
      }
    });

      child.stderr?.on('data', (chunk: Buffer) => {
        logger.debug(`[MCP Server ${name} stderr] ${chunk.toString().trim()}`);
      });

      child.on('close', (code) => {
        logger.warn(`🔌 MCP Server "${name}" closed with exit code ${code}`);
        for (const [id, pending] of serverState.pendingRequests) {
          pending.reject(new Error(`MCP Server process closed with code ${code}`));
        }
        serverState.pendingRequests.clear();
        this.servers.delete(name);
      });

      // ─── JSON-RPC Protocol Handlers ────────────────────────────────────
      const sendRequest = (method: string, params?: any, timeout: number = 30000): Promise<any> => {
        return new Promise((resolve, reject) => {
          const id = ++serverState.idCounter;
          const timer = setTimeout(() => {
            serverState.pendingRequests.delete(id);
            reject(new Error(`MCP request '${method}' timed out after ${timeout}ms`));
          }, timeout);
          serverState.pendingRequests.set(id, {
            resolve: (val: any) => {
              clearTimeout(timer);
              resolve(val);
            },
            reject: (err: any) => {
              clearTimeout(timer);
              reject(err);
            }
          });
          const request = { jsonrpc: '2.0', id, method, params };
          child.stdin?.write(JSON.stringify(request) + '\n');
        });
      };

      try {
        // Step 1: Initialize handshake
        const initResult = await sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'nova-agent', version: '2.0.0' },
        });

        logger.info(`🔌 Handshake with "${name}" complete. Protocol Version: ${initResult.protocolVersion}`);

        // Step 2: List dynamic tools
        const toolsResult = await sendRequest('tools/list');
        const tools = (toolsResult.tools || []) as Array<{ name: string; description: string; inputSchema?: any }>;

        logger.info(`🔌 MCP Server "${name}" exposed ${tools.length} dynamic tools.`);

        for (const t of tools) {
          // Re-map parameter schema to simple key-value for our tool-registry
          const paramsMap: Record<string, any> = {};
          if (t.inputSchema && t.inputSchema.properties) {
            for (const [pName, pProps] of Object.entries<any>(t.inputSchema.properties)) {
              paramsMap[pName] = `${pProps.type}${t.inputSchema.required?.includes(pName) ? '' : '?'}`;
            }
          }

          const dynamicToolName = `mcp_${name}_${t.name}`;
          this.registry.register({
            name: dynamicToolName,
            description: `[MCP Tool] ${t.description || 'No description provided.'}`,
            category: 'system',
            requiresConfirmation: true, // Safeguard external tools by default
            parameters: paramsMap,
            handler: async (args): Promise<ToolResult> => {
              try {
                const callResult = await sendRequest('tools/call', {
                  name: t.name,
                  arguments: args,
                });
                
                let output = '';
                if (callResult.content) {
                  output = callResult.content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
                } else {
                  output = JSON.stringify(callResult);
                }

                return {
                  success: !callResult.isError,
                  output,
                };
              } catch (err: any) {
                return {
                  success: false,
                  output: '',
                  error: `MCP Execution failed: ${err.message}`,
                };
              }
            },
          });
          logger.debug(`🔌 Registered MCP dynamic tool: "${dynamicToolName}"`);
        }
      } catch (err: any) {
        logger.error(`Handshake with MCP server "${name}" failed: ${err.message}`);
        child.kill();
        this.servers.delete(name);
      }
  }

  /** Shutdown all active connections */
  cleanup(): void {
    for (const [name, server] of this.servers) {
      logger.info(`🔌 Stopping MCP Server: "${name}"`);
      server.process.kill('SIGTERM');
      this.servers.delete(name);
    }
  }
}
