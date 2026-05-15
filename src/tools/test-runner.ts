/**
 * 🧪 NOVA Test Runner — Auto-detect and run tests, iterate until green
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface TestResult {
  passed: boolean;
  output: string;
  summary: string;
  framework: string;
  duration: number;
}

export interface TestFramework {
  name: string;
  command: string;
  detected: boolean;
}

export class TestRunner {
  private cwd: string;
  private framework: TestFramework | null = null;

  constructor(cwd: string) {
    this.cwd = cwd;
    this.framework = this.detectFramework();
  }

  /** Auto-detect test framework */
  private detectFramework(): TestFramework | null {
    const checks: Array<{ name: string; file: string; command: string }> = [
      { name: 'vitest', file: 'vitest.config.ts', command: 'npx vitest run --reporter=verbose' },
      { name: 'vitest', file: 'vitest.config.js', command: 'npx vitest run --reporter=verbose' },
      { name: 'jest', file: 'jest.config.ts', command: 'npx jest --verbose --no-coverage' },
      { name: 'jest', file: 'jest.config.js', command: 'npx jest --verbose --no-coverage' },
      { name: 'mocha', file: '.mocharc.yml', command: 'npx mocha --reporter spec' },
      { name: 'mocha', file: '.mocharc.json', command: 'npx mocha --reporter spec' },
      { name: 'pytest', file: 'pytest.ini', command: 'python -m pytest -v' },
      { name: 'pytest', file: 'pyproject.toml', command: 'python -m pytest -v' },
      { name: 'go', file: 'go.mod', command: 'go test ./... -v' },
      { name: 'cargo', file: 'Cargo.toml', command: 'cargo test -- --nocapture' },
    ];

    for (const check of checks) {
      if (existsSync(join(this.cwd, check.file))) {
        return { name: check.name, command: check.command, detected: true };
      }
    }

    // Check package.json for test script
    const pkgPath = join(this.cwd, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(require('node:fs').readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
          return { name: 'npm', command: 'npm test', detected: true };
        }
        // Check devDependencies
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['vitest']) return { name: 'vitest', command: 'npx vitest run --reporter=verbose', detected: true };
        if (deps['jest']) return { name: 'jest', command: 'npx jest --verbose --no-coverage', detected: true };
        if (deps['mocha']) return { name: 'mocha', command: 'npx mocha --reporter spec', detected: true };
      } catch { /* ignore */ }
    }

    return null;
  }

  /** Get detected framework info */
  getFramework(): TestFramework | null {
    return this.framework;
  }

  /** Run tests */
  run(customCommand?: string): TestResult {
    const command = customCommand || this.framework?.command;
    if (!command) {
      return {
        passed: false,
        output: 'No test framework detected. Create a test config or use /test <command>',
        summary: 'No tests found',
        framework: 'none',
        duration: 0,
      };
    }

    const startTime = Date.now();
    let output = '';
    let passed = false;

    try {
      output = execSync(command, {
        cwd: this.cwd,
        encoding: 'utf-8',
        timeout: 120000, // 2 minute timeout
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      passed = true;
    } catch (err: any) {
      output = (err.stdout || '') + '\n' + (err.stderr || '');
      passed = false;
    }

    const duration = Date.now() - startTime;
    const summary = this.parseSummary(output, passed);

    return {
      passed,
      output: output.slice(-3000), // Last 3KB
      summary,
      framework: this.framework?.name || 'custom',
      duration,
    };
  }

  /** Parse test summary from output */
  private parseSummary(output: string, passed: boolean): string {
    // Try to find common patterns
    const patterns = [
      /Tests:\s*(.+)/i,
      /(\d+)\s*passed/i,
      /(\d+)\s*failed/i,
      /(\d+)\s*tests?\s+completed/i,
      /PASS|FAIL/,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) return match[0];
    }

    return passed ? 'All tests passed' : 'Tests failed';
  }
}
