/**
 * backend/vector-store.ts
 *
 * In-process vector store using TF-IDF + cosine similarity.
 * Mirrors the RetrospectVectorStore (ChromaDB) interface from the blueprint,
 * adapted for the TanStack Start serverless / edge environment where a running
 * ChromaDB server isn't available.  When the app connects to a real DB/Redis
 * you can replace this with a ChromaDB HTTP client call from a server function
 * — the API contract (upsert / semanticSearch / deleteByIncident) stays the same.
 *
 * Storage: module-level Map, persisted across requests within the same process.
 */

export interface VectorDocument {
  id: string;
  incidentId: string;
  serviceName: string;
  severity: string;
  chunkText: string;
  openedAtTs: number;
  extraMetadata?: Record<string, unknown>;
  // TF-IDF vector stored as sparse map
  _vec?: Map<string, number>;
}

export interface SearchHit {
  score: number;
  chromaId: string;
  incidentId: string;
  serviceName: string;
  severity: string;
  chunkText: string;
}

// ── Module-level in-process store ────────────────────────────────────────────
const store = new Map<string, VectorDocument>();

// ── TF-IDF helpers ────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function termFreq(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const n = tokens.length || 1;
  const tf = new Map<string, number>();
  for (const [t, c] of freq) tf.set(t, c / n);
  return tf;
}

function idf(term: string, allDocs: string[][]): number {
  const df = allDocs.filter((d) => d.includes(term)).length;
  return Math.log((allDocs.length + 1) / (df + 1)) + 1;
}

function buildVector(text: string, allDocs: string[][]): Map<string, number> {
  const tokens = tokenize(text);
  const tf = termFreq(tokens);
  const vec = new Map<string, number>();
  for (const [term, tfVal] of tf) {
    vec.set(term, tfVal * idf(term, allDocs));
  }
  return vec;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [k, v] of a) {
    const bv = b.get(k);
    if (bv) dot += v * bv;
  }
  let na = 0, nb = 0;
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ── Reindex all documents after each insert ───────────────────────────────────

function reindexAll(): void {
  const allDocs = [...store.values()].map((d) => tokenize(d.chunkText));
  for (const doc of store.values()) {
    doc._vec = buildVector(doc.chunkText, allDocs);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function upsertChunk(doc: Omit<VectorDocument, "_vec">): void {
  store.set(doc.id, { ...doc });
  reindexAll();
}

export interface SearchOptions {
  topK?: number;
  serviceFilter?: string;
  severityFilter?: string;
  maxAgeDays?: number;
  scoreThreshold?: number;
}

export function semanticSearch(queryText: string, opts: SearchOptions = {}): SearchHit[] {
  const {
    topK = 5,
    serviceFilter,
    severityFilter,
    maxAgeDays,
    scoreThreshold = 0.05, // lower threshold for TF-IDF vs cosine embedding
  } = opts;

  if (store.size === 0) return [];

  const cutoff = maxAgeDays != null ? Date.now() / 1000 - maxAgeDays * 86400 : 0;
  const allDocs = [...store.values()].map((d) => tokenize(d.chunkText));
  const queryVec = buildVector(queryText, allDocs);

  const results: SearchHit[] = [];

  for (const doc of store.values()) {
    if (serviceFilter && doc.serviceName !== serviceFilter) continue;
    if (severityFilter && doc.severity !== severityFilter) continue;
    if (cutoff && doc.openedAtTs < cutoff) continue;

    const score = doc._vec ? cosine(queryVec, doc._vec) : 0;
    if (score >= scoreThreshold) {
      results.push({
        score: Math.round(score * 10000) / 10000,
        chromaId: doc.id,
        incidentId: doc.incidentId,
        serviceName: doc.serviceName,
        severity: doc.severity,
        chunkText: doc.chunkText,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, topK);
}

export function deleteByIncident(incidentId: string): number {
  let removed = 0;
  for (const [id, doc] of store.entries()) {
    if (doc.incidentId === incidentId) {
      store.delete(id);
      removed++;
    }
  }
  if (removed > 0) reindexAll();
  return removed;
}

export function count(): number {
  return store.size;
}

export function getStore(): Map<string, VectorDocument> {
  return store;
}
