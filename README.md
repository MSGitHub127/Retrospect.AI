# Retrospect.AI — Incident Intelligence Console

> Enterprise-grade incident command center for live triage, memory-based incident matching, auto-generated post-mortems, and operational observability.

Retrospect.AI is **not a chatbot**. It is a mission-critical operations console for Site Reliability Engineers: a three-column dashboard that streams live incidents, matches them against an institutional memory of past failures using TF-IDF cosine similarity, and produces remediation playbooks and post-mortems that can be exported to Notion / Confluence.

---

## Features

- **Live triage stream** — severity chips (critical / high / medium / low), region, error code, active-incident indicator, real-time list.
- **Deep-dive analysis engine** — selected incident details, stack trace panel with line numbers, historical memory match timeline with similarity bars, and a memory-assisted remediation playbook with risk classification per step.
- **Institutional memory** — pure TF-IDF + cosine similarity matcher over past incidents (no external embedding service required). Ports the original Python `memory_store.py` logic to TypeScript.
- **Auto post-mortems** — one-click generation with timeline, contributing factors, action items, and lessons. Export to Markdown for Notion / Confluence.
- **Observability panel** — system health, recall quality, match rate, p50 diagnosis latency, per-service status, and a service × failure-class confidence matrix heatmap.
- **Dark / light themes** — dark mode is a midnight operations console; light mode is a clean infrastructure dashboard. Theme is persisted to `localStorage`.
- **Fully responsive** — three-column dashboard on desktop, two-column on tablet, stacked (triage → analysis → observability) on mobile.

---

## Tech stack

| Layer        | Tech                                                       |
| ------------ | ---------------------------------------------------------- |
| Framework    | [TanStack Start](https://tanstack.com/start) (SSR React 19) |
| Build        | Vite 7                                                     |
| Styling      | Tailwind CSS v4 (CSS-first `@theme`, `oklch` tokens)       |
| Components   | shadcn/ui primitives + custom Retrospect components        |
| Data layer   | TanStack Query + `createServerFn` typed RPC                |
| Type system  | TypeScript (strict)                                        |
| Icons        | lucide-react                                               |
| Fonts        | Inter (UI) + JetBrains Mono (logs, IDs, timestamps)        |

> The original Streamlit prototype (Python) lives in the upstream repo as `app.py` / `memory_store.py` / `agent.py` / `incidents_data.py`. The TypeScript backend in this app preserves the same data model and matching algorithm.

---

## Folder structure

```
src/
├── components/
│   ├── retrospect/              # Product-specific UI
│   │   ├── analysis-panel.tsx   # Center column — stack trace, timeline, playbook
│   │   ├── observability-panel.tsx # Right column — memory health + post-mortem
│   │   ├── side-rail.tsx        # Slim left navigation rail
│   │   ├── status-bar.tsx       # Top system status bar + theme toggle
│   │   ├── theme-provider.tsx   # Persisted dark / light theme
│   │   ├── triage-stream.tsx    # Left column — live incident list
│   │   └── severity-chip.tsx
│   └── ui/                      # shadcn/ui primitives
├── lib/
│   ├── retrospect/
│   │   ├── api.functions.ts     # createServerFn endpoints
│   │   ├── memory.ts            # TF-IDF + cosine similarity matcher
│   │   ├── seed.ts              # PAST_INCIDENTS + LIVE_INCIDENTS
│   │   └── types.ts             # Incident / MemoryMatch / PostMortem / SystemHealth
│   └── utils.ts
├── routes/
│   ├── __root.tsx               # Root layout, fonts, ThemeProvider
│   └── index.tsx                # Three-column dashboard
└── styles.css                   # Tailwind v4 design tokens (dark + light)
```

---

## Data model

```ts
Incident         // Past incident in the memory store
LiveIncident     // Real-time incident in the triage stream
MemoryMatch      // { incident, similarity }
Diagnosis        // { likely_root_cause, pattern_match, confidence_pct, remediation[] }
PostMortem       // { summary, timeline, contributing_factors, action_items, lessons }
SystemHealth     // { memory_count, match_rate_pct, median_diagnosis_seconds, services[] }
ConfidenceCell   // { service, category, score, samples }
```

---

## Environment variables

This app runs end-to-end with **no environment variables required** — the memory matcher is fully in-process. Optional secrets:

| Variable          | Purpose                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| `OPENAI_API_KEY`  | Reserved for an optional LLM-backed diagnosis upgrade (currently deterministic). |

Create a `.env` file at the project root if you need to set any:

```
# .env
OPENAI_API_KEY=sk-...
```

---

## Installation

```bash
# clone, then
bun install        # or: npm install
```

## Development

```bash
bun run dev        # vite dev
```

Open <http://localhost:5173>.

## Production build

```bash
bun run build
bun run preview
```

---

## Backend / API overview

Server logic lives in `src/lib/retrospect/api.functions.ts` and runs as TanStack Start server functions (typed RPC over HTTP).

| Function              | Method | Purpose                                                                    |
| --------------------- | ------ | -------------------------------------------------------------------------- |
| `listLiveIncidents`   | GET    | Real-time triage feed                                                      |
| `listMemory`          | GET    | Indexed past incidents                                                     |
| `getSystemHealth`     | GET    | Memory count, recall quality, per-service status                           |
| `getConfidenceMatrix` | GET    | Service × failure-class confidence scores for the heatmap                  |
| `diagnose`            | POST   | TF-IDF match over memory, returns `{ diagnosis, matches }`                 |
| `generatePostMortem`  | POST   | Produces a structured post-mortem (timeline, factors, action items)        |

The frontend calls them via `useServerFn` + TanStack Query so caching, retries, and loading states are handled centrally.

---

## Theme support

Tokens are defined in `src/styles.css` as `oklch()` CSS variables under `:root` (light) and `.dark` (dark). Both modes expose the same semantic tokens (`--background`, `--surface`, `--cyan`, `--crimson`, `--amber`, `--emerald`, …) so components never hard-code colors. Theme is persisted to `localStorage` under `retrospect-theme`.

- **Dark**: deep obsidian background, charcoal surfaces, cyan accents, crimson reserved for critical incidents.
- **Light**: near-white background, white surfaces, the same cyan and crimson accents, softer borders.

Toggle via the moon / sun button in the top status bar.

---

## Screenshots

> Add screenshots to `docs/screenshots/` and reference them here.

- `docs/screenshots/dashboard-dark.png` — three-column dashboard, dark mode
- `docs/screenshots/dashboard-light.png` — three-column dashboard, light mode
- `docs/screenshots/postmortem.png` — generated post-mortem export

---

## Troubleshooting

**Blank page after install** — make sure dependencies installed cleanly; clear `node_modules` and reinstall.

**Fonts look wrong** — Inter / JetBrains Mono are loaded from Google Fonts in `__root.tsx`. If your network blocks `fonts.googleapis.com`, host the fonts locally or swap the `<link>` in the root route.

**Tailwind classes not applying** — this project uses Tailwind v4. There is no `tailwind.config.js`; all tokens live in `src/styles.css` under `@theme inline`.

**Server function 500 errors** — check the dev server console; server functions log full stack traces there. Verify your Node version is 20+.

**Theme not persisting** — confirm the browser allows `localStorage` for the origin. The provider falls back to dark mode if it can't read the stored value.

---

## License

Proprietary — Retrospect.AI. Adapt freely for internal use.
