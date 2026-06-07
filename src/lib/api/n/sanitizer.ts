/**
 * backend/sanitizer.ts
 * Production-grade PII and secrets sanitizer.
 * Runs BEFORE any log data touches the embedding model or LLM.
 * Direct port of backend/ingestion/sanitizer.py from the blueprint.
 */

export interface SanitizationReport {
  originalHash: string;
  redactionCount: number;
  redactionTypes: string[];
  sanitizedText: string;
}

interface RedactionRule {
  pattern: RegExp;
  replacement: string;
  label: string;
}

const RULES: RedactionRule[] = [
  {
    pattern: /AKIA[0-9A-Z]{16}/g,
    replacement: "[REDACTED:AWS_ACCESS_KEY]",
    label: "AWS Access Key",
  },
  {
    pattern: /(?:aws.{0,20}secret.{0,5}["']?\s*[:=]\s*["']?)([A-Za-z0-9+/]{40})/gi,
    replacement: "[REDACTED:AWS_SECRET]",
    label: "AWS Secret Key",
  },
  {
    pattern: /(?:api[_-]?key|apikey|api_token|access[_-]?token)\s*[=:]\s*["']?[\w\-]{20,}["']?/gi,
    replacement: "[REDACTED:API_KEY]",
    label: "Generic API Key",
  },
  {
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    replacement: "[REDACTED:JWT]",
    label: "JWT Token",
  },
  {
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*["']?[^\s"'&,;]{4,}["']?/gi,
    replacement: "[REDACTED:PASSWORD]",
    label: "Password",
  },
  {
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: "[REDACTED:PRIVATE_KEY]",
    label: "Private Key",
  },
  {
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    replacement: "[REDACTED:EMAIL]",
    label: "Email Address",
  },
  {
    // Public IPs only — skip RFC-1918 private ranges
    pattern:
      /\b(?!(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.)(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: "[REDACTED:PUBLIC_IP]",
    label: "Public IP Address",
  },
  {
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g,
    replacement: "[REDACTED:CREDIT_CARD]",
    label: "Credit Card Number",
  },
  {
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: "[REDACTED:PHONE]",
    label: "Phone Number",
  },
  {
    pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s"'<>]+/gi,
    replacement: "[REDACTED:DB_CONN_STRING]",
    label: "Database Connection String",
  },
  {
    pattern: /(?:secret|token|credential|auth)\s*[=:]\s*["']?[a-zA-Z0-9+/=]{32,}["']?/gi,
    replacement: "[REDACTED:SECRET]",
    label: "Generic Secret",
  },
];

/** Simple deterministic hash for dedup / audit trail (no crypto module needed in edge) */
function simpleHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (Math.imul(h, 0x01000193) >>> 0);
  }
  return h.toString(16).padStart(8, "0");
}

export function sanitize(rawText: string, extraRules: RedactionRule[] = []): SanitizationReport {
  const originalHash = simpleHash(rawText);
  const allRules = [...RULES, ...extraRules];

  let result = rawText;
  let totalCount = 0;
  const typesFound: string[] = [];

  for (const rule of allRules) {
    // Reset lastIndex for global regexes to avoid stateful bugs across calls
    rule.pattern.lastIndex = 0;
    const before = result;
    result = result.replace(rule.pattern, rule.replacement);
    const matchCount = (before.match(new RegExp(rule.pattern.source, rule.pattern.flags)) ?? []).length;
    if (matchCount > 0) {
      totalCount += matchCount;
      typesFound.push(`${rule.label}(${matchCount})`);
    }
  }

  return {
    originalHash,
    redactionCount: totalCount,
    redactionTypes: typesFound,
    sanitizedText: result,
  };
}
