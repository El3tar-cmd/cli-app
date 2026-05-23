# 🔒 Security (2026 Edition — OWASP 2025 Aligned)

> Skills for building secure, hardened applications following 2026 standards.

## OWASP Top 10 (2025 Update)

| Rank | Risk | Key Defense |
|------|------|-------------|
| **A01** | Broken Access Control (incl. SSRF) | Enforce least privilege, validate server-side, deny by default |
| **A02** | Security Misconfiguration | Harden defaults, disable debug in prod, automate config audits |
| **A03** | Supply Chain Failures (NEW) | SBOM, dependency scanning, code signing, pin versions |
| **A04** | Injection (SQL, XSS, Command) | Parameterized queries, output encoding, CSP headers |
| **A05** | Cryptographic Failures | Use modern algorithms (AES-256-GCM, Argon2), never roll your own crypto |
| **A06** | Vulnerable Components | Automated dependency scanning (Snyk, npm audit), update regularly |
| **A07** | Auth & Session Failures | MFA, secure session management, credential stuffing protection |
| **A08** | Data Integrity Failures | Verify CI/CD pipeline integrity, code signing, artifact verification |
| **A09** | Logging & Monitoring Gaps | Structured security logging, real-time alerting, audit trails |
| **A10** | Exceptional Condition Mishandling (NEW) | Graceful error handling, never expose stack traces, fail securely |

## Zero Trust Architecture (ZTA)

- **"Never Trust, Always Verify"** — every request is authenticated and authorized, regardless of network location.
- **Identity-First Security** — MFA is mandatory, not optional. Use hardware keys (WebAuthn/FIDO2).
- **Micro-segmentation** — isolate workloads to prevent lateral movement after breach.
- **Context-Aware Access** — decisions based on identity + device health + location + behavior.
- **Assume Breach Mindset** — design systems expecting attackers are already inside.

## API Security (2026)

- **BOLA/BFLA Prevention** — enforce authorization at the data/object level, not just function level.
- **Rate Limiting** — per-user, per-endpoint rate limits with token bucket algorithm.
- **API Inventory** — eliminate shadow APIs, maintain complete inventory of all deployed versions.
- **Input Validation** — validate ALL inputs server-side with schema validation (Zod, Joi).
- **AI Agent Safeguards** — strict policy-based access controls for AI agents consuming APIs.

## Supply Chain Security

- **Software Bill of Materials (SBOM)** — maintain living SBOMs enriched with VEX data.
- **Dependency Pinning** — pin exact versions, use lockfiles, verify checksums.
- **CI/CD Pipeline Security** — sign artifacts, implement SAST/DAST in pipeline, single source of truth.
- **Third-Party Audit** — validate open-source libraries at point of entry.

## Secure Coding Practices

- **Input Sanitization** — sanitize ALL user input. Trust nothing from the client.
- **Output Encoding** — context-aware encoding (HTML, URL, JS, CSS).
- **Secrets Management** — never hardcode. Use env vars, vaults (HashiCorp Vault), or cloud secrets managers.
- **Path Traversal Prevention** — resolve and validate all file paths against allowed directories.
- **CORS** — configure strict CORS policies. Never use `*` in production.
- **CSP Headers** — Content Security Policy to prevent XSS.
- **HTTPS Everywhere** — enforce TLS 1.3, HSTS headers, certificate pinning for mobile.

## When to Use

Activate these skills when the user asks to:
- Review code for security vulnerabilities
- Implement authentication, authorization, or access control
- Handle sensitive data, secrets, or credentials
- Fix security issues or respond to vulnerability reports
- Audit dependencies or CI/CD pipelines
- Implement Zero Trust or API security patterns
