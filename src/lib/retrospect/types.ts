export type Severity = "critical" | "high" | "medium" | "low";

export interface Incident {
  incident_id: string;
  timestamp: string;
  symptom: string;
  root_cause: string;
  mitigation: string;
  confidence: number;
  lessons_learned: string;
  resolved_in_minutes: number;
  region?: string;
  service?: string;
  severity?: Severity;
  error_code?: string;
}

export interface LiveIncident {
  id: string;
  timestamp: string;
  severity: Severity;
  service: string;
  region: string;
  error_code: string;
  title: string;
  log: string;
  stack_trace: string[];
  active: boolean;
}

export interface MemoryMatch {
  incident: Incident;
  similarity: number;
}

export interface Diagnosis {
  incidentId: string;
  diagnosisSource: "llm" | "fallback";
  confidencePct: number;
  likelyRootCause: string;
  patternMatch: string;
  matchedIncidents: MemoryMatch[];
  remediation: string[];
  requiresHumanApproval: boolean;
  playbookName?: string;
  playbookRationale?: string;
}

export interface PostMortem {
  incidentId: string;
  generated_at: string;
  summary: string;
  timeline: { at: string; event: string }[];
  contributing_factors: string[];
  action_items: { owner: string; item: string; due: string }[];
  lessons: string[];
  markdown: string;
}

export interface SystemHealth {
  memory_count: number;
  match_rate_pct: number;
  median_diagnosis_seconds: number;
  open_incidents: number;
  recall_quality_pct: number;
  pending_feedback: number;
  model_status: "available" | "unavailable";
  services: { name: string; status: "healthy" | "degraded" | "down"; latency_ms: number }[];
}

export interface HITLFeedback {
  id: string;
  incidentId: string;
  agentStep: "TRIAGE" | "MITIGATION" | "RCA" | "HITL_REVIEW" | "CLOSED";
  engineerId: string;
  decision: "APPROVE" | "REJECT" | "MODIFY";
  originalOutput?: Record<string, unknown>;
  correctedOutput?: Record<string, unknown>;
  feedbackNotes?: string;
  writtenToVector: boolean;
  createdAt: string;
}

export interface ConfidenceCell {
  service: string;
  category: string;
  score: number;
  samples: number;
}
