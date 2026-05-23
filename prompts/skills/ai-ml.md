# 🤖 AI/ML Integration & Prompt Engineering (2026 Edition)

> Skills for building AI-powered features, integrating LLMs, and engineering reliable agent systems.

## Context Engineering (2026 Paradigm)

### From Prompts to Context Assembly
- **Context is king**: Output quality is 90%+ determined by what's in the context window.
- **High-signal context**: Curate relevant code, docs, errors, and examples. Remove noise.
- **Token budget management**: Track usage, compress old context, prioritize recent interactions.
- **RAG (Retrieval-Augmented Generation)**: Retrieve relevant documents/code before generating.

### The CRTSE Framework
| Component | Purpose |
|-----------|---------|
| **Context** | Project environment, tech stack, architecture patterns |
| **Role** | Specific persona with expertise level |
| **Task** | Clear, actionable, singular goal |
| **Standards** | Coding standards, security, performance requirements |
| **Examples** | Few-shot examples for format and logic |

## Agentic Patterns (2026)

### ReAct (Reason + Act)
The gold standard for autonomous agents:
```
Think → Act (tool call) → Observe (result) → Reflect → Repeat
```

### Self-Reflection Loops
- After generating code, mentally execute it
- Check for edge cases, error handling, type safety
- Run tests via tools, refine if failures occur
- Never "fire and forget" — always verify

### Multi-Model Strategies
- **Router model**: Small model for classification → large model for complex tasks
- **Consensus**: Query multiple models, merge best answers
- **Specialization**: Coding model for implementation, reasoning model for planning

## MCP (Model Context Protocol)

- **Standard for tool connectivity**: Universal protocol for AI ↔ Tool communication
- **Client mode**: Connect to external MCP servers for additional capabilities
- **Server mode**: Expose your tools to other AI agents
- **Dynamic tool discovery**: Agents discover available tools at runtime

## LLM Integration Patterns

### API Integration
- Use **streaming** for long responses (SSE, WebSocket)
- Implement **retry with backoff** for API failures
- **Token counting**: Track input/output tokens for cost and context management
- **Prompt caching**: Static content first, variable content last — reduces latency

### Structured Outputs
- Always define **JSON schemas** for tool-calling agents
- Use **function calling** instead of parsing free-text responses
- Validate outputs with Zod/JSON Schema before acting on them

### Safety & Guardrails
- **Content filtering**: Pre/post-processing for harmful content
- **Tool sandboxing**: Restrict what tools can do (file access, network, commands)
- **Rate limiting**: Per-user, per-session limits on expensive operations
- **Audit logging**: Record all AI actions for accountability

## Embeddings & Vector Search

- **Local embeddings**: Generate via Ollama API for privacy
- **Vector stores**: SQLite + embeddings, Chroma, Qdrant, Pinecone
- **Semantic search**: Find code/docs by meaning, not just keywords
- **Hybrid search**: Combine vector similarity with keyword (BM25) search

## When to Use

Activate these skills when the user asks to:
- Integrate AI/LLM features into applications
- Build autonomous agents or chatbots
- Implement RAG, embeddings, or semantic search
- Design prompt systems or context management
- Set up MCP servers/clients
- Optimize AI costs, latency, or reliability
