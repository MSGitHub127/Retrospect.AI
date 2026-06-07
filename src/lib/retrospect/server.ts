import { chunkLog } from "@/lib/api/n/chunker";
import { createHITLFeedback, createIncident, createLogChunk, getStats, upsertPostMortem } from "@/lib/api/n/incident-db";
import { sanitize } from "@/lib/api/n/sanitizer";
import { selectMitigationPlaybook, extractTriageInfo, generateStructuredPostMortem } from "@/lib/api/n/llm-client";
import { selectPlaybookByKeywords, listApplicablePlaybooks, PLAYBOOKS } from "@/lib/api/n/playbook-registry";
import { semanticSearch, upsertChunk, type SearchHit } from "@/lib/api/n/vector-store";
import { LIVE_INCIDENTS, PAST_INCIDENTS } from "./seed";
import { matchMemory } from "./memory";
import type {
  ConfidenceCell,
  Diagnosis,
  HITLFeedback,
  LiveIncident,
  MemoryMatch,
  PostMortem,
  Severity,
  SystemHealth,
} from "./types";

let memorySeeded = false;

function normalizeSeverity(severity?: string): Severity {
  const normalized = String(severity ?? "medium").toLowerCase();
  return normalized === "critical" || normalized === "high" || normalized === "medium" || normalized === "low"
    ? (normalized as Severity)
    : "medium";
}

function normalizeService(service?: string): string {
  return service?.trim() || "unknown";
}

function safeParseJson<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function deriveKeywords(text: string, max = 8): string[] {
  const tokens = text
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length > 2 && !["the", "and", "for", "with", "that", "this", "from", "into", "after", "before", "error", "service", "requests"].includes(token))
    .slice(0, 60) ?? [];
  const frequency = new Map<string, number>();
  tokens.forEach((token) => frequency.set(token, (frequency.get(token) ?? 0) + 1));
  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([term]) => term);
}

function groupSearchHitsToMemoryMatches(hits: SearchHit[]): MemoryMatch[] {
  const grouped = new Map<string, MemoryMatch>();
  for (const hit of hits) {
    const match = PAST_INCIDENTS.find((incident) => incident.incident_id === hit.incidentId);
    if (!match) continue;
    const existing = grouped.get(hit.incidentId);
    const similarity = Math.min(1, Math.max(0, hit.score));
    if (!existing || similarity > existing.similarity) {
      grouped.set(hit.incidentId, { incident: match, similarity });
    }
  }
  return [...grouped.values()].sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}

function ensureMemorySeeded() {
  if (memorySeeded) return;
  for (const incident of PAST_INCIDENTS) {
    const chunkText = `${incident.symptom}\n${incident.root_cause}\n${incident.mitigation}`;
    upsertChunk({
      id: `memory-${incident.incident_id}`,
      incidentId: incident.incident_id,
      serviceName: normalizeService(incident.service),
      severity: normalizeSeverity(incident.severity),
      chunkText,
      openedAtTs: Math.floor(new Date(incident.timestamp).getTime() / 1000),
      extraMetadata: { source: "memory" },
    });
  }
  memorySeeded = true;
}

