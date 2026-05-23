# ⚙️ Backend & API Engineering (2026 Edition)

> Skills for building production-grade backend services, APIs, and data layers.

## Node.js & TypeScript (2026 Standards)

### TypeScript-First
- **Strict mode always**: `strict: true` in `tsconfig.json` — non-negotiable.
- **Zod at boundaries**: Runtime validation for ALL external inputs (API requests, env vars, config files).
- **Never use `any`**: Use `unknown` with type guards and discriminated unions.
- **`satisfies` operator**: For type-safe object literals with inference.
- **Branded types**: For domain-specific primitives (`UserId`, `Email`, `Currency`).

### Modern Node.js Patterns
- **Async/Await everywhere**: No callbacks, no raw promises. Use `async/await` exclusively.
- **Layered Architecture**: Controller → Service → Repository. Keep controllers thin.
- **Dependency Injection**: Use factories or DI containers for testable, configurable code.
- **Error Handling**: Custom error classes with HTTP status codes. Use Result/Either pattern for business logic errors.
- **Graceful Shutdown**: Handle SIGTERM/SIGINT — drain connections, finish in-flight requests, close DB pools.
- **Structured Logging**: Use structured JSON logging (Pino, Winston). Include request IDs, timestamps, severity levels.

## API Design (2026)

### REST (Public APIs, CRUD)
- Use **URI versioning**: `/api/v1/users`
- **Consistent naming**: plural nouns for resources, kebab-case for multi-word
- **Proper HTTP methods**: GET (read), POST (create), PUT (full update), PATCH (partial), DELETE
- **Pagination**: cursor-based for large datasets, offset for small
- **Error format**: RFC 7807 Problem Details (`type`, `title`, `status`, `detail`)

### GraphQL (Complex UIs, Mobile)
- Use when clients need precise data fetching (no over/under-fetching)
- Implement **DataLoader** to prevent N+1 queries
- Use **persisted queries** in production for security and performance
- Schema-first design with code generation

### gRPC (Internal Microservices)
- Preferred for high-throughput, low-latency internal communication
- Use Protocol Buffers for schema definition
- Implement proper deadlines and cancellation

### Contract-First Design
- Define OpenAPI/Swagger schemas BEFORE writing code
- Generate SDKs and docs automatically from schemas
- Use **contract testing** (Pact) to prevent breaking changes
- Provide `openapi.json` and `llms.txt` for AI agent consumption

## Database Patterns

### Polyglot Persistence
| Workload | Best Tool |
|----------|-----------|
| Relational/ACID | PostgreSQL |
| Document store | MongoDB |
| Key-value cache | Redis |
| Full-text search | Elasticsearch/Meilisearch |
| Time series | TimescaleDB/InfluxDB |
| Graph data | Neo4j |
| Message queue | Redis Streams, RabbitMQ, Kafka |

### Performance Patterns
- **Connection pooling**: Never one-connection-per-request. Use pooling (pg-pool, Prisma).
- **Caching strategy**: Cache-aside pattern with Redis. Invalidate on writes.
- **Read replicas**: Offload read queries from primary DB.
- **N+1 prevention**: Use JOINs, DataLoader, or eager loading. Never query in a loop.
- **Indexing**: Index foreign keys, frequently filtered/sorted columns. Use `EXPLAIN ANALYZE`.
- **Migrations**: Version-controlled, reversible, zero-downtime (expand-contract pattern).

## When to Use

Activate these skills when the user asks to:
- Build APIs, microservices, or backend services
- Design database schemas or optimize queries
- Implement authentication, caching, or messaging
- Set up Node.js/TypeScript project architecture
- Integrate with databases, queues, or external services
