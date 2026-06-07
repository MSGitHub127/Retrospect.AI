# Backend Architecture

Retrospect.AI uses **TanStack Start Server Functions** as its backend layer.

Unlike a traditional React + Express architecture, there is **no separate backend service**, **no Express server**, and **no FastAPI instance** running on another port.

The backend executes inside the same TanStack Start SSR process that serves the frontend.

## Backend Structure

```text
src/lib/retrospect/
│
├── api.functions.ts       # Server Function entrypoints
├── memory.ts              # TF-IDF similarity engine
├── incident-db.ts         # Incident persistence layer
├── vector-store.ts        # Semantic memory store
├── sanitizer.ts           # PII / secret redaction
├── chunker.ts             # Log chunking pipeline
├── playbook-registry.ts   # Mitigation playbooks
├── llm-client.ts          # Claude-powered triage & RCA generation
├── seed.ts                # Seed incidents
└── types.ts               # Shared domain models
```

## How Frontend Connects to Backend

The frontend never talks directly to:

* Memory store
* Incident database
* Vector store
* Claude API
* Playbook registry

Instead, all communication flows through TanStack Start Server Functions.

```text
Browser UI
    │
    ▼
useServerFn()
    │
    ▼
api.functions.ts
    │
    ├── sanitizer.ts
    ├── chunker.ts
    ├── vector-store.ts
    ├── incident-db.ts
    ├── playbook-registry.ts
    └── llm-client.ts
```

TanStack Start automatically exposes these server functions as typed RPC endpoints over HTTP.

This provides:

* End-to-end TypeScript safety
* SSR compatibility
* Automatic serialization
* No manual REST API boilerplate
* No Express routing layer

---

# Incident Analysis Pipeline

When an incident is analyzed, Retrospect.AI executes the following workflow:

```text
Incoming Incident
        │
        ▼
Sanitize Log
        │
        ▼
Chunk Log
        │
        ▼
Store Chunks
        │
        ▼
Memory Search
        │
        ▼
Historical Match Retrieval
        │
        ▼
Triage Analysis
        │
        ▼
Mitigation Selection
        │
        ▼
Diagnosis Response
```

## Log Sanitization

Before any log reaches memory search or an LLM:

* API keys are removed
* Passwords are removed
* JWTs are removed
* Connection strings are removed
* Emails and sensitive identifiers are removed

This ensures sensitive infrastructure data never enters memory storage or model prompts.

## Historical Memory Matching

Retrospect.AI maintains an institutional memory of historical incidents.

Current implementation:

```text
TF-IDF
+
Cosine Similarity
```

Future implementation:

```text
Qdrant
+
Embeddings
+
Metadata Filtering
```

Historical matches are ranked and returned with similarity confidence scores.

## Mitigation Engine

After diagnosis:

1. Historical incidents are evaluated.
2. Matching remediation patterns are identified.
3. Safe deterministic playbooks are selected.
4. Human approval can be required for destructive actions.

Example playbooks:

* Service Restart
* DB Connection Pool Reset
* Canary Rollback
* Circuit Breaker Activation
* Heap Dump Capture

---

# Post-Mortem Generation Pipeline

```text
Incident
    │
    ▼
Historical Match Retrieval
    │
    ▼
Root Cause Analysis
    │
    ▼
Timeline Generation
    │
    ▼
Action Item Generation
    │
    ▼
Markdown Export
```

Generated post-mortems contain:

* Executive Summary
* Timeline
* Root Cause Analysis
* Impact Assessment
* Contributing Factors
* Action Items
* Prevention Measures
* Lessons Learned

---

# Starting Retrospect.AI

Retrospect.AI does not require a separate backend server.

Running the application automatically starts:

* Frontend
* SSR Runtime
* Server Functions
* Incident Analysis Backend

inside a single process.

## Install Dependencies

```bash
npm install
```

## Start Development Server

```bash
npm run dev
```

This starts:

```text
TanStack Start SSR Server
+
Frontend Application
+
Server Functions
+
Incident Analysis Engine
```

Default URL:

```text
http://localhost:3000
```

or

```text
http://localhost:5173
```

depending on your Vite configuration.

---

# Production Build

Build:

```bash
npm run build
```

Preview Production Build:

```bash
npm run start
```

or

```bash
npm run preview
```

depending on your configured scripts.

The production deployment hosts:

* React UI
* SSR rendering
* Server Functions
* Diagnosis engine
* Post-mortem generation
* Institutional memory

inside a single deployment unit.

---

# Backend API Overview

Server logic lives in:

```text
src/lib/retrospect/api.functions.ts
```

These functions are invoked from the frontend using:

```ts
useServerFn()
```

and cached using:

```ts
TanStack Query
```

## Available Server Functions

| Function            | Method | Purpose                                     |
| ------------------- | ------ | ------------------------------------------- |
| listLiveIncidents   | GET    | Live incident triage feed                   |
| listMemory          | GET    | Historical memory retrieval                 |
| getSystemHealth     | GET    | Health metrics and memory quality           |
| getConfidenceMatrix | GET    | Confidence heatmap data                     |
| diagnose            | POST   | Memory-assisted incident diagnosis          |
| generatePostMortem  | POST   | Generate structured post-mortem             |
| submitFeedback      | POST   | Human-in-the-loop feedback                  |
| approveDiagnosis    | POST   | Approve automated recommendation            |
| rejectDiagnosis     | POST   | Reject recommendation                       |
| modifyDiagnosis     | POST   | Correct recommendation and persist learning |

---

# Enterprise Roadmap

Current Version:

```text
TanStack Start
      │
      ▼
Server Functions
      │
      ▼
In-Memory Incident Intelligence
```

Future Enterprise Architecture:

```text
TanStack UI
      │
      ▼
API Gateway
      │
 ┌────┼────┐
 ▼    ▼    ▼

Postgres
Qdrant
Redis

      ▼

LangGraph Agents

      ▼

Observability Stack

(OpenTelemetry + LangSmith + Phoenix)
```

Planned Enhancements:

* PostgreSQL persistence
* Qdrant semantic memory
* Redis queues
* LangGraph multi-agent workflows
* OpenTelemetry tracing
* LangSmith evaluation
* Phoenix observability
* Kubernetes deployment
* Multi-tenant enterprise support
