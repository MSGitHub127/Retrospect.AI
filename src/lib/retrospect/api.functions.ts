import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  ConfidenceCell,
  Diagnosis,
  HITLFeedback,
  LiveIncident,
  MemoryMatch,
  PostMortem,
  SystemHealth,
} from "./types";
import { LIVE_INCIDENTS, PAST_INCIDENTS } from "./seed";

export const listLiveIncidents = createServerFn({ method: "GET" }).handler(
  async (): Promise<LiveIncident[]> => LIVE_INCIDENTS,
);

export const listMemory = createServerFn({ method: "GET" }).handler(async () => PAST_INCIDENTS);

export const getSystemHealth = createServerFn({ method: "GET" }).handler(async (): Promise<SystemHealth> => {
  const server = await import("./server");
  return server.getSystemHealthState();
});

export const getConfidenceMatrix = createServerFn({ method: "GET" }).handler(async (): Promise<ConfidenceCell[]> => {
  const server = await import("./server");
  return server.getConfidenceMatrixData();
});

export const diagnose = createServerFn({ method: "POST" })
  .inputValidator(z.object({ log: z.string().min(1), incident_id: z.string().optional(), service: z.string().optional(), severity: z.string().optional() }))
  .handler(async ({ data }): Promise<{ diagnosis: Diagnosis; matches: MemoryMatch[] }> => {
    const server = await import("./server");
    return server.diagnoseIncident(data);
  });

export const generatePostMortem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ incident_id: z.string().min(1), log: z.string().min(1) }))
  .handler(async ({ data }): Promise<PostMortem> => {
    const server = await import("./server");
    return server.buildPostMortem(data);
  });

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      incident_id: z.string().min(1),
      engineer_id: z.string().min(1),
      agent_step: z.enum(["TRIAGE", "MITIGATION", "RCA", "HITL_REVIEW", "CLOSED"]),
      decision: z.enum(["APPROVE", "REJECT", "MODIFY"]),
      original_output: z.record(z.unknown()).optional(),
      corrected_output: z.record(z.unknown()).optional(),
      feedback_notes: z.string().optional(),
    }),
  )
  .handler(async ({ data }): Promise<HITLFeedback> => {
    const server = await import("./server");
    return server.submitFeedback(data);
  });

export const approveDiagnosis = createServerFn({ method: "POST" })
  .inputValidator(z.object({ incident_id: z.string().min(1), engineer_id: z.string().min(1) }))
  .handler(async ({ data }): Promise<HITLFeedback> => {
    const server = await import("./server");
    return server.approveDiagnosis(data);
  });

export const rejectDiagnosis = createServerFn({ method: "POST" })
  .inputValidator(z.object({ incident_id: z.string().min(1), engineer_id: z.string().min(1), feedback_notes: z.string().min(1) }))
  .handler(async ({ data }): Promise<HITLFeedback> => {
    const server = await import("./server");
    return server.rejectDiagnosis(data);
  });

export const modifyDiagnosis = createServerFn({ method: "POST" })
  .inputValidator(z.object({ incident_id: z.string().min(1), engineer_id: z.string().min(1), corrected_output: z.record(z.unknown()), feedback_notes: z.string().optional() }))
  .handler(async ({ data }): Promise<HITLFeedback> => {
    const server = await import("./server");
    return server.modifyDiagnosis(data);
  });
