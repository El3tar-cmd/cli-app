# 🐛 Debugging, Performance & Documentation (2026 Edition)

> Skills for systematic troubleshooting, optimization, and professional documentation.

## Debugging Methodology

### Systematic Approach (REPRODUCE → ISOLATE → FIX → VERIFY)
1. **Reproduce**: Confirm the bug. Get exact steps, environment, and inputs.
2. **Read the error**: Stack traces, error codes, log messages. Don't guess.
3. **Isolate**: Binary search the problem space. Comment out code, add logging, narrow scope.
4. **Hypothesize**: Form a theory about root cause based on evidence.
5. **Fix**: Apply minimal, targeted fix. Don't rewrite unrelated code.
6. **Verify**: Run tests, reproduce the original scenario, confirm resolution.
7. **Prevent**: Add a test that would have caught this bug. Document the root cause.

### Common Bug Patterns
| Pattern | Symptoms | Typical Fix |
|---------|----------|-------------|
| Race condition | Intermittent failures, order-dependent | Locks, queues, atomic operations |
| Memory leak | Growing memory over time | Clear listeners, close connections, WeakRef |
| Circular dependency | Import errors, undefined modules | Restructure dependencies, lazy imports |
| N+1 query | Slow APIs, excessive DB queries | Use JOINs, DataLoader, eager loading |
| Stale closure | Wrong values in callbacks | useRef, dependency arrays, fresh references |
| Timezone bugs | Off-by-one dates, wrong times | Always use UTC internally, convert at display |

## Performance Optimization

### Profiling First
- **Never optimize without profiling**. Measure before and after.
- **Node.js**: Use `--inspect` + Chrome DevTools, `clinic.js`, `0x` for flame graphs.
- **Frontend**: Chrome DevTools Performance tab, Lighthouse, Web Vitals.
- **Database**: `EXPLAIN ANALYZE`, slow query logs, connection pool monitoring.

### Backend Performance
- **Big-O awareness**: Know complexity of algorithms and data structures.
- **Connection pooling**: Reuse DB and HTTP connections.
- **Caching layers**: In-memory (LRU) → Redis → CDN. Strategic invalidation.
- **Async I/O**: Never block the event loop. Use worker threads for CPU-intensive tasks.
- **Streaming**: Process large data in streams, not loading entire files into memory.
- **Batch operations**: Batch DB writes, API calls, and message queue publishes.

### Frontend Performance
- **Core Web Vitals**: LCP < 2.5s, INP < 200ms, CLS < 0.1
- **Code splitting**: Route-based, component-based dynamic imports.
- **Image optimization**: Modern formats (AVIF, WebP), responsive sizes, lazy loading.
- **Virtual scrolling**: For lists > 100 items (TanStack Virtual, react-window).
- **Debounce/throttle**: For scroll, resize, and input handlers.
- **Web Workers**: Offload computation from main thread.

## Documentation (2026 Standards)

### Code Documentation
- **JSDoc/TSDoc**: Document public APIs, interfaces, complex functions.
- **Comments explain WHY, not WHAT**: The code shows what; comments explain intent and reasoning.
- **README.md**: Project overview, setup, usage, architecture, contributing guide.
- **CHANGELOG.md**: Keep a changelog (keepachangelog.com format).
- **ADRs (Architecture Decision Records)**: Document significant technical decisions with context and trade-offs.

### API Documentation
- **OpenAPI/Swagger**: Auto-generated from code annotations or schema-first.
- **Examples**: Include request/response examples for every endpoint.
- **Error catalog**: Document all error codes and their meaning.
- **SDK generation**: Auto-generate client SDKs from OpenAPI specs.

## When to Use

Activate these skills when the user asks to:
- Debug errors, crashes, or unexpected behavior
- Optimize performance (backend, frontend, database)
- Profile applications or analyze bottlenecks
- Write or improve documentation
- Analyze algorithms or data structure choices
