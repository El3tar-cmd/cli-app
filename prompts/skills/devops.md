# 🚀 DevOps, CI/CD & Infrastructure (2026 Edition)

> Skills for building automated, reliable, observable deployment pipelines and infrastructure.

## CI/CD Pipelines (2026)

### Pipeline as Enforceable Contracts
- **Security gates**: SAST, DAST, dependency scanning, and license checks are non-negotiable pipeline stages.
- **Policy-as-Code**: Use OPA (Open Policy Agent) or similar to enforce governance rules automatically.
- **AI-integrated**: Use AI for release risk assessment, test prioritization, and intelligent rollbacks.
- **Artifact management**: Sign all artifacts, verify checksums, maintain provenance metadata.

### Pipeline Stages (Standard)
```
Lint → Type Check → Unit Tests → Build → SAST Scan → 
Integration Tests → Container Build → Image Scan → 
Deploy to Staging → E2E Tests → Deploy to Production → 
Post-Deploy Verification
```

### Deployment Strategies
| Strategy | Use Case |
|----------|----------|
| **Blue-Green** | Zero-downtime, instant rollback |
| **Canary** | Gradual rollout, risk mitigation |
| **Rolling** | Resource-efficient, progressive update |
| **Feature Flags** | Decouple deployment from release |

## Infrastructure as Code (IaC)

### GitOps
- **Git as single source of truth**: All infrastructure, configs, and observability settings version-controlled.
- **Changes via Pull Requests**: Ensures audit trail, peer review, and easy rollback.
- **Immutable infrastructure**: Environments are provisioned and destroyed, never mutated in-place.
- **Declarative over imperative**: Describe desired state, let tools converge.

### Tools
- **Terraform / OpenTofu**: Multi-cloud IaC. Use modules for reusability.
- **Pulumi**: IaC using real programming languages (TypeScript, Python, Go).
- **Kubernetes manifests**: Helm charts or Kustomize for standardization.

## Containerization (Docker & Kubernetes)

### Docker Best Practices
- **Multi-stage builds**: Separate build and runtime stages. Keep images minimal.
- **Non-root user**: Always run containers as non-root.
- **`.dockerignore`**: Exclude `node_modules`, `.git`, `.env`, test files.
- **Layer caching**: Order Dockerfile instructions from least to most frequently changed.
- **Health checks**: Define `HEALTHCHECK` for container orchestration.
- **Image scanning**: Automated vulnerability scanning (Trivy, Grype) in CI.

### Kubernetes
- **Resource limits**: Always set CPU/memory requests AND limits.
- **Liveness + Readiness probes**: Distinct health checks for different concerns.
- **Horizontal Pod Autoscaling**: Scale based on CPU, memory, or custom metrics.
- **Network policies**: Restrict pod-to-pod communication by default.
- **RBAC**: Minimal permissions for service accounts.

## Observability (2026)

### Three Pillars + eBPF
- **Metrics**: RED method (Rate, Errors, Duration) for services. USE method (Utilization, Saturation, Errors) for resources.
- **Logs**: Structured JSON logging. Centralized (ELK, Loki). Include correlation IDs.
- **Traces**: Distributed tracing with OpenTelemetry. Trace across service boundaries.
- **eBPF**: Kernel-level visibility with near-zero overhead (Cilium, Pixie). No code changes needed.

### Observability as Code
- Define dashboards, alerts, and SLOs as code alongside the service.
- **SLO-based alerting**: Alert on service level objectives, not just uptime — reduces alert fatigue.
- **OpenTelemetry**: The standard for unified telemetry. Instrument once, export to any backend.

## When to Use

Activate these skills when the user asks to:
- Set up CI/CD pipelines or deployment automation
- Create Dockerfiles, docker-compose configs, or Kubernetes manifests
- Configure infrastructure (Terraform, cloud services)
- Set up monitoring, alerting, or logging
- Optimize deployment strategies or reduce downtime
