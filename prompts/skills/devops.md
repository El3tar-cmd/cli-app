# 🚀 DevOps, CI/CD, Platform Engineering & AI-Native Ops (2026 Edition)

> Skills for automated, observable, AI-augmented deployment pipelines and infrastructure.

## CI/CD Pipelines (2026)

### Pipeline as Enforceable Contracts
- **Security gates**: SAST, DAST, dependency scanning, and license checks are non-negotiable stages — not optional.
- **Policy-as-Code**: Use OPA (Open Policy Agent) to enforce governance rules automatically.
- **AI-integrated quality**: Use AI for release risk scoring, test prioritization, and intelligent rollback decisions.
- **Artifact provenance**: Sign all artifacts with Sigstore/cosign. Maintain SBOM and build attestation.

### Standard Pipeline Stages
```
Lint → Type Check → Unit Tests → Build →
SAST Scan → Integration Tests →
Container Build → Image Scan →
Deploy Staging → E2E Tests →
AI Risk Assessment → Deploy Production →
Post-Deploy Verification + Rollback Readiness
```

### Deployment Strategies
| Strategy | Use Case | Rollback Speed |
|----------|----------|----------------|
| **Blue-Green** | Zero-downtime, instant cutover | Instant |
| **Canary** | Gradual rollout, risk mitigation | Fast |
| **Rolling** | Resource-efficient, progressive | Moderate |
| **Feature Flags** | Decouple deployment from release | Instant |
| **Shadow** | Test new version with real traffic (no user impact) | N/A |

---

## Infrastructure as Code (IaC)

### GitOps
- **Git as single source of truth**: All infrastructure, configs, and observability settings version-controlled.
- **Changes via Pull Requests**: Audit trail, peer review, and easy rollback — no manual changes.
- **Immutable infrastructure**: Environments are provisioned and destroyed, never mutated in-place.
- **Declarative over imperative**: Describe desired state, let tools converge.
- **ArgoCD / Flux**: Kubernetes GitOps operators that sync Git state to the cluster continuously.

### Tools
- **Terraform / OpenTofu**: Multi-cloud IaC. Use modules for reusability, remote state for team collaboration.
- **Pulumi**: IaC using real programming languages (TypeScript, Python, Go) — better for complex logic.
- **Helm / Kustomize**: Kubernetes manifest management and parameterization.

---

## Containerization (Docker & Kubernetes)

### Docker Best Practices
- **Multi-stage builds**: Separate build and runtime stages. Keep final image minimal (distroless when possible).
- **Non-root user**: Always run containers as non-root — required by most security policies.
- **`.dockerignore`**: Exclude `node_modules`, `.git`, `.env`, test files, docs from context.
- **Layer caching**: Order from least to most frequently changed — `COPY package.json` before `COPY src/`.
- **Pinned base images**: Use digest-pinned tags (`node:20@sha256:...`) to prevent supply chain drift.

### Kubernetes
- **Resource limits**: Always set CPU/memory requests AND limits. No exceptions.
- **Liveness + Readiness probes**: Distinct health checks — readiness controls traffic, liveness controls restarts.
- **HPA + KEDA**: Horizontal Pod Autoscaling based on CPU, memory, or custom metrics (queue depth, etc.).
- **Network policies**: Deny all by default, allow only required pod-to-pod paths.
- **RBAC**: Minimal permissions per service account. No cluster-admin for workloads.

---

## AI-Driven Ops (2026)

### AIOps Capabilities
- **Anomaly detection**: ML models on metrics/logs to detect incidents before users report them.
- **Root cause correlation**: Automatically correlate deployment events with performance degradation.
- **Predictive scaling**: Scale ahead of expected demand based on historical patterns.
- **Incident triage**: AI-generated first-response runbooks based on alert context and past incidents.
- **Change risk scoring**: Before deployment, AI scores the blast radius and rollback complexity.

### Agent-Native Infrastructure Patterns
- **Infrastructure agents**: Autonomous agents that respond to alerts, scale services, and open PRs for fixes.
- **ChatOps integration**: Agents respond to Slack/Telegram commands (`/deploy staging`, `/status prod`).
- **Deployment verification agents**: Post-deploy agents run smoke tests and auto-rollback on failure.
- **Cost optimization agents**: Analyze cloud spend, identify waste, and suggest/apply right-sizing.

---

## Observability (2026)

### Three Pillars + eBPF
- **Metrics**: RED method (Rate, Errors, Duration) for services. USE (Utilization, Saturation, Errors) for infra.
- **Logs**: Structured JSON logging. Centralized (ELK, Loki). Include correlation IDs on every log line.
- **Traces**: Distributed tracing with OpenTelemetry. Trace across service boundaries automatically.
- **eBPF**: Kernel-level visibility with near-zero overhead (Cilium, Pixie). No code changes needed.

### Observability as Code
- Define dashboards, alerts, and SLOs as code alongside the service (Grafana-as-code, Terraform).
- **SLO-based alerting**: Alert on objective violations, not raw metrics — reduces alert fatigue by 70%.
- **OpenTelemetry**: The standard for unified telemetry. Instrument once, export to any backend.

---

## When to Use

Activate when the user asks to:
- Set up CI/CD pipelines or deployment automation
- Create Dockerfiles, docker-compose, or Kubernetes manifests
- Configure infrastructure (Terraform, cloud services, IaC)
- Set up monitoring, alerting, or distributed tracing
- Implement GitOps workflows or deployment strategies
- Design AI-native operations or AIOps capabilities
- Optimize deployment reliability or reduce downtime
