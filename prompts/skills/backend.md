# ⚙️ Backend & API Engineering (2026 Edition)

> Skills for building production-grade backend services, streaming APIs, and AI-augmented data layers.

## Node.js & TypeScript (2026 Standards)

### TypeScript-First
- **Strict mode always**: `strict: true` in `tsconfig.json` — non-negotiable.
- **Zod at boundaries**: Runtime validation for ALL external inputs (API requests, env vars, config files).
- **Never use `any`**: Use `unknown` with type guards and discriminated unions.
- **`satisfies` operator**: For type-safe object literals with inference preserved.
- **Branded types**: For domain-specific primitives (`UserId`, `Email`, `Amount`).

### Modern Node.js Patterns
- **Async/Await everywhere**: No callbacks, no raw promise chains.
- **Layered Architecture**: Controller → Service → Repository. Keep controllers thin.
- **Dependency Injection**: Factories or lightweight DI containers for testable, configurable code.
- **Error Handling**: Custom error classes with HTTP status codes. Use Result/Either pattern for domain errors.
- **Graceful Shutdown**: Handle SIGTERM/SIGINT — drain connections, finish in-flight requests, close pools.
- **Structured Logging**: Pino or Winston with JSON output, request IDs, severity levels.

### Bun & Deno (2026 Alternatives)
- **Bun**: Drop-in Node.js replacement, 3–5× faster startup, built-in bundler. Production-ready for new projects.
- **Deno 2.0**: Native TypeScript, secure-by-default permissions, npm compatibility. Good for CLI tools and edge functions.
- **When to migrate**: Start new services with Bun. Migrate Node.js gradually — test thoroughly first.

---

## API Design (2026)

### REST (Default for Public APIs / CRUD)
- **URI versioning**: `/api/v1/users`
- **Consistent naming**: plural nouns, kebab-case for multi-word paths
- **Proper HTTP methods**: GET (read), POST (create), PUT (full replace), PATCH (partial update), DELETE
- **Cursor pagination**: For large datasets. Offset pagination only for small, bounded collections.
- **Error format**: RFC 9457 Problem Details (`type`, `title`, `status`, `detail`, `instance`)

### GraphQL (Complex UIs, Mobile)
- Use when clients need precise data fetching without over/under-fetching
- Implement **DataLoader** to prevent N+1 queries — always
- Use **persisted queries** in production for security and cache efficiency
- Schema-first design with automatic code generation

### gRPC (Internal Microservices)
- Preferred for high-throughput, low-latency internal communication
- Protocol Buffers for schema — strongly typed, compact, fast
- Implement proper deadlines and cancellation on every call

### Streaming APIs (AI Era)
- **Server-Sent Events (SSE)**: For AI token streaming, live feeds, one-direction pushes
- **WebSockets**: For bidirectional real-time (chat, collaboration, live coding)
- **Backpressure handling**: Producers must slow down when consumers can't keep up
- **Chunked transfer encoding**: For streaming large responses over HTTP/1.1
- Design streaming APIs with **resumability** in mind (reconnection with `Last-Event-ID`)

### AI API Gateway Patterns
```typescript
// Standard AI API gateway — handles routing, rate limits, observability
class AIGateway {
  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    await this.rateLimit(req.userId);
    const cached = await this.cache.get(req);
    if (cached) return cached;

    const result = await this.model.generate(req, {
      timeout: 90_000,
      retries: 3,
      backoff: 'exponential',
    });

    await this.cache.set(req, result, { ttl: 300 });
    await this.audit.log({ req, result, userId: req.userId });
    return result;
  }
}
```
- Cache identical AI requests (5-minute TTL for deterministic tasks)
- Implement per-user token budgets and hard spending limits
- Log all AI inputs/outputs for debugging and compliance
- Route to different models based on task complexity and cost

---

## Database Patterns

### Polyglot Persistence
| Workload | Best Tool |
|----------|-----------|
| Relational/ACID | PostgreSQL |
| Document store | MongoDB |
| Key-value cache | Redis / Valkey |
| Full-text search | Elasticsearch / Meilisearch |
| Time series | TimescaleDB / InfluxDB |
| Vector search | pgvector / Qdrant |
| Message queue | Redis Streams / Kafka |
| Edge / embedded | SQLite / libsql |

### Performance Patterns
- **Connection pooling**: Never one-connection-per-request. Use pg-pool, Prisma, Drizzle.
- **Cache-aside**: Redis for hot data. Invalidate on writes, not reads.
- **Read replicas**: Offload reads from primary. Route analytically heavy queries to replica.
- **N+1 prevention**: Use JOINs, DataLoader, or eager loading. Never query in a loop.
- **Indexing**: Index foreign keys, frequently filtered/sorted columns. Run `EXPLAIN ANALYZE` before shipping.
- **Zero-downtime migrations**: Expand-contract pattern — add column first, migrate data, then remove old.

---

## When to Use

Activate when the user asks to:
- Build APIs, microservices, or backend services
- Design database schemas or optimize queries
- Implement authentication, caching, or messaging
- Set up streaming APIs or AI gateway patterns
- Integrate AI models into backend services
- Optimize Node.js/TypeScript performance or architecture
