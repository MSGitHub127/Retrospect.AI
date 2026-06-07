import type { Incident, LiveIncident } from "./types";

export const PAST_INCIDENTS: Incident[] = [
  {
    incident_id: "INC-001",
    timestamp: "2026-05-24T02:14:00Z",
    symptom: "User portal OutOfMemory crash – heap exhausted on production pod",
    root_cause:
      "Memory leak in Microservice A due to unbounded in-memory cache that never evicted entries",
    mitigation:
      "Deployed hotfix v1.2.3 to Microservice A with LRU cache eviction policy, restarted pod",
    confidence: 0.85,
    lessons_learned:
      "Enable memory auto-scaling; add LRU cache eviction; set JVM heap alerts at 80%",
    resolved_in_minutes: 45,
    region: "us-east-1",
    service: "user-portal",
    severity: "critical",
    error_code: "OOM-HEAP-001",
  },
  {
    incident_id: "INC-002",
    timestamp: "2026-05-31T14:07:00Z",
    symptom: "API backend slow – data store connection timeouts on users table queries",
    root_cause:
      "Missing database index on users.last_active column causing full-table scans after schema migration",
    mitigation:
      "Added composite index on users(last_active, user_id); ran ANALYZE; restarted DB connection pool",
    confidence: 0.92,
    lessons_learned:
      "Run migration diff checks pre-deploy; add slow-query alerts; keep index checklist in deploy runbook",
    resolved_in_minutes: 30,
    region: "eu-west-2",
    service: "api-backend",
    severity: "high",
    error_code: "DB-TIMEOUT-014",
  },
  {
    incident_id: "INC-003",
    timestamp: "2026-06-02T09:42:00Z",
    symptom: "Payment service 5xx spike after canary deploy v3.2.1",
    root_cause:
      "Misconfigured circuit breaker timeout (50ms) below downstream p99 latency causing cascading failures",
    mitigation:
      "Rolled back canary; raised circuit breaker timeout to 800ms; added p99 latency dashboards",
    confidence: 0.88,
    lessons_learned:
      "Calibrate circuit breakers from p99 telemetry; canary auto-rollback on 5xx >1%",
    resolved_in_minutes: 22,
    region: "us-west-2",
    service: "payments",
    severity: "high",
    error_code: "CB-TRIP-503",
  },
  {
    incident_id: "INC-004",
    timestamp: "2026-06-05T18:11:00Z",
    symptom: "Auth tokens rejected intermittently across all regions after JWKS rotation",
    root_cause:
      "Token cache TTL (24h) exceeded JWKS rotation interval; stale keys served from edge",
    mitigation:
      "Forced JWKS cache flush at edge; shortened TTL to 1h; added rotation webhook",
    confidence: 0.94,
    lessons_learned: "Cache TTL must be < rotation interval; alert on validation error rate >0.2%",
    resolved_in_minutes: 18,
    region: "global",
    service: "auth",
    severity: "critical",
    error_code: "JWT-INVALID-401",
  },
];

export const LIVE_INCIDENTS: LiveIncident[] = [
  {
    id: "INC-LIVE-001",
    timestamp: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    severity: "critical",
    service: "user-service",
    region: "us-east-1",
    error_code: "TXN-TIMEOUT-503",
    title: "Transaction timeout in user-service after deploy v2.1.0",
    log: "CRITICAL: transaction timeout in user-service after deploy v2.1.0. Sporadic 503 errors on /api/users endpoint. DB query latency spiked to 12s. Microservice B pod memory usage climbing steadily – currently at 78% heap.",
    stack_trace: [
      "java.util.concurrent.TimeoutException: transaction exceeded 10000ms",
      "  at com.retrospect.user.TxnManager.commit(TxnManager.java:142)",
      "  at com.retrospect.user.UserController.update(UserController.java:88)",
      "  at jdk.internal.reflect.GeneratedMethodAccessor3.invoke(Unknown Source)",
      "  at org.springframework.web.servlet.DispatcherServlet.doDispatch(DispatcherServlet.java:1067)",
      "Caused by: org.postgresql.util.PSQLException: connection pool exhausted (max=20, in-use=20)",
    ],
    active: true,
  },
  {
    id: "INC-LIVE-002",
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    severity: "high",
    service: "reporting",
    region: "eu-west-2",
    error_code: "DB-SLOW-QRY",
    title: "Database queries timing out on reporting service",
    log: "Database queries timing out on the reporting service; slow SELECT on large analytics_events table; p99 latency 8.4s.",
    stack_trace: [
      "psycopg2.errors.QueryCanceled: canceling statement due to statement timeout",
      "  File 'reports/aggregator.py', line 214, in run_daily",
      "  cur.execute(SLOW_AGGREGATE_SQL)",
    ],
    active: false,
  },
  {
    id: "INC-LIVE-003",
    timestamp: new Date(Date.now() - 1000 * 60 * 41).toISOString(),
    severity: "medium",
    service: "payment-service",
    region: "us-west-2",
    error_code: "OOM-PAY-027",
    title: "OutOfMemory exception in payment-service",
    log: "OutOfMemory exception thrown in payment-service; heap dump shows large cache objects holding transaction blobs.",
    stack_trace: [
      "java.lang.OutOfMemoryError: Java heap space",
      "  at com.retrospect.payments.TxCache.put(TxCache.java:54)",
    ],
    active: false,
  },
  {
    id: "INC-LIVE-004",
    timestamp: new Date(Date.now() - 1000 * 60 * 72).toISOString(),
    severity: "low",
    service: "edge-gateway",
    region: "ap-south-1",
    error_code: "GW-503",
    title: "API gateway returning intermittent 503",
    log: "API gateway returning 503; upstream service unresponsive; connection pool exhausted.",
    stack_trace: ["upstream connect error or disconnect/reset before headers. reset reason: connection failure"],
    active: false,
  },
];