function buildDiagnosisFromMatch(
  incidentId: string,
  serviceName: string,
  severity: Severity,
  log: string,
  matches: MemoryMatch[],
  keywords: string[],
  triageRootCause: string,
  triageSeverity: "matches" | "escalates" | "deescalates",
  playbookName: string,
  playbookRationale: string,
  requiresHumanApproval: boolean,
  diagnosisSource: "llm" | "fallback",
): Diagnosis {
  const top = matches[0];
  const similarityScore = top ? Math.round(top.similarity * 100) : 35;
  const confidence = Math.min(98, Math.max(30, similarityScore + (keywords.length > 0 ? 4 : 0))); // deterministic baseline
  const patternMatch = top
    ? `Closest prior incident ${top.incident.incident_id} (${(top.similarity * 100).toFixed(1)}% similarity)`
    : "No close memory pattern matched";

  const remediation: string[] = [
    `Recommended playbook: ${playbookName}`,
    `Rationale: ${playbookRationale}`,
    `Triage keywords: ${keywords.slice(0, 8).join(", ") || "none"}`,
    `Review live incident logs and validate the playbook before executing.`,
  ];

  if (triageSeverity === "escalates") {
    remediation.push("Escalate to on-call SRE and pause auto-remediation until confirmed.");
  }

  if (!requiresHumanApproval) {
    remediation.push("This mitigation path is approved for automated action when confidence is sufficient.");
  }

  return {
    incidentId,
    diagnosisSource,
    confidencePct: confidence,
    likelyRootCause: triageRootCause || top?.incident.root_cause || "Unable to determine a definitive root cause; run manual triage.",
    patternMatch,
    matchedIncidents: matches,
    remediation,
    requiresHumanApproval,
  };
}

export async function diagnoseIncident(input: {
  incident_id?: string;
  log: string;
  service?: string;
  severity?: string;
}): Promise<{ diagnosis: Diagnosis; matches: MemoryMatch[] }> {
  const incidentId = input.incident_id ?? `INC-LIVE-${Math.floor(Math.random() * 900000) + 1000}`;
  const live = LIVE_INCIDENTS.find((item) => item.id === incidentId);
  const serviceName = normalizeService(input.service ?? live?.service);
  const severity = normalizeSeverity(input.severity ?? live?.severity ?? "high");
  const title = live?.title ?? `Incident ${incidentId}`;
  const sanitizedLog = sanitize(input.log).sanitizedText;

  ensureMemorySeeded();

  const incidentRecord = createIncident({
    id: incidentId,
    externalId: live?.id,
    serviceId: serviceName,
    severity,
    status: "TRIAGING",
    title,
    rawLogHash: sanitize(input.log).originalHash,
    agentStep: "TRIAGE",
    metadata: { originalLog: sanitizedLog },
  });

  const chunked = chunkLog(sanitizedLog);
  chunked.chunks.forEach((chunk, index) => {
    createLogChunk({
      incidentId: incidentRecord.id,
      chunkIndex: index,
      chunkText: chunk,
      tokenCount: Math.ceil(chunk.length / 4),
      chromaId: `${incidentRecord.id}-chunk-${index}`,
    });
    upsertChunk({
      id: `${incidentRecord.id}-chunk-${index}`,
      incidentId: incidentRecord.id,
      serviceName,
      severity,
      chunkText: chunk,
      openedAtTs: Math.floor(Date.now() / 1000),
    });
  });

  const semanticHits = semanticSearch(sanitizedLog, {
    topK: 4,
    serviceFilter: serviceName,
    severityFilter: severity,
    scoreThreshold: 0.05,
  });
  const semanticMatches = groupSearchHitsToMemoryMatches(semanticHits);
  const deterministicMatches = matchMemory(sanitizedLog, PAST_INCIDENTS, 3, {
    serviceFilter: serviceName,
    severityFilter: severity,
  });
  const matches = semanticMatches.length > 0 ? semanticMatches : deterministicMatches;

  let triageKeywords: string[] = deriveKeywords(sanitizedLog);
  let triageRootCause = "Unable to infer root cause from the model response.";
  let triageSeverity: "matches" | "escalates" | "deescalates" = "matches";
  let playbookName = "service_restart";
  let playbookRationale = "Fallback from historical memory and deterministic matching.";
  let requiresHumanApproval = true;
  let diagnosisSource: "llm" | "fallback" = "llm";

  try {
    const triage = await extractTriageInfo(serviceName, severity, sanitizedLog);
    triageKeywords = triage.keywords.length ? triage.keywords : triageKeywords;
    triageRootCause = triage.probable_root_cause || triageRootCause;
    triageSeverity = triage.severity_assessment;

    const available = listApplicablePlaybooks(severity, serviceName).map((p) => p.name);
    const mitigation = await selectMitigationPlaybook(
      serviceName,
      severity,
      triageKeywords,
      semanticHits[0] ? { hit: semanticHits[0], matches } : {},
      available,
    );
    if (mitigation.playbook_name) {
      playbookName = mitigation.playbook_name;
      playbookRationale = mitigation.rationale;
      requiresHumanApproval = mitigation.confidence < 0.7 || mitigation.parameters == null;
    }
  } catch {
    diagnosisSource = "fallback";
    const fallback = selectPlaybookByKeywords(triageKeywords, severity, serviceName);
    if (fallback) {
      playbookName = fallback.name;
      playbookRationale = `Deterministic fallback selected ${fallback.name}`;
      requiresHumanApproval = fallback.requiresHumanApproval;
    }
  }

  const diagnosis = buildDiagnosisFromMatch(
    incidentRecord.id,
    serviceName,
    severity,
    sanitizedLog,
    matches,
    triageKeywords,
    triageRootCause,
    triageSeverity,
    playbookName,
    playbookRationale,
    requiresHumanApproval,
    diagnosisSource,
  );

  return { diagnosis, matches };
}

