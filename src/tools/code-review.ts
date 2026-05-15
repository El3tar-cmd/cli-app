/**
 * 🔍 NOVA Code Review — AI-powered code analysis
 */

import { readFileSync, existsSync } from 'node:fs';
import { extname } from 'node:path';

export interface ReviewRequest {
  filePath?: string;
  content?: string;
  diffMode?: boolean;
  diffContent?: string;
}

export class CodeReview {
  /** Build review prompt for a file */
  static buildPrompt(request: ReviewRequest): string {
    if (request.diffMode && request.diffContent) {
      return `## Code Review Request (Diff Mode)

Review the following git diff for:
- 🐛 Bugs and logic errors
- 🔒 Security vulnerabilities
- ⚡ Performance issues
- 📖 Readability and maintainability
- 🏗️ Architecture concerns
- ✅ Best practices violations

\`\`\`diff
${request.diffContent}
\`\`\`

Provide a structured review with severity levels:
- 🔴 CRITICAL — Must fix before merge
- 🟡 WARNING — Should fix
- 🟢 SUGGESTION — Nice to have
- 💡 NOTE — Informational

End with an overall score (A+ to F) and a one-line summary.`;
    }

    const content = request.content ||
      (request.filePath && existsSync(request.filePath)
        ? readFileSync(request.filePath, 'utf-8')
        : null);

    if (!content) {
      return 'Error: No file content provided for review.';
    }

    const ext = request.filePath ? extname(request.filePath) : '';

    return `## Code Review Request

Review the following ${ext} file for:
- 🐛 Bugs and logic errors
- 🔒 Security vulnerabilities (hardcoded secrets, injection, XSS)
- ⚡ Performance issues (N+1 queries, memory leaks, unnecessary allocations)
- 📖 Readability (naming, comments, structure)
- 🏗️ Architecture (SOLID, DRY, separation of concerns)
- ✅ Best practices for ${ext} files in 2026

\`\`\`${ext.slice(1) || 'text'}
${content.slice(0, 8000)}
\`\`\`

Provide a structured review with severity levels:
- 🔴 CRITICAL — Must fix
- 🟡 WARNING — Should fix
- 🟢 SUGGESTION — Nice to have
- 💡 NOTE — Informational

End with an overall score (A+ to F) and a one-line summary.`;
  }

  /** Build security scan prompt */
  static buildSecurityPrompt(content: string, filePath: string): string {
    return `## Security Scan

Analyze the following code for security vulnerabilities:

**File:** ${filePath}

\`\`\`
${content.slice(0, 8000)}
\`\`\`

Check for:
1. 🔑 Hardcoded secrets (API keys, passwords, tokens, connection strings)
2. 💉 Injection vulnerabilities (SQL, command, path traversal, XSS)
3. 🔓 Authentication/authorization issues
4. 📦 Insecure dependencies
5. 🌐 CORS/CSRF issues
6. 📁 File system security (path traversal, symlink attacks)
7. 🔐 Cryptography issues (weak algorithms, insecure random)

For each finding:
- Severity: 🔴 CRITICAL | 🟡 HIGH | 🟠 MEDIUM | 🟢 LOW
- Line numbers if possible
- Recommended fix

End with a security score (A+ to F).`;
  }
}
