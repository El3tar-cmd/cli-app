# 🐛 Debugging, Performance & Observability (2026 Edition)

> Systematic troubleshooting, root cause analysis, and AI-assisted optimization.

## Debugging Methodology

### Systematic Approach (REPRODUCE → ISOLATE → FIX → VERIFY)
1. **Reproduce**: Confirm the bug. Get exact steps, environment, inputs, and frequency.
2. **Read the error**: Stack traces, error codes, log messages. Don't guess — read everything.
3. **Isolate**: Binary search the problem space. Comment out code, add logging, narrow scope.
4. **Hypothesize**: Form a theory based on evidence. One hypothesis at a time.
5. **Fix**: Apply minimal, targeted fix. Don't rewrite unrelated code while fixing.
6. **Verify**: Run tests, reproduce the original scenario, confirm resolution.
7. **Prevent**: Add a test that would have caught this bug. Document root cause in a comment.

### Common Bug Patterns
| Pattern | Symptoms | Typical Fix |
|---------|----------|-------------|
| Race condition | Intermittent failures, order-dependent | Locks, queues, atomic operations |
| Memory leak | Growing memory over time | Clear listeners, close connections, WeakRef |
| Circular dependency | Import errors, undefined at init | Restructure dependencies, lazy imports |
| N+1 query | Slow APIs, excessive DB round-trips | Use JOINs, DataLoader, eager loading |
| Stale closure | Wrong values in async callbacks | useRef, fresh references, dependency arrays |
| Timezone bug | Off-by-one dates, wrong times | Always UTC internally, convert at display layer |
| Promise not awaited | Partial execution, missing side effects | Audit all async calls with ESLint rules |
| Off-by-one | Boundary conditions, last item missing | Draw it out, test edge cases explicitly |

---

## AI-Assisted Debugging (2026 Workflow)

### Root Cause Analysis with AI
- Give the model the **full error message + stack trace + relevant code** — not a paraphrase.
- Include **what you've already tried** — prevents circular suggestions.
- Provide **system context**: OS, Node version, dependencies, recent changes.
- Ask for **multiple hypotheses** ranked by probability, not just the first guess.

### Rubber Duck Protocol for AI
```
1. Paste the exact error (no summaries)
2. Paste the function/component where the error originates
3. Paste relevant config (tsconfig, package.json, env vars)
4. Describe the last change made before the bug appeared
5. Ask: "What are the 3 most likely root causes and how would I test each?"
```

### Automated Debugging Tools
- **Node.js**: `--inspect` flag + Chrome DevTools, `clinic.js`, `0x` flame graphs
- **Frontend**: Chrome DevTools Performance, React DevTools Profiler, Lighthouse
- **Database**: `EXPLAIN ANALYZE`, slow query logs, `pg_stat_statements`
- **Memory**: `heapdump`, `clinic.js heapprofiler`, Chrome Memory tab
- **Network**: Wireshark, mitmproxy, `ngrep` for request inspection

---

## Performance Optimization

### Profiling First — Always
- **Never optimize without measuring**. Every optimization must have before/after numbers.
- **Establish baseline**: Record p50, p95, p99 latency + memory + CPU before touching anything.
- **Profile in production conditions**: Synthetic benchmarks often miss real bottlenecks.
- **Find the hotspot**: 80% of performance problems come from 20% of code.

### Backend Performance Patterns
- **Big-O awareness**: Know algorithm complexity. O(n²) hidden in nested loops kills production.
- **Connection pooling**: Reuse DB/HTTP connections. Cold connections cost 20–100ms each.
- **Caching layers**: In-memory (LRU) → Redis → CDN. Invalidate on write, not on read.
- **Async I/O**: Never block the event loop. Use worker_threads for CPU-heavy tasks.
- **Streaming**: Process large data in streams — never load entire files into memory.
- **Batch operations**: Batch DB writes, external API calls, and queue publishes.

### Frontend Performance
- **Core Web Vitals targets**: LCP < 2.5s, INP < 200ms, CLS < 0.1
- **Code splitting**: Route-based and component-based dynamic imports
- **Image optimization**: AVIF/WebP formats, responsive `srcSet`, lazy loading below fold
- **Virtual scrolling**: For lists > 100 items (TanStack Virtual, react-window)
- **Debounce/throttle**: For scroll, resize, and search-as-you-type handlers
- **Web Workers**: Offload computation (parsing, encryption, compression) from main thread

---

## Observability (Production Debugging)

### Three Pillars
- **Metrics**: RED method (Rate, Errors, Duration) for services. USE method for infrastructure.
- **Logs**: Structured JSON. Include `requestId`, `userId`, `duration`, `status`. Centralize (Loki, ELK).
- **Traces**: Distributed tracing with OpenTelemetry. Trace across service and process boundaries.

### Effective Logging
```typescript
// ✅ Structured log — searchable, filterable, correlatable
logger.info('payment_processed', {
  requestId: ctx.requestId,
  userId: payment.userId,
  amount: payment.amount,
  currency: payment.currency,
  durationMs: Date.now() - start,
});

// ❌ String concatenation — unsearchable, brittle
console.log(`Payment of ${amount} processed for user ${userId}`);
```

### Alerting Strategy
- Alert on **SLO violations**, not raw metrics — reduces alert fatigue
- Every alert must have a **runbook** explaining how to respond
- **Silence on deploy**: Suppress flapping alerts for 5 minutes after deployments

---

## Documentation (2026 Standards)

### Code Documentation
- **Comments explain WHY, not WHAT** — the code shows what; comments explain intent and context.
- **JSDoc/TSDoc**: Document public APIs, interfaces, and non-obvious function behaviors.
- **ADRs (Architecture Decision Records)**: Document significant technical decisions with context and trade-offs.
- **README**: Project overview, local setup, environment variables, common debugging steps.

---

## When to Use

Activate when the user asks to:
- Debug errors, crashes, or unexpected behavior
- Optimize performance (backend, frontend, database)
- Profile applications or analyze bottlenecks
- Set up logging, monitoring, or tracing
- Write or improve technical documentation
- Analyze algorithm complexity or data structure choices
