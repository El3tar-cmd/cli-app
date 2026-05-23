/**
 * 🔒 NOVA Secrets Scanner — Prevent accidental secret exposure
 * Scans content for API keys, passwords, tokens, and other secrets
 * before writing to files
 */

export interface ScanResult {
  clean: boolean;
  findings: SecretFinding[];
}

export interface SecretFinding {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  match: string;       // Redacted version
  description: string;
}

// Patterns that indicate secrets — ordered by severity
const SECRET_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}> = [
  // ── Critical: Actual API keys & tokens ──
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical',
    description: 'AWS Access Key ID detected',
  },
  {
    name: 'AWS Secret Key',
    pattern: /(?:aws_secret_access_key|aws_secret)\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/gi,
    severity: 'critical',
    description: 'AWS Secret Access Key detected',
  },
  {
    name: 'GitHub Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,255}/g,
    severity: 'critical',
    description: 'GitHub personal/OAuth/user token detected',
  },
  {
    name: 'GitLab Token',
    pattern: /glpat-[A-Za-z0-9\-_]{20,}/g,
    severity: 'critical',
    description: 'GitLab personal access token detected',
  },
  {
    name: 'Stripe Key',
    pattern: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}/g,
    severity: 'critical',
    description: 'Stripe API key detected',
  },
  {
    name: 'OpenAI Key',
    pattern: /sk-[A-Za-z0-9]{20,}/g,
    severity: 'critical',
    description: 'OpenAI/Anthropic API key detected',
  },
  {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    severity: 'critical',
    description: 'Google API key detected',
  },
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9A-Za-z\-]{10,}/g,
    severity: 'critical',
    description: 'Slack token detected',
  },
  {
    name: 'JWT Token',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    severity: 'high',
    description: 'JWT token detected',
  },

  // ── High: Connection strings & passwords ──
  {
    name: 'Database URL',
    pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s"'`]+:[^\s"'`]+@[^\s"'`]+/gi,
    severity: 'high',
    description: 'Database connection string with credentials detected',
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'Private key detected',
  },
  {
    name: 'Password Assignment',
    pattern: /(?:password|passwd|pwd|secret)\s*[=:]\s*["'][^"']{8,}["']/gi,
    severity: 'high',
    description: 'Hardcoded password/secret detected',
  },

  // ── Medium: Potentially sensitive ──
  {
    name: 'Bearer Token',
    pattern: /(?:bearer|authorization)\s*[=:]\s*["'][^\s"']{20,}["']/gi,
    severity: 'medium',
    description: 'Authorization token detected',
  },
  {
    name: 'Generic API Key',
    pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*["'][A-Za-z0-9\-_]{16,}["']/gi,
    severity: 'medium',
    description: 'Generic API key detected',
  },
  {
    name: 'Hex Secret',
    pattern: /(?:secret|token|key)\s*[=:]\s*["'][0-9a-f]{32,}["']/gi,
    severity: 'medium',
    description: 'Hex-encoded secret detected',
  },
];

// File extensions that should be scanned
const SCANNABLE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt',
  '.env', '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg',
  '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
  '.xml', '.html', '.htm', '.php',
  '.tf', '.hcl',           // Terraform
  '.dockerfile', '',       // Dockerfile (no ext)
];

// File names that always need scanning
const SENSITIVE_FILENAMES = [
  '.env', '.env.local', '.env.production', '.env.staging',
  'docker-compose.yml', 'docker-compose.yaml',
  'secrets.json', 'credentials.json',
  '.npmrc', '.pypirc',
];

export class SecretsScanner {
  private enabled: boolean = true;

  /** Enable or disable the scanner */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Scan content for secrets */
  scan(content: string, filename?: string): ScanResult {
    if (!this.enabled) return { clean: true, findings: [] };

    // Skip binary or very short content
    if (content.length < 10) return { clean: true, findings: [] };

    // Check if file should be scanned
    if (filename && !this.shouldScan(filename)) {
      return { clean: true, findings: [] };
    }

    const findings: SecretFinding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('#') || line.trimStart().startsWith('*')) {
        // But still scan env files and config files
        if (!filename || !SENSITIVE_FILENAMES.some(f => filename.endsWith(f))) {
          continue;
        }
      }

      for (const pattern of SECRET_PATTERNS) {
        // Reset regex state
        pattern.pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.pattern.exec(line)) !== null) {
          const raw = match[0];
          // Redact the match for display
          const redacted = raw.length > 12
            ? raw.slice(0, 4) + '•'.repeat(raw.length - 8) + raw.slice(-4)
            : '•'.repeat(raw.length);

          findings.push({
            type: pattern.name,
            severity: pattern.severity,
            line: i + 1,
            match: redacted,
            description: pattern.description,
          });
        }
      }
    }

    // Deduplicate by type + line
    const unique = findings.filter((f, i, arr) =>
      arr.findIndex(x => x.type === f.type && x.line === f.line) === i
    );

    return {
      clean: unique.length === 0,
      findings: unique,
    };
  }

  /** Check if a file should be scanned based on extension/name */
  private shouldScan(filename: string): boolean {
    const lower = filename.toLowerCase();
    if (SENSITIVE_FILENAMES.some(f => lower.endsWith(f))) return true;
    const ext = lower.includes('.') ? '.' + lower.split('.').pop() : '';
    return SCANNABLE_EXTENSIONS.includes(ext);
  }

  /** Format findings for display */
  static formatFindings(findings: SecretFinding[]): string {
    if (findings.length === 0) return '✔ No secrets detected';

    const severityIcons: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };

    const lines = findings.map(f =>
      `  ${severityIcons[f.severity]} [${f.severity.toUpperCase()}] Line ${f.line}: ${f.description}\n    → ${f.match}`
    );

    return `⚠ Found ${findings.length} potential secret(s):\n${lines.join('\n')}`;
  }
}
