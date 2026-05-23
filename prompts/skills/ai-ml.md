# 🤖 AI/ML Integration, Agentic Design & Local LLM (2026 Edition)

> Skills for building production-grade AI features, agentic systems, and local LLM pipelines.

## Context Engineering (The 2026 Paradigm)

### From Prompts to Context Assembly
- **Context is king**: Output quality is 90%+ determined by what's in the context window.
- **High-signal curation**: Include relevant code, errors, docs, examples. Strip noise ruthlessly.
- **Token budget discipline**: Track usage actively. Compress older turns. Prioritize recency.
- **RAG (Retrieval-Augmented Generation)**: Retrieve relevant content before generating — not after.
- **Context freshness**: Stale context is worse than no context. Prune aggressively.

### The CRTSE Framework
| Component | Purpose |
|-----------|---------|
| **Context** | Project environment, tech stack, error traces, recent file diffs |
| **Role** | Specific persona with expertise level and constraints |
| **Task** | Clear, singular, actionable goal |
| **Standards** | Coding style, security policy, performance requirements |
| **Examples** | 2–3 few-shot examples that demonstrate format and reasoning |

### Context Window Optimization (Local LLMs)
- **System prompt compression**: Remove redundant instructions — models follow concise prompts better.
- **Rolling window**: Keep last N messages + summary of older messages. Never dump the full history.
- **Priority ordering**: System → relevant tools → recent context → current task (most tokens go last).
- **Selective RAG**: Only retrieve when the question is factual. Skip for creative/generative tasks.
- **Cache-friendly prompts**: Put static content at the start — Ollama/vLLM can KV-cache it.

---

## Agentic System Design (2026)

### ReAct Pattern (Reason + Act)
The gold standard for autonomous agents:
```
Think → Act (tool call) → Observe (result) → Reflect → Repeat until done
```
- Never skip the **Reflect** step — agents that act without reflecting cause cascading errors.
- Set a **max iterations limit** (e.g. 20) to prevent infinite loops.
- Each cycle should produce a **meaningful state change**.

### Tool Design for Agents
```typescript
// ✅ Good tool: atomic, typed, predictable
interface ReadFileTool {
  name: 'read_file';
  input: { path: string; encoding?: 'utf8' | 'binary' };
  output: { content: string; lines: number };
}

// ❌ Bad tool: broad, ambiguous, unpredictable
interface DoEverythingTool {
  name: 'execute';
  input: { instruction: string }; // The model has to interpret this
}
```
- **One tool, one action** — atomic tools are more reliable than multi-purpose ones.
- **Rich output schemas** — agents need structured output to reason about results.
- **Idempotent tools** — tools should be safe to call multiple times with the same args.
- **Confirmation gates** — any destructive action (delete, overwrite, send) requires explicit approval.
- **Tool descriptions are prompts** — write them carefully. Bad descriptions = bad tool usage.

### Multi-Agent Coordination
- **Orchestrator–Subagent pattern**: Coordinator plans and delegates; specialized agents execute.
- **Shared context store**: Agents communicate via shared state (not direct calls).
- **Result verification**: Orchestrator reviews subagent output before accepting.
- **Parallel when independent**: Fan out to multiple agents simultaneously for unblocked tasks.
- **Failure isolation**: One subagent failure should not cascade. Each agent has its own error boundary.

### Self-Reflection & Quality Gates
- After generating code → mentally execute it → check for edge cases.
- After making changes → re-read the modified section → confirm intent matches output.
- Run tool-based verification (tests, type-checks, linters) before declaring done.
- **Never "fire and forget"** — always verify results before moving to the next step.

---

## Local LLM Optimization (Ollama / vLLM / llama.cpp)

### Model Selection Strategy
| Use Case | Recommended Size | Notes |
|----------|-----------------|-------|
| Simple Q&A, routing | 3B–7B | Low latency, fast throughput |
| Code generation, reasoning | 14B–32B | Balance quality/speed |
| Complex multi-step agent | 70B+ (quantized) | Quality > speed |
| Embeddings | nomic-embed-text, mxbai | Separate from generation model |

### Performance Tuning
- **Quantization**: Q4_K_M or Q5_K_M — best quality/size tradeoff. Avoid Q2 for code tasks.
- **Context length**: Set `num_ctx` only as large as needed. Larger = more RAM = slower.
- **Batch size**: Increase `num_batch` for throughput. Decrease for lower latency.
- **GPU layers**: Maximize `num_gpu` layers for speed. CPU-only is 5–10× slower.
- **Keep-alive**: Set `keep_alive: -1` in Ollama to keep model loaded between requests.
- **Template correctness**: Wrong chat templates destroy model performance silently.

### Streaming & Reliability
- Always stream responses for long outputs — don't wait for the full completion.
- Implement retry logic with exponential backoff for Ollama API failures.
- Add a watchdog timer (60s silence = model is stuck → abort and retry).
- Log token rates — if tokens/sec drops below baseline, something is wrong.

---

## MCP (Model Context Protocol — 2026 Standard)

- **Universal tool connectivity**: Standard protocol for AI ↔ Tool communication.
- **Client mode**: Connect to external MCP servers (filesystem, databases, APIs).
- **Server mode**: Expose your own tools to any MCP-compatible agent.
- **Dynamic discovery**: Agents discover available tools at runtime — no hardcoding.
- **Transport options**: stdio (local), SSE (remote), WebSocket (real-time).

---

## Embeddings & Semantic Search

- **Local embeddings**: Use Ollama (nomic-embed-text, mxbai-embed-large) for privacy.
- **Vector stores**: SQLite + vectors, Chroma, Qdrant, pgvector.
- **Hybrid search**: Combine vector similarity (recall) + BM25 keyword (precision).
- **Chunking strategy**: 512-token chunks with 10% overlap. Include metadata (file, line, type).
- **Embedding drift**: Re-embed when model or chunking strategy changes.

---

## LLM Safety & Guardrails

- **Prompt injection defense**: Sanitize user input before including in system prompts.
- **Tool sandboxing**: Restrict filesystem access, network calls, and command execution scope.
- **Output validation**: Validate all JSON/code outputs with schemas before acting on them.
- **Rate limiting**: Per-user, per-session limits on expensive model calls.
- **Audit logging**: Record every AI action (tool call, decision, output) for accountability.
- **Confidence thresholds**: When model uncertainty is high, ask for clarification instead of acting.

---

## When to Use

Activate when the user asks to:
- Integrate AI/LLM features into applications
- Build autonomous agents or multi-agent systems
- Implement RAG, embeddings, or semantic search
- Design prompt systems, context pipelines, or tool registries
- Optimize local LLM performance (Ollama, llama.cpp, vLLM)
- Set up or consume MCP servers
- Debug AI reliability, hallucination, or tool usage issues