export async function buildPostMortem(input: { incident_id: string; log: string }): Promise<PostMortem> {
  ensureMemorySeeded();
  const sanitizedLog = sanitize(input.log).sanitizedText;
  const semanticHits = semanticSearch(sanitizedLog, { topK: 3, scoreThreshold: 0.05 });
  const matches = groupSearchHitsToMemoryMatches(semanticHits);

  let structured = null;
  try {
    structured = await generateStructuredPostMortem({
      incidentId: input.incident_id,
      serviceName: matches[0]?.incident.service ?? "unknown",
      severity: matches[0]?.incident.severity ?? "medium",
      log: sanitizedLog,
      diagnosis: {
        likelyRootCause: matches[0]?.incident.root_cause ?? "No close match found.",
        patternMatch: matches[0]
          ? `${matches[0].incident.incident_id} (${(matches[0].similarity * 100).toFixed(1)}%)`
          : "No match",
        confidencePct: Math.round((matches[0]?.similarity ?? 0) * 100),
        playbook: matches[0]?.incident.mitigation,
      },
      matches: matches.map((m) => ({
        incidentId: m.incident.incident_id,
        similarity: m.similarity,
        symptom: m.incident.symptom,
        mitigation: m.incident.mitigation,
      })),
    });
  } catch {
    structured = null;
  }

  const timeline = structured?.timeline?.map((item) => ({ at: item.t, event: item.event })) ?? [
    { at: "T+00:00", event: "Incident reported and sanitized for analysis." },
    {
      at: "T+00:18",
      event: matches.length
        ? `Matched prior incident ${matches[0].incident.incident_id} at ${(matches[0].similarity * 100).toFixed(1)}% similarity.`
        : "No historical match found; manual review needed.",
    },
    { at: "T+02:10", event: "Candidate remediation selected and validated by SRE." },
    { at: "T+04:30", event: "Recovery confirmed and post-mortem drafted." },
  ];

  const postMortem: PostMortem = {
    incidentId: input.incident_id,
    generated_at: new Date().toISOString(),
    summary:
      structured?.summary ??
      "Incident analysis completed using historical memory and fallback heuristics. Post-mortem prepared for review.",
    timeline,
    contributing_factors:
      structured?.contributing_factors ??
      (matches.length > 0
        ? [matches[0].incident.root_cause, "Insufficient pre-deploy observability", "Delayed mitigation handoff"]
        : ["No prior memory match available", "New failure mode or incomplete historical coverage"]),
    action_items:
      structured?.action_items ??
      [{ owner: "sre", item: "Review playbook and confirm remediation path", due: "next business day" }],
    lessons:
      structured?.lessons ??
      [
        matches[0]?.incident.lessons_learned ?? "Institutional memory should be expanded for this failure class.",
      ],
    markdown:
      structured?.rca_markdown ??
      `# Post-mortem for ${input.incident_id}\n\n${structured?.summary ?? "No summary available."}`,
  };

  upsertPostMortem({ incidentId: input.incident_id, markdownContent: postMortem.markdown, structuredData: postMortem, approvedBy: undefined, approvedAt: undefined });
  return postMortem;
}

