# 🏗️ Architecture & System Design (2026 Edition)

> Skills for designing scalable, maintainable, production-grade software systems.

## Core Architectural Patterns

### Modular Monolith → Microservices Spectrum
- **Modular Monolith**: Preferred for teams < 30 devs. Clear bounded contexts, single deployment, testable. Start here — extract later.
- **Microservices**: Only when independent scaling, fault isolation, or large distributed teams demand it. Avoid "distributed monolith" anti-pattern.
- **Event-Driven Architecture (EDA)**: Default to async communication. Services react to state changes (events) instead of blocking on synchronous chains.

### Hexagonal / Clean Architecture (Ports & Adapters)
- **Dependency Rule**: Dependencies always point inward toward domain core.
- **Ports**: Interfaces that define what the domain needs (DB, messaging, HTTP).
- **Adapters**: Implementations that satisfy ports (PostgreSQL adapter, Kafka adapter).
- **Domain stays pure**: No framework imports, no infrastructure leaks.

### Domain-Driven Design (DDD)
- Use **Bounded Contexts** to define service boundaries aligned with business domains.
- Identify **Aggregates**, **Entities**, **Value Objects**, and **Domain Events**.
- Use **Ubiquitous Language** — code terms match business terms.
- Apply **CQRS** (Command Query Responsibility Segregation) for complex domains.

## Design Principles (2026)

| Principle | Application |
|-----------|-------------|
| **SOLID** | Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion |
| **DRY** | Extract shared logic into utilities/services, but don't over-abstract |
| **KISS** | Simple solutions first. Complexity must be justified by requirements |
| **YAGNI** | Don't build features speculatively. Build what's needed now |
| **Fail Fast** | Validate inputs at boundaries. Return clear errors early |
| **Design for Failure** | Circuit breakers, retries, fallbacks. Assume the network is unreliable |
| **API-First** | Treat APIs as stable contracts. Use contract testing (Pact). Define OpenAPI schemas before coding |
| **Database-per-Service** | No shared databases between services. Data sovereignty is critical |

## Platform Engineering
- Build **Internal Developer Platforms (IDPs)** — standardized deployment, logging, monitoring.
- Provide **golden paths** — pre-configured templates for common service types.
- Treat infrastructure as a product, not a shared service.

## When to Use

Activate these skills when the user asks to:
- Design a new system, feature, or API from scratch
- Refactor, restructure, or decompose a monolith
- Review architecture decisions or evaluate trade-offs
- Plan data models, service boundaries, or event flows
- Migrate between architectural patterns
