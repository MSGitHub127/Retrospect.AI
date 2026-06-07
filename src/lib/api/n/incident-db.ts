/**
 * backend/incident-db.ts
 *
 * Module-level in-process persistence layer.
 * Mirrors the Postgres schema from the blueprint (incidents, log_chunks,
 * postmortems, hitl_feedback, playbook_executions).
 *
 * Replace the Map stores with real DB calls (e.g. postgres.js, Drizzle, Prisma)
 * when a DATABASE_URL is available — the function signatures stay the same.
 */

import type { Severity } from "../types";

// ── Enums / union types ───────────────────────────────────────────────────────

export type IncidentStatus =
  | "OPEN"
  | "TRIAGING"
  | "MITIGATING"
  | "RESOLVED"
  | "POST_MORTEM";

export type AgentStep =
  | "TRIAGE"
  | "MITIGATION"
  | "RCA"
  | "HITL_REVIEW"
  | "CLOSED";

export type HITLDecision = "APPROVE" | "REJECT" | "MODIFY";

// ── Record shapes ─────────────────────────────────────────────────────────────

export interface IncidentRecord {
  id: string;
  externalId?: string;
  serviceId?: string;
  severity: string;      // P0_CRITICAL … P3_LOW (blueprint enum)
  status: IncidentStatus;
  title: string;
  rawLogHash?: string;
  sanitizedLogRef?: string;
  agentStep: AgentStep;
  similarityScore?: number;
  matchedIncidentId?: string;
  rcaLink?: string;
  openedAt: string;      // ISO-8601
  resolvedAt?: string;
  triageCompletedAt?: string;
  mitigationStartedAt?: string;
  metadata: Record<string, unknown>;
}

export interface LogChunkRecord {
  id: string;
  incidentId: string;
  chunkIndex: number;
  chunkText: string;
  tokenCount?: number;
  chromaId?: string;
  createdAt: string;
}