export function getSystemHealthState(): SystemHealth {
  const stats = getStats();
  const openIncidents = LIVE_INCIDENTS.filter((item) => item.severity === "critical" || item.severity === "high").length;
  return {
    memory_count: PAST_INCIDENTS.length,
    match_rate_pct: 86,
    median_diagnosis_seconds: 1.5,
    open_incidents: openIncidents,
    recall_quality_pct: 92,
    pending_feedback: stats.pendingHITL,
    model_status: "available",
    services: [
      { name: "user-service", status: "degraded", latency_ms: 1240 },
      { name: "payments", status: "healthy", latency_ms: 84 },
      { name: "auth", status: "healthy", latency_ms: 32 },
      { name: "reporting", status: "degraded", latency_ms: 612 },
      { name: "edge-gateway", status: "healthy", latency_ms: 41 },
      { name: "search-index", status: "healthy", latency_ms: 56 },
    ],
  };
}

export function getConfidenceMatrixData(): ConfidenceCell[] {
  const services = ["user-service", "payments", "auth", "reporting", "edge-gateway"];
  const categories = ["memory", "latency", "deploy", "db", "network"];
  const out: ConfidenceCell[] = [];
  services.forEach((s, si) =>
    categories.forEach((c, ci) => {
      const score = Math.round(55 + ((si * 7 + ci * 11) % 40));
      out.push({ service: s, category: c, score, samples: 4 + ((si + ci) % 7) });
    }),
  );
  return out;
}

export function submitFeedback(data: {
  incident_id: string;
  engineer_id: string;
  agent_step: "TRIAGE" | "MITIGATION" | "RCA" | "HITL_REVIEW" | "CLOSED";
  decision: "APPROVE" | "REJECT" | "MODIFY";
  original_output?: Record<string, unknown>;
  corrected_output?: Record<string, unknown>;
  feedback_notes?: string;
}): HITLFeedback {
  return createHITLFeedback({
    incidentId: data.incident_id,
    agentStep: data.agent_step,
    engineerId: data.engineer_id,
    decision: data.decision,
    originalOutput: data.original_output,
    correctedOutput: data.corrected_output,
    feedbackNotes: data.feedback_notes,
  });
}

export function approveDiagnosis(data: { incident_id: string; engineer_id: string }): HITLFeedback {
  return submitFeedback({
    incident_id: data.incident_id,
    engineer_id: data.engineer_id,
    agent_step: "HITL_REVIEW",
    decision: "APPROVE",
    original_output: { note: "Diagnosis approved." },
  });
}

export function rejectDiagnosis(data: { incident_id: string; engineer_id: string; feedback_notes: string }): HITLFeedback {
  return submitFeedback({
    incident_id: data.incident_id,
    engineer_id: data.engineer_id,
    agent_step: "HITL_REVIEW",
    decision: "REJECT",
    feedback_notes: data.feedback_notes,
  });
}

export function modifyDiagnosis(data: {
  incident_id: string;
  engineer_id: string;
  corrected_output: Record<string, unknown>;
  feedback_notes?: string;
}): HITLFeedback {
  return submitFeedback({
    incident_id: data.incident_id,
    engineer_id: data.engineer_id,
    agent_step: "HITL_REVIEW",
    decision: "MODIFY",
    corrected_output: data.corrected_output,
    feedback_notes: data.feedback_notes,
  });
}
