# 🏗️ Architecture & System Design (2026 Edition)

> Skills for designing scalable, maintainable, AI-augmented production systems.

## Core Architectural Patterns

### Modular Monolith → Microservices Spectrum
- **Modular Monolith**: Preferred for teams < 30 devs. Clear bounded contexts, single deployment, testable. Start here — extract later when scaling demands it.
- **Microservices**: Only when independent scaling, fault isolation, or large distributed teams demand it. Avoid "distributed monolith" anti-pattern — the worst of both worlds.
- **Event-Driven Architecture (EDA)**: Default to async communication. Services react to state changes (events) instead of blocking on synchronous chains.

### Hexagonal / Clean Architecture (Ports & Adapters)
- **Dependency Rule**: Dependencies always point inward toward domain core.
- **Ports**: Interfaces that define what the domain needs (DB, messaging, HTTP).
- **Adapters**: Implementations that satisfy ports (PostgreSQL adapter, Kafka adapter).
- **Domain stays pure**: No framework imports, no infrastructure leaks into business logic.

### Domain-Driven Design (DDD)
- Use **Bounded Contexts** to define service boundaries aligned with business domains.
- Identify **Aggregates**, **Entities**, **Value Objects**, and **Domain Events**.
- Use **Ubiquitous Language** — code terms match business terms exactly.
- Apply **CQRS** (Command Query Responsibility Segregation) for complex, high-traffic domains.

---

## Design Principles (2026)

| Principle | Application |
|-----------|-------------|
| **SOLID** | Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion |
| **DRY** | Extract shared logic, but don't over-abstract prematurely |
| **KISS** | Simple solutions first. Complexity must be justified |
| **YAGNI** | Don't build features speculatively |
| **Fail Fast** | Validate inputs at system boundaries. Return clear errors early |
| **Design for Failure** | Circuit breakers, retries, fallbacks. Assume the network is unreliable |
| **API-First** | Define OpenAPI schemas and contracts before writing code |
| **Database-per-Service** | No shared databases between services. Data sovereignty is non-negotiable |

---

## Agentic System Architecture (2026 Frontier)

### Agent-Oriented Design Principles
- **Tool isolation**: Each tool/agent has a single, well-defined responsibility and contract.
- **Context as shared state**: Agents coordinate through a shared context store, not direct coupling.
- **Checkpointing**: Long-running agent tasks save state at key points for resumability.
- **Observability-first**: Every agent action is traced, logged, and inspectable.
- **Human-in-the-loop gates**: Irreversible actions (delete, deploy, send) require human confirmation.

### Multi-Agent Topology Patterns
| Pattern | Use Case |
|---------|----------|
| **Orchestrator–Subagent** | Complex tasks with parallel, specialized workers |
| **Pipeline** | Sequential processing with hand-off between agents |
| **Consensus** | Multiple agents vote/verify before acting |
| **Supervisor** | Parent agent monitors and restarts failed child agents |

### Context-Aware System Design
- Systems should adapt behavior based on available context (user, time, load, capabilities).
- Design explicit **context contracts** — what data every component needs to function.
- **Progressive enhancement**: System works with minimal context, improves as context grows.
- Separate **inference layer** (AI decisions) from **execution layer** (tool actions).

---

## Platform Engineering

- Build **Internal Developer Platforms (IDPs)** — standardized deployment, logging, monitoring.
- Provide **golden paths** — pre-configured templates for common service types.
- Treat infrastructure as a product, not a shared service.
- **Self-service capability**: Teams provision and manage their own services without platform team bottleneck.

---

## Distributed Systems Patterns

### Resilience
| Pattern | Purpose |
|---------|---------|
| **Circuit Breaker** | Stop calling a failing service; fail fast |
| **Bulkhead** | Isolate failures so one component can't crash others |
| **Retry + Backoff** | Exponential backoff with jitter for transient failures |
| **Timeout** | Every external call has a maximum wait time |
| **Saga** | Distributed transactions via compensating actions |

### Consistency Models
- **Strong consistency**: Use for financial data, access control, inventory
- **Eventual consistency**: Acceptable for notifications, analytics, recommendations
- **CRDT (Conflict-free Replicated Data Types)**: For collaborative real-time features

---

## When to Use

Activate when the user asks to:
- Design a new system, feature, or API from scratch
- Refactor, restructure, or decompose a monolith
- Review architecture decisions or evaluate trade-offs
- Plan data models, service boundaries, or event flows
- Design agentic or multi-agent system topologies
- Migrate between architectural patterns or scales