export interface PostMortemRecord {
  id: string;
  incidentId: string;
  markdownContent: string;
  structuredData: Record<string, unknown>;
  version: number;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HITLFeedbackRecord {
  id: string;
  incidentId: string;
  agentStep: AgentStep;
  engineerId: string;
  decision: HITLDecision;
  originalOutput?: Record<string, unknown>;
  correctedOutput?: Record<string, unknown>;
  feedbackNotes?: string;
  writtenToVector: boolean;
  createdAt: string;
}

export interface PlaybookExecutionRecord {
  id: string;
  incidentId: string;
  playbookName: string;
  playbookVersion?: string;
  parameters?: Record<string, unknown>;
  executedBy: "AGENT" | "HUMAN";
  approvedByEngineer?: string;
  outcome?: "SUCCESS" | "FAILURE" | "ROLLED_BACK";
  outputLog?: string;
  executedAt: string;
}

// ── In-memory stores ──────────────────────────────────────────────────────────

const incidents   = new Map<string, IncidentRecord>();
const logChunks   = new Map<string, LogChunkRecord>();
const postmortems = new Map<string, PostMortemRecord>();
const hitlFeedback= new Map<string, HITLFeedbackRecord>();
const playbookExec= new Map<string, PlaybookExecutionRecord>();

function uuid(): string {
  return crypto.randomUUID();
}

// ── Incidents ─────────────────────────────────────────────────────────────────

export function createIncident(
  data: Omit<IncidentRecord, "id" | "openedAt" | "agentStep" | "status" | "metadata"> &
    Partial<Pick<IncidentRecord, "id" | "agentStep" | "status" | "metadata">>,
): IncidentRecord {
  const record: IncidentRecord = {
    id: data.id ?? uuid(),
    externalId: data.externalId,
    serviceId: data.serviceId,
    severity: data.severity,
    status: data.status ?? "OPEN",
    title: data.title,
    rawLogHash: data.rawLogHash,
    sanitizedLogRef: data.sanitizedLogRef,
    agentStep: data.agentStep ?? "TRIAGE",
    similarityScore: data.similarityScore,
    matchedIncidentId: data.matchedIncidentId,
    rcaLink: data.rcaLink,
    openedAt: new Date().toISOString(),
    metadata: data.metadata ?? {},
  };
  incidents.set(record.id, record);
  return record;
}

export function getIncident(id: string): IncidentRecord | undefined {
  return incidents.get(id);
}

export function updateIncident(id: string, patch: Partial<IncidentRecord>): IncidentRecord | undefined {
  const rec = incidents.get(id);
  if (!rec) return undefined;
  const updated = { ...rec, ...patch };
  incidents.set(id, updated);
  return updated;
}

export function listIncidents(filter?: { status?: IncidentStatus }): IncidentRecord[] {
  const all = [...incidents.values()];
  if (filter?.status) return all.filter((i) => i.status === filter.status);
  return all.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

// ── Log Chunks ────────────────────────────────────────────────────────────────

export function createLogChunk(data: Omit<LogChunkRecord, "id" | "createdAt">): LogChunkRecord {
  const record: LogChunkRecord = {
    id: uuid(),
    ...data,
    createdAt: new Date().toISOString(),
  };
  logChunks.set(record.id, record);
  return record;
}

export function getChunksForIncident(incidentId: string): LogChunkRecord[] {
  return [...logChunks.values()]
    .filter((c) => c.incidentId === incidentId)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);
}

// ── Post-Mortems ──────────────────────────────────────────────────────────────

export function upsertPostMortem(
  data: Omit<PostMortemRecord, "id" | "createdAt" | "updatedAt" | "version"> &
    Partial<Pick<PostMortemRecord, "id" | "version">>,
): PostMortemRecord {
  const existing = [...postmortems.values()].find((p) => p.incidentId === data.incidentId);
  const now = new Date().toISOString();
  const record: PostMortemRecord = {
    id: existing?.id ?? data.id ?? uuid(),
    incidentId: data.incidentId,
    markdownContent: data.markdownContent,
    structuredData: data.structuredData,
    version: existing ? existing.version + 1 : 1,
    approvedBy: data.approvedBy,
    approvedAt: data.approvedAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  postmortems.set(record.id, record);
  return record;
}

export function getPostMortemByIncident(incidentId: string): PostMortemRecord | undefined {
  return [...postmortems.values()].find((p) => p.incidentId === incidentId);
}

// ── HITL Feedback ─────────────────────────────────────────────────────────────

export function createHITLFeedback(
  data: Omit<HITLFeedbackRecord, "id" | "createdAt" | "writtenToVector">,
): HITLFeedbackRecord {
  const record: HITLFeedbackRecord = {
    id: uuid(),
    ...data,
    writtenToVector: false,
    createdAt: new Date().toISOString(),
  };
  hitlFeedback.set(record.id, record);
  return record;
}

export function getPendingFeedback(): HITLFeedbackRecord[] {
  return [...hitlFeedback.values()].filter((f) => !f.writtenToVector);
}

export function markFeedbackWritten(id: string): void {
  const rec = hitlFeedback.get(id);
  if (rec) hitlFeedback.set(id, { ...rec, writtenToVector: true });
}

export function listFeedbackForIncident(incidentId: string): HITLFeedbackRecord[] {
  return [...hitlFeedback.values()].filter((f) => f.incidentId === incidentId);
}

// ── Playbook Executions ───────────────────────────────────────────────────────

export function createPlaybookExecution(
  data: Omit<PlaybookExecutionRecord, "id" | "executedAt">,
): PlaybookExecutionRecord {
  const record: PlaybookExecutionRecord = {
    id: uuid(),
    ...data,
    executedAt: new Date().toISOString(),
  };
  playbookExec.set(record.id, record);
  return record;
}

export function listPlaybookExecutions(incidentId: string): PlaybookExecutionRecord[] {
  return [...playbookExec.values()].filter((e) => e.incidentId === incidentId);
}

// ── Stats helper (for SystemHealth) ──────────────────────────────────────────

export function getStats() {
  return {
    totalIncidents: incidents.size,
    openIncidents: [...incidents.values()].filter(
      (i) => i.status !== "RESOLVED" && i.status !== "POST_MORTEM",
    ).length,
    totalChunks: logChunks.size,
    totalPostMortems: postmortems.size,
    pendingHITL: getPendingFeedback().length,
  };
}
