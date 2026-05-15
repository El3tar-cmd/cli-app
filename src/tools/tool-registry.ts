/**
 * 🔧 NOVA Tool Registry — Tool registration and discovery
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
  requiresConfirmation?: boolean;
  category: 'file' | 'command' | 'search' | 'git' | 'web' | 'system';
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getByCategory(category: string): ToolDefinition[] {
    return this.getAll().filter((t) => t.category === category);
  }

  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, output: '', error: `Unknown tool: ${name}` };
    }
    try {
      return await tool.handler(args);
    } catch (err: any) {
      return { success: false, output: '', error: err.message || String(err) };
    }
  }
}
