import type { Incident, MemoryMatch, Severity } from "./types";

const tokenize = (t: string) => (t.toLowerCase().match(/[a-z0-9]+/g) ?? []);

const tf = (tokens: string[]) => {
  const f = new Map<string, number>();
  tokens.forEach((t) => f.set(t, (f.get(t) ?? 0) + 1));
  const n = tokens.length || 1;
  const out = new Map<string, number>();
  f.forEach((c, t) => out.set(t, c / n));
  return out;
};

const idf = (term: string, docs: string[][]) => {
  const df = docs.filter((d) => d.includes(term)).length;
  return Math.log((docs.length + 1) / (df + 1)) + 1;
};

const tfidf = (text: string, docs: string[][]) => {
  const tokens = tokenize(text);
  const t = tf(tokens);
  const out = new Map<string, number>();
  t.forEach((v, term) => out.set(term, v * idf(term, docs)));
  return out;
};

const cosine = (a: Map<string, number>, b: Map<string, number>) => {
  let dot = 0;
  a.forEach((v, k) => {
    const bv = b.get(k);
    if (bv) dot += v * bv;
  });
  let na = 0,
    nb = 0;
  a.forEach((v) => (na += v * v));
  b.forEach((v) => (nb += v * v));
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

function normalizeSeverity(severity?: string): Severity | undefined {
  if (!severity) return undefined;
  const value = severity.toLowerCase();
  return value === "critical" || value === "high" || value === "medium" || value === "low"
    ? (value as Severity)
    : undefined;
}

export function upsertMemory(incident: Incident, incidents: Incident[]): Incident[] {
  const existingIndex = incidents.findIndex((item) => item.incident_id === incident.incident_id);
  if (existingIndex >= 0) {
    incidents[existingIndex] = incident;
  } else {
    incidents.push(incident);
  }
  return incidents;
}

export function matchMemory(
  query: string,
  incidents: Incident[],
  k = 3,
  options?: { serviceFilter?: string; severityFilter?: Severity },
): MemoryMatch[] {
  const filtered = incidents.filter((incident) => {
    if (options?.serviceFilter && incident.service && incident.service !== options.serviceFilter) {
      return false;
    }
    if (options?.severityFilter && incident.severity) {
      return incident.severity === options.severityFilter;
    }
    return true;
  });

  if (filtered.length === 0) {
    return [];
  }

  const docs = filtered.map((i) => tokenize(`${i.symptom}. ${i.root_cause}. ${i.mitigation}`));
  const queryVec = tfidf(query, docs);

  return filtered
    .map((incident, idx) => {
      const docVec = tfidf(docs[idx].join(" "), docs);
      return { incident, similarity: cosine(queryVec, docVec) };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}
