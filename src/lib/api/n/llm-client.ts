/**
 * backend/llm-client.ts
 *
 * Thin wrapper around the Anthropic Claude API.
 * In the blueprint these calls go to OpenAI GPT-4o / GPT-4o-mini.
 * We use Claude (claude-sonnet-4-20250514) which is available in this environment
 * without needing an API key from the user — the key is injected by the platform.
 *
 * Each function matches the blueprint agent prompts 1-to-1.
 */

const CLAUDE_API = "https://api.anthropic.com/v1/messages";
const MODEL      = "claude-sonnet-4-20250514";

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

interface ClaudeRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: ClaudeMessage[];
}

async function callClaude(req: ClaudeRequest): Promise<string> {
  const res = await fetch(CLAUDE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Claude API ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

// ── Triage Agent ──────────────────────────────────────────────────────────────

export interface TriageExtraction {
  keywords: string[];
  error_type: string;
  affected_component: string;
  probable_root_cause: string;
  severity_assessment: "matches" | "escalates" | "deescalates";
}

export async function extractTriageInfo(
  serviceName: string,
  severity: string,
  logText: string,
): Promise<TriageExtraction> {
  const system = `You are Retrospect.AI's Triage Agent.
Analyze infrastructure log events and extract structured diagnostic information.
Respond with VALID JSON only. No markdown, no explanation, no code fences.
Schema:
{
  "keywords": ["list", "of", "technical", "keywords"],
  "error_type": "e.g. NullPointerException | ConnectionTimeout | OOMKill",
  "affected_component": "specific service or module",
  "probable_root_cause": "brief hypothesis",
  "severity_assessment": "matches|escalates|deescalates"
}`;

  const user = `Analyze this log from ${serviceName} (Severity: ${severity}):\n\n${logText.slice(0, 4000)}`;

  const raw = await callClaude({
    model: MODEL,
    max_tokens: 600,
    system,
    messages: [{ role: "user", content: user }],
  });

  // Strip any accidental markdown fences
  const clean = raw.replace(/```(?:json)?/g, "").trim();
  return JSON.parse(clean) as TriageExtraction;
}

// ── Mitigation Agent ──────────────────────────────────────────────────────────

export interface MitigationSelection {
  playbook_name: string;
  parameters: Record<string, string>;
  rationale: string;
  confidence: number;
}

export async function selectMitigationPlaybook(
  serviceName: string,
  severity: string,
  keywords: string[],
  topSimilar: Record<string, unknown>,
  availablePlaybooks: string[],
): Promise<MitigationSelection> {
  const system = `You are Retrospect.AI's Mitigation Agent.
Select the best playbook from the registry. Respond with VALID JSON only. No markdown, no explanation.
Schema:
{
  "playbook_name": "exact name from registry",
  "parameters": {"key": "value"},
  "rationale": "one sentence explanation",
  "confidence": 0.0
}`;

  const user = `Incident: ${serviceName} | Severity: ${severity}
Keywords: ${keywords.join(", ")}
Top similar incident: ${JSON.stringify(topSimilar)}
Available playbooks: ${availablePlaybooks.join(", ")}

Select the best remediation playbook.`;

  const raw = await callClaude({
    model: MODEL,
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: user }],
  });

  const clean = raw.replace(/```(?:json)?/g, "").trim();
  return JSON.parse(clean) as MitigationSelection;
}

// ── RCA Scribe ────────────────────────────────────────────────────────────────

export interface RCAInput {
  serviceName: string;
  severity: string;
  openedAt: string;
  keywords: string[];
  similarIncidentsFormatted: string;
  playbook: string;
  rationale: string;
  humanRequired: boolean;
  logExcerpt: string;
}

export async function generateRCAMarkdown(input: RCAInput): Promise<string> {
  const system = `You are Retrospect.AI's RCA Scribe — an expert technical writer.
Generate a professional Post-Mortem in GitHub-flavored Markdown.

Required sections (in order):
1. ## Executive Summary
2. ## Incident Timeline
3. ## Root Cause Analysis
4. ## Impact Assessment
5. ## Historical Context
6. ## Mitigation Steps Taken
7. ## Action Items  (table: | Item | Owner | Due Date | Priority |)
8. ## Prevention Measures
9. ## Retrospect Memory Note

Be factual, concise, and blameless. Use [UNKNOWN] for genuinely missing data.`;

  const user = `Service: ${input.serviceName} | Severity: ${input.severity} | Opened: ${input.openedAt}

Triage Keywords: ${input.keywords.join(", ")}
Historical Matches:
${input.similarIncidentsFormatted}
Playbook: ${input.playbook} — ${input.rationale}
Human Approval Required: ${input.humanRequired}

Log Excerpt (sanitized):
${input.logExcerpt.slice(0, 1500)}`;

  return callClaude({
    model: MODEL,
    max_tokens: 3000,
    system,
    messages: [{ role: "user", content: user }],
  });
}

// ── Post-Mortem (structured, from blueprint's generatePostMortem endpoint) ────

export interface StructuredPostMortemInput {
  incidentId: string;
  serviceName: string;
  severity: string;
  log: string;
  diagnosis: {
    likelyRootCause: string;
    patternMatch: string;
    confidencePct: number;
    playbook?: string;
  };
  matches: Array<{ incidentId: string; similarity: number; symptom: string; mitigation: string }>;
}

export interface StructuredPostMortem {
  incident_id: string;
  title: string;
  generated_at: string;
  summary: string;
  timeline: { t: string; event: string }[];
  contributing_factors: string[];
  action_items: { owner: string; item: string; due: string }[];
  lessons: string[];
  rca_markdown: string;
}

export async function generateStructuredPostMortem(
  input: StructuredPostMortemInput,
): Promise<StructuredPostMortem> {
  const system = `You are Retrospect.AI's Post-Mortem generator.
Return a VALID JSON object only. No markdown fences, no explanation.
Schema:
{
  "summary": "2-3 sentence executive summary",
  "timeline": [{"t":"T+HH:MM","event":"description"}],
  "contributing_factors": ["factor 1", "factor 2"],
  "action_items": [{"owner":"team","item":"task","due":"deadline"}],
  "lessons": ["lesson 1"]
}`;

  const topMatch = input.matches[0];
  const user = `Incident: ${input.incidentId} | Service: ${input.serviceName} | Severity: ${input.severity}
Root cause: ${input.diagnosis.likelyRootCause}
Pattern match: ${input.diagnosis.patternMatch}
Confidence: ${input.diagnosis.confidencePct}%
Recommended playbook: ${input.diagnosis.playbook ?? "none"}
Top historical match: ${topMatch ? `${topMatch.incidentId} (sim ${(topMatch.similarity * 100).toFixed(0)}%) — ${topMatch.symptom}` : "none"}

Log excerpt:
${input.log.slice(0, 800)}

Generate a blameless post-mortem.`;

  const raw = await callClaude({
    model: MODEL,
    max_tokens: 1200,
    system,
    messages: [{ role: "user", content: user }],
  });

  const clean = raw.replace(/```(?:json)?/g, "").trim();
  const parsed = JSON.parse(clean) as {
    summary: string;
    timeline: { t: string; event: string }[];
    contributing_factors: string[];
    action_items: { owner: string; item: string; due: string }[];
    lessons: string[];
  };

  // Also generate full RCA markdown for the postmortem record
  const rcaMarkdown = await generateRCAMarkdown({
    serviceName: input.serviceName,
    severity: input.severity,
    openedAt: new Date().toISOString(),
    keywords: [],
    similarIncidentsFormatted: topMatch
      ? `1. ${topMatch.incidentId} (similarity ${(topMatch.similarity * 100).toFixed(1)}%)\n   ${topMatch.symptom}`
      : "No matches",
    playbook: input.diagnosis.playbook ?? "none",
    rationale: input.diagnosis.likelyRootCause,
    humanRequired: false,
    logExcerpt: input.log,
  }).catch(() => "<!-- RCA generation failed -->"); // non-fatal

  return {
    incident_id: input.incidentId,
    title: `Post-mortem: ${input.incidentId}`,
    generated_at: new Date().toISOString(),
    ...parsed,
    rca_markdown: rcaMarkdown,
  };
}
