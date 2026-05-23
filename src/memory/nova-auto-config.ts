/**
 * 🧠 NOVA Auto-Config — Smart NOVA.md Generator
 * Automatically scans project structure and generates/updates NOVA.md
 * Acts as the project's "constitution" for optimal AI assistance
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { logger } from '../utils/logger.js';

export interface ProjectProfile {
  name: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'library' | 'monorepo' | 'unknown';
  framework: string | null;
  language: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | null;
  hasTests: boolean;
  testFramework: string | null;
  hasDocker: boolean;
  hasCI: boolean;
  hasTypeScript: boolean;
  entryPoints: string[];
  srcDir: string | null;
  keyDirs: string[];
  keyFiles: string[];
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  gitIgnored: boolean;
  fileCount: number;
  description: string;
}

export class NovaAutoConfig {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  /** Check if this directory has a real project */
  isProject(): boolean {
    const indicators = [
      'package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml',
      'requirements.txt', 'pom.xml', 'build.gradle', 'composer.json',
      'Gemfile', 'pubspec.yaml', 'CMakeLists.txt', 'Makefile',
      '.git', 'src', 'lib', 'app',
    ];
    return indicators.some(f => existsSync(join(this.cwd, f)));
  }

  /** Scan project and build a profile */
  scanProject(): ProjectProfile {
    const profile: ProjectProfile = {
      name: basename(this.cwd),
      type: 'unknown',
      framework: null,
      language: 'unknown',
      packageManager: null,
      hasTests: false,
      testFramework: null,
      hasDocker: false,
      hasCI: false,
      hasTypeScript: false,
      entryPoints: [],
      srcDir: null,
      keyDirs: [],
      keyFiles: [],
      dependencies: [],
      devDependencies: [],
      scripts: {},
      gitIgnored: existsSync(join(this.cwd, '.gitignore')),
      fileCount: 0,
      description: '',
    };

    // Count files (shallow)
    try {
      const items = readdirSync(this.cwd);
      profile.fileCount = items.length;
    } catch { /* empty dir */ }

    // Check package.json (Node.js/JS ecosystem)
    const pkgPath = join(this.cwd, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        profile.name = pkg.name || profile.name;
        profile.description = pkg.description || '';
        profile.scripts = pkg.scripts || {};
        profile.dependencies = Object.keys(pkg.dependencies || {});
        profile.devDependencies = Object.keys(pkg.devDependencies || {});
        const allDeps = [...profile.dependencies, ...profile.devDependencies];

        // Detect package manager
        if (existsSync(join(this.cwd, 'bun.lockb'))) profile.packageManager = 'bun';
        else if (existsSync(join(this.cwd, 'pnpm-lock.yaml'))) profile.packageManager = 'pnpm';
        else if (existsSync(join(this.cwd, 'yarn.lock'))) profile.packageManager = 'yarn';
        else profile.packageManager = 'npm';

        // Detect language
        profile.hasTypeScript = allDeps.includes('typescript') || existsSync(join(this.cwd, 'tsconfig.json'));
        profile.language = profile.hasTypeScript ? 'TypeScript' : 'JavaScript';

        // Detect framework
        if (allDeps.includes('next')) profile.framework = 'Next.js';
        else if (allDeps.includes('nuxt')) profile.framework = 'Nuxt';
        else if (allDeps.includes('astro')) profile.framework = 'Astro';
        else if (allDeps.includes('@sveltejs/kit')) profile.framework = 'SvelteKit';
        else if (allDeps.includes('react')) profile.framework = 'React';
        else if (allDeps.includes('vue')) profile.framework = 'Vue';
        else if (allDeps.includes('svelte')) profile.framework = 'Svelte';
        else if (allDeps.includes('express')) profile.framework = 'Express';
        else if (allDeps.includes('fastify')) profile.framework = 'Fastify';
        else if (allDeps.includes('hono')) profile.framework = 'Hono';
        else if (allDeps.includes('nest') || allDeps.includes('@nestjs/core')) profile.framework = 'NestJS';

        // Detect project type
        if (allDeps.includes('next') || allDeps.includes('nuxt') || allDeps.includes('@sveltejs/kit')) {
          profile.type = 'fullstack';
        } else if (allDeps.includes('react') || allDeps.includes('vue') || allDeps.includes('svelte')) {
          profile.type = 'frontend';
        } else if (allDeps.includes('express') || allDeps.includes('fastify') || allDeps.includes('@nestjs/core')) {
          profile.type = 'backend';
        } else if (pkg.main || pkg.exports) {
          profile.type = 'library';
        }

        // Detect test framework
        if (allDeps.includes('vitest')) { profile.testFramework = 'Vitest'; profile.hasTests = true; }
        else if (allDeps.includes('jest')) { profile.testFramework = 'Jest'; profile.hasTests = true; }
        else if (allDeps.includes('mocha')) { profile.testFramework = 'Mocha'; profile.hasTests = true; }
        else if (allDeps.includes('playwright')) { profile.testFramework = 'Playwright'; profile.hasTests = true; }

        // Check for test directories
        if (!profile.hasTests) {
          profile.hasTests = ['test', 'tests', '__tests__', 'spec'].some(d => existsSync(join(this.cwd, d)));
        }
      } catch (err: any) {
        logger.warn(`Failed to parse package.json: ${err.message}`);
      }
    }

    // Detect Python
    if (existsSync(join(this.cwd, 'pyproject.toml')) || existsSync(join(this.cwd, 'requirements.txt'))) {
      profile.language = 'Python';
      if (existsSync(join(this.cwd, 'manage.py'))) profile.framework = 'Django';
      else if (profile.dependencies.some(d => d.includes('flask'))) profile.framework = 'Flask';
      else if (profile.dependencies.some(d => d.includes('fastapi'))) profile.framework = 'FastAPI';
    }

    // Detect Go
    if (existsSync(join(this.cwd, 'go.mod'))) { profile.language = 'Go'; }

    // Detect Rust
    if (existsSync(join(this.cwd, 'Cargo.toml'))) { profile.language = 'Rust'; }

    // Docker
    profile.hasDocker = existsSync(join(this.cwd, 'Dockerfile')) || existsSync(join(this.cwd, 'docker-compose.yml')) || existsSync(join(this.cwd, 'docker-compose.yaml'));

    // CI/CD
    profile.hasCI = existsSync(join(this.cwd, '.github')) || existsSync(join(this.cwd, '.gitlab-ci.yml')) || existsSync(join(this.cwd, 'Jenkinsfile'));

    // Monorepo detection
    if (existsSync(join(this.cwd, 'packages')) || existsSync(join(this.cwd, 'apps'))) {
      profile.type = 'monorepo';
    }

    // Source directory
    const srcCandidates = ['src', 'app', 'lib', 'source', 'packages'];
    for (const d of srcCandidates) {
      if (existsSync(join(this.cwd, d))) {
        profile.srcDir = d;
        break;
      }
    }

    // Key directories
    const dirCandidates = ['src', 'app', 'lib', 'public', 'assets', 'components', 'pages', 'api', 'utils', 'hooks', 'styles', 'config', 'test', 'tests', 'scripts'];
    profile.keyDirs = dirCandidates.filter(d => existsSync(join(this.cwd, d)));

    // Key files
    const fileCandidates = ['README.md', 'package.json', 'tsconfig.json', '.env.example', 'Dockerfile', 'docker-compose.yml', '.eslintrc.js', '.prettierrc', 'vite.config.ts', 'next.config.js', 'tailwind.config.js'];
    profile.keyFiles = fileCandidates.filter(f => existsSync(join(this.cwd, f)));

    // Entry points
    const entryCandidates = ['src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js', 'src/app.ts', 'src/app.js', 'index.ts', 'index.js', 'app.ts', 'app.js', 'src/server.ts', 'pages/index.tsx', 'app/page.tsx', 'app/layout.tsx'];
    profile.entryPoints = entryCandidates.filter(f => existsSync(join(this.cwd, f)));

    return profile;
  }

  /** Generate NOVA.md content from project profile */
  generateNovaMd(profile: ProjectProfile): string {
    const lines: string[] = [];

    // Header
    lines.push(`# NOVA.md — ${profile.name}`);
    lines.push('');
    lines.push(`> Auto-generated project constitution. Last updated: ${new Date().toISOString().split('T')[0]}`);
    lines.push('> Edit this file to customize NOVA\'s behavior for this project.');
    lines.push('');

    // Project Overview
    lines.push('## Project Overview');
    lines.push('');
    lines.push(`- **Name**: ${profile.name}`);
    if (profile.description) lines.push(`- **Description**: ${profile.description}`);
    lines.push(`- **Type**: ${profile.type}`);
    lines.push(`- **Language**: ${profile.language}`);
    if (profile.framework) lines.push(`- **Framework**: ${profile.framework}`);
    if (profile.packageManager) lines.push(`- **Package Manager**: ${profile.packageManager}`);
    if (profile.srcDir) lines.push(`- **Source Directory**: ${profile.srcDir}/`);
    lines.push('');

    // Structure
    lines.push('## Project Structure');
    lines.push('');
    lines.push('```');
    lines.push(`${profile.name}/`);
    for (const dir of profile.keyDirs) {
      lines.push(`├── ${dir}/`);
    }
    for (const file of profile.keyFiles) {
      lines.push(`├── ${file}`);
    }
    lines.push('```');
    lines.push('');

    // Rules based on project type
    lines.push('## Rules');
    lines.push('');

    // Language rules
    if (profile.hasTypeScript) {
      lines.push('- Always use TypeScript with strict mode enabled');
      lines.push('- Use proper types — avoid `any`. Use `unknown` with type guards');
      lines.push('- Use Zod for runtime validation at boundaries');
    }

    // Framework rules
    if (profile.framework === 'Next.js') {
      lines.push('- Use App Router (`app/` directory) patterns');
      lines.push('- Default to Server Components. Use "use client" only when needed');
      lines.push('- Use Server Actions for mutations');
    } else if (profile.framework === 'React') {
      lines.push('- Use functional components with hooks');
      lines.push('- Follow component composition patterns');
    } else if (profile.framework === 'Express' || profile.framework === 'Fastify') {
      lines.push('- Use controller → service → repository layered architecture');
      lines.push('- Validate all inputs at the controller level');
    }

    // Package manager
    if (profile.packageManager) {
      lines.push(`- Use \`${profile.packageManager}\` for package management — do not use other package managers`);
    }

    // Testing
    if (profile.testFramework) {
      lines.push(`- Run tests with \`${profile.testFramework}\` after changes`);
      lines.push('- Maintain test coverage for critical paths');
    }

    // General
    lines.push('- Use relative imports within the project');
    lines.push('- Follow existing code style and conventions');
    lines.push('- Handle errors gracefully — never swallow exceptions silently');
    lines.push('');

    // Available Scripts
    if (Object.keys(profile.scripts).length > 0) {
      lines.push('## Available Scripts');
      lines.push('');
      const importantScripts = ['dev', 'build', 'start', 'test', 'lint', 'format', 'preview', 'deploy'];
      for (const [name, cmd] of Object.entries(profile.scripts)) {
        if (importantScripts.includes(name)) {
          lines.push(`- \`${profile.packageManager || 'npm'} run ${name}\` — \`${cmd}\``);
        }
      }
      lines.push('');
    }

    // Dependencies summary
    if (profile.dependencies.length > 0) {
      lines.push('## Key Dependencies');
      lines.push('');
      const topDeps = profile.dependencies.slice(0, 15);
      lines.push(topDeps.map(d => `\`${d}\``).join(', '));
      lines.push('');
    }

    // Notes
    lines.push('## Notes');
    lines.push('');
    lines.push('- This file is auto-maintained by NOVA. Manual edits are preserved.');
    lines.push('- NOVA reads this file on startup and on every change (hot-reload).');
    lines.push('- Add project-specific instructions below this line.');
    lines.push('');

    return lines.join('\n');
  }

  /** Auto-generate NOVA.md if project exists but no NOVA.md */
  autoGenerate(): { generated: boolean; path: string; profile: ProjectProfile | null } {
    const novaMdPath = join(this.cwd, 'NOVA.md');

    // Already exists — don't overwrite
    if (existsSync(novaMdPath) || existsSync(join(this.cwd, 'nova.md')) || existsSync(join(this.cwd, '.nova.md'))) {
      return { generated: false, path: novaMdPath, profile: null };
    }

    // Not a project — skip
    if (!this.isProject()) {
      return { generated: false, path: novaMdPath, profile: null };
    }

    // Scan and generate
    const profile = this.scanProject();
    const content = this.generateNovaMd(profile);

    try {
      writeFileSync(novaMdPath, content, 'utf-8');
      logger.info(`Auto-generated NOVA.md for ${profile.name} (${profile.type}/${profile.language})`);
      return { generated: true, path: novaMdPath, profile };
    } catch (err: any) {
      logger.warn(`Failed to generate NOVA.md: ${err.message}`);
      return { generated: false, path: novaMdPath, profile };
    }
  }

  /** Update NOVA.md with latest project info (preserves manual edits below marker) */
  autoUpdate(): boolean {
    const novaMdPath = join(this.cwd, 'NOVA.md');
    if (!existsSync(novaMdPath)) return false;

    try {
      const existing = readFileSync(novaMdPath, 'utf-8');

      // Find the user's custom section (after "Add project-specific instructions below this line")
      const marker = '- Add project-specific instructions below this line.';
      const markerIdx = existing.indexOf(marker);
      const userSection = markerIdx !== -1 ? existing.slice(markerIdx + marker.length) : '';

      // Regenerate the auto-generated part
      const profile = this.scanProject();
      const generated = this.generateNovaMd(profile);

      // Merge: new auto-generated + preserved user section
      const newMarkerIdx = generated.indexOf(marker);
      if (newMarkerIdx !== -1 && userSection.trim()) {
        const newContent = generated.slice(0, newMarkerIdx + marker.length) + userSection;
        writeFileSync(novaMdPath, newContent, 'utf-8');
        logger.info('Updated NOVA.md (preserved user sections)');
        return true;
      }

      return false;
    } catch (err: any) {
      logger.warn(`Failed to update NOVA.md: ${err.message}`);
      return false;
    }
  }
}
