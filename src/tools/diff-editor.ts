/**
 * 📝 NOVA Diff Editor — Apply unified diffs to files
 * Professional patch-based file editing with preview and validation
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, isAbsolute, relative } from 'node:path';
import { mkdirSync } from 'node:fs';
import * as Diff from 'diff';

export interface PatchResult {
  success: boolean;
  applied: boolean;
  preview: string;
  hunksApplied: number;
  hunksFailed: number;
  error?: string;
}

export interface MultiEdit {
  path: string;
  edits: Array<{
    search: string;
    replace: string;
  }>;
}

export class DiffEditor {
  /** Apply a unified diff patch to a file */
  static applyPatch(filePath: string, patch: string): PatchResult {
    try {
      if (!existsSync(filePath)) {
        return { success: false, applied: false, preview: '', hunksApplied: 0, hunksFailed: 0, error: `File not found: ${filePath}` };
      }

      const original = readFileSync(filePath, 'utf-8');
      const result = Diff.applyPatch(original, patch);

      if (result === false) {
        return {
          success: false,
          applied: false,
          preview: '',
          hunksApplied: 0,
          hunksFailed: 1,
          error: 'Patch could not be applied — context lines may not match the file',
        };
      }

      writeFileSync(filePath, result);

      // Count hunks
      const hunkCount = (patch.match(/^@@/gm) || []).length;

      return {
        success: true,
        applied: true,
        preview: DiffEditor.createDiff(original, result, filePath),
        hunksApplied: hunkCount,
        hunksFailed: 0,
      };
    } catch (err: any) {
      return { success: false, applied: false, preview: '', hunksApplied: 0, hunksFailed: 0, error: err.message };
    }
  }

  /** Create a unified diff between two strings */
  static createDiff(original: string, modified: string, filename: string = 'file'): string {
    return Diff.createPatch(filename, original, modified, 'original', 'modified');
  }

  /** Apply multiple search/replace edits to a file atomically */
  static multiEdit(filePath: string, edits: Array<{ search: string; replace: string }>): PatchResult {
    try {
      if (!existsSync(filePath)) {
        return { success: false, applied: false, preview: '', hunksApplied: 0, hunksFailed: 0, error: `File not found: ${filePath}` };
      }

      const original = readFileSync(filePath, 'utf-8');
      let content = original;
      let applied = 0;
      let failed = 0;

      for (const edit of edits) {
        if (content.includes(edit.search)) {
          content = content.replaceAll(edit.search, edit.replace);
          applied++;
        } else {
          failed++;
        }
      }

      if (applied === 0) {
        return {
          success: false,
          applied: false,
          preview: '',
          hunksApplied: 0,
          hunksFailed: failed,
          error: 'No search patterns matched the file content',
        };
      }

      writeFileSync(filePath, content);

      return {
        success: true,
        applied: true,
        preview: DiffEditor.createDiff(original, content, filePath),
        hunksApplied: applied,
        hunksFailed: failed,
      };
    } catch (err: any) {
      return { success: false, applied: false, preview: '', hunksApplied: 0, hunksFailed: 0, error: err.message };
    }
  }

  /** Apply edits to multiple files atomically (all succeed or all roll back) */
  static multiFileEdit(cwd: string, edits: MultiEdit[]): { success: boolean; results: Record<string, PatchResult> } {
    const backups = new Map<string, string>();
    const results: Record<string, PatchResult> = {};

    // Create backups first
    for (const edit of edits) {
      const fullPath = join(cwd, edit.path);
      if (existsSync(fullPath)) {
        backups.set(fullPath, readFileSync(fullPath, 'utf-8'));
      }
    }

    // Apply all edits
    let allSuccess = true;
    for (const edit of edits) {
      const fullPath = join(cwd, edit.path);
      const result = DiffEditor.multiEdit(fullPath, edit.edits);
      results[edit.path] = result;
      if (!result.success) allSuccess = false;
    }

    // If any failed, roll back everything
    if (!allSuccess) {
      for (const [path, content] of backups) {
        writeFileSync(path, content);
      }
    }

    return { success: allSuccess, results };
  }

  /** Generate a preview diff without applying changes */
  static preview(filePath: string, search: string, replace: string): string {
    if (!existsSync(filePath)) return 'File not found';
    const original = readFileSync(filePath, 'utf-8');
    const modified = original.replaceAll(search, replace);
    if (original === modified) return 'No changes — search text not found';
    return DiffEditor.createDiff(original, modified, filePath);
  }

  /** Create a new file with content, creating parent directories */
  static createFile(filePath: string, content: string): PatchResult {
    try {
      const dir = dirname(filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(filePath, content);
      const lines = content.split('\n').length;
      return {
        success: true,
        applied: true,
        preview: `Created ${filePath} (${lines} lines)`,
        hunksApplied: 1,
        hunksFailed: 0,
      };
    } catch (err: any) {
      return { success: false, applied: false, preview: '', hunksApplied: 0, hunksFailed: 0, error: err.message };
    }
  }

  /** Generate a dry-run preview diff for a file modification tool call */
  static generatePreview(toolName: string, args: any, cwd: string): { success: boolean; diff?: string; error?: string } {
    try {
      const rawPath = args.path as string;
      if (!rawPath) return { success: false, error: 'Path argument is missing' };
      
      const filePath = isAbsolute(rawPath) ? rawPath : join(cwd, rawPath);
      
      if (toolName === 'file_write') {
        const content = args.content as string || '';
        const exists = existsSync(filePath);
        const original = exists ? readFileSync(filePath, 'utf-8') : '';
        const diff = DiffEditor.createDiff(original, content, relative(cwd, filePath));
        return { success: true, diff };
      }
      
      if (toolName === 'file_edit') {
        if (!existsSync(filePath)) return { success: false, error: `File not found: ${filePath}` };
        const original = readFileSync(filePath, 'utf-8');
        const search = args.search as string;
        const replace = args.replace as string || '';
        if (!original.includes(search)) return { success: false, error: 'Search text not found in file' };
        const modified = original.replaceAll(search, replace);
        const diff = DiffEditor.createDiff(original, modified, relative(cwd, filePath));
        return { success: true, diff };
      }
      
      if (toolName === 'file_patch') {
        if (!existsSync(filePath)) return { success: false, error: `File not found: ${filePath}` };
        const original = readFileSync(filePath, 'utf-8');
        const patch = args.patch as string || '';
        const result = Diff.applyPatch(original, patch);
        if (result === false) return { success: false, error: 'Patch context lines do not match' };
        const diff = DiffEditor.createDiff(original, result, relative(cwd, filePath));
        return { success: true, diff };
      }
      
      if (toolName === 'file_multi_edit') {
        if (!existsSync(filePath)) return { success: false, error: `File not found: ${filePath}` };
        const original = readFileSync(filePath, 'utf-8');
        let edits: Array<{ search: string; replace: string }>;
        try {
          edits = JSON.parse(args.edits as string);
        } catch {
          return { success: false, error: 'edits must be a JSON array of {search, replace} objects' };
        }
        let content = original;
        let applied = 0;
        for (const edit of edits) {
          if (content.includes(edit.search)) {
            content = content.replaceAll(edit.search, edit.replace);
            applied++;
          }
        }
        if (applied === 0) return { success: false, error: 'No search patterns matched the file content' };
        const diff = DiffEditor.createDiff(original, content, relative(cwd, filePath));
        return { success: true, diff };
      }
      
      return { success: false, error: `Unsupported preview tool: ${toolName}` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
