/**
 * backend/playbook-registry.ts
 * Deterministic playbook registry.
 * Mirrors config/playbooks.yaml and backend/playbooks/registry.py from the blueprint.
 */

export interface Playbook {
  name: string;
  description: string;
  applicableSeverities: string[];
  applicableServices: string[];   // ["*"] = all services
  requiresHumanApproval: boolean;
  destructive: boolean;
  dryRunSafe: boolean;
}

export const PLAYBOOKS: Playbook[] = [
  {
    name: "service_restart",
    description: "Gracefully restart a single service replica",
    applicableSeverities: ["P0_CRITICAL", "P1_HIGH", "P2_MEDIUM"],
    applicableServices: ["*"],
    requiresHumanApproval: true,
    destructive: true,
    dryRunSafe: true,
  },
  {
    name: "db_connection_pool_reset",
    description: "Drain and reset the database connection pool",
    applicableSeverities: ["P0_CRITICAL", "P1_HIGH"],
    applicableServices: ["payment-gateway", "order-service", "user-service", "api-backend"],
    requiresHumanApproval: true,
    destructive: false,
    dryRunSafe: true,
  },
  {
    name: "cache_flush_targeted",
    description: "Flush specific cache keys matching a pattern",
    applicableSeverities: ["P1_HIGH", "P2_MEDIUM", "P3_LOW"],
    applicableServices: ["*"],
    requiresHumanApproval: false,
    destructive: false,
    dryRunSafe: true,
  },
  {
    name: "circuit_breaker_open",
    description: "Open circuit breaker to stop traffic to a failing downstream",
    applicableSeverities: ["P0_CRITICAL", "P1_HIGH"],
    applicableServices: ["*"],
    requiresHumanApproval: true,
    destructive: true,
    dryRunSafe: false,
  },
  {
    name: "heap_dump_capture",
    description: "Capture JVM heap dump for OOM forensic analysis",
    applicableSeverities: ["P0_CRITICAL", "P1_HIGH", "P2_MEDIUM"],
    applicableServices: ["*"],
    requiresHumanApproval: false,
    destructive: false,
    dryRunSafe: true,
  },
  {
    name: "index_rebuild",
    description: "Rebuild missing or corrupt database index concurrently",
    applicableSeverities: ["P1_HIGH", "P2_MEDIUM"],
    applicableServices: ["api-backend", "reporting", "user-service"],
    requiresHumanApproval: true,
    destructive: false,
    dryRunSafe: true,
  },
  {
    name: "canary_rollback",
    description: "Roll back canary deployment to last stable version",
    applicableSeverities: ["P0_CRITICAL", "P1_HIGH"],
    applicableServices: ["*"],
    requiresHumanApproval: true,
    destructive: false,
    dryRunSafe: true,
  },
  {
    name: "jwks_cache_flush",
    description: "Force-flush JWKS cache at edge and shorten TTL",
    applicableSeverities: ["P0_CRITICAL", "P1_HIGH", "P2_MEDIUM"],
    applicableServices: ["auth", "edge-gateway"],
    requiresHumanApproval: false,
    destructive: false,
    dryRunSafe: true,
  },
];

/** Blueprint severity enum → numeric priority (lower = more urgent) */
const SEVERITY_ORDER: Record<string, number> = {
  P0_CRITICAL: 0,
  P1_HIGH: 1,
  P2_MEDIUM: 2,
  P3_LOW: 3,
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function listApplicablePlaybooks(severity: string, service: string): Playbook[] {
  const normalised = severity.toUpperCase().replace("-", "_");
  return PLAYBOOKS.filter((p) => {
    const sevMatch =
      p.applicableSeverities.includes(normalised) ||
      p.applicableSeverities.includes(severity);
    const svcMatch =
      p.applicableServices.includes("*") ||
      p.applicableServices.includes(service);
    return sevMatch && svcMatch;
  });
}

/** Keyword-based heuristic selection used as mitigation-agent fallback */
export function selectPlaybookByKeywords(
  keywords: string[],
  severity: string,
  service: string,
): Playbook | null {
  const applicable = listApplicablePlaybooks(severity, service);
  if (applicable.length === 0) return null;

  const kw = keywords.map((k) => k.toLowerCase()).join(" ");

  if (/oom|heap|memory|outofmemory/.test(kw)) {
    return applicable.find((p) => p.name === "heap_dump_capture") ?? applicable[0];
  }
  if (/connection.*pool|pool.*exhaust|too many connections/.test(kw)) {
    return applicable.find((p) => p.name === "db_connection_pool_reset") ?? applicable[0];
  }
  if (/index|slow.*query|full.*scan|table.*scan/.test(kw)) {
    return applicable.find((p) => p.name === "index_rebuild") ?? applicable[0];
  }
  if (/circuit.*breaker|circuit.*trip|cascad/.test(kw)) {
    return applicable.find((p) => p.name === "circuit_breaker_open") ?? applicable[0];
  }
  if (/cache|stale/.test(kw)) {
    return applicable.find((p) => p.name === "cache_flush_targeted") ?? applicable[0];
  }
  if (/jwks|jwt|token.*invalid|auth.*fail/.test(kw)) {
    return applicable.find((p) => p.name === "jwks_cache_flush") ?? applicable[0];
  }
  if (/canary|rollback|deploy|5xx/.test(kw)) {
    return applicable.find((p) => p.name === "canary_rollback") ?? applicable[0];
  }
  if (/crash|restart|crashloop|pod.*fail/.test(kw)) {
    return applicable.find((p) => p.name === "service_restart") ?? applicable[0];
  }

  return applicable[0];
}

export const DESTRUCTIVE_PLAYBOOKS = new Set([
  "service_restart",
  "database_failover",
  "cache_flush_all",
  "circuit_breaker_open",
  "traffic_cutover",
]);
