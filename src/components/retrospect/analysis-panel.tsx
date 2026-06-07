import { useMemo, useState } from "react";
import { ChevronRight, PlayCircle, Sparkles, TerminalSquare } from "lucide-react";
import { SeverityChip } from "./severity-chip";
import type { Diagnosis, LiveIncident, MemoryMatch } from "@/lib/retrospect/types";
import { cn } from "@/lib/utils";

export function AnalysisPanel({
  incident,
  diagnosis,
  matches,
  loading,
  onDiagnose,
  onDeploy,
}: {
  incident: LiveIncident;
  diagnosis: Diagnosis | null;
  matches: MemoryMatch[];
  loading: boolean;
  onDiagnose: () => void;
  onDeploy: () => void;
}) {
  const [tab, setTab] = useState<"stack" | "timeline">("stack");
  const sorted = useMemo(() => matches.slice().sort((a, b) => b.similarity - a.similarity), [matches]);

  return (
    <section className="flex h-full flex-col gap-3 overflow-hidden">
      {/* Header card */}
      <div className="surface-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SeverityChip severity={incident.severity} />
              <span className="font-mono text-[10px] text-muted-foreground">
                {incident.id} · {incident.error_code}
              </span>
            </div>
            <h1 className="mt-2 truncate text-lg font-semibold tracking-tight">
              {incident.title}
            </h1>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {incident.service} · {incident.region} ·{" "}
              {new Date(incident.timestamp).toUTCString().slice(5, 25)}
            </p>
          </div>
          <button
            type="button"
            onClick={onDiagnose}
            disabled={loading}
            className="tilt-hover inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-background hover:opacity-90 disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {loading ? "Querying memory…" : "Diagnose with memory"}
          </button>
        </div>

        <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
          {incident.log}
        </div>
      </div>

      {/* Tabs: Stack / Timeline */}
      <div className="surface-card flex min-h-0 flex-1 flex-col">
        <div className="flex border-b border-border">
          <TabBtn active={tab === "stack"} onClick={() => setTab("stack")} icon={<TerminalSquare className="h-3.5 w-3.5" />}>
            Stack trace
          </TabBtn>
          <TabBtn active={tab === "timeline"} onClick={() => setTab("timeline")}>
            Memory timeline
          </TabBtn>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto p-4">
          {tab === "stack" ? (
            <pre className="font-mono text-[11px] leading-relaxed">
              {incident.stack_trace.map((line, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-8 select-none text-right text-muted-foreground/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={cn(i === 0 && "text-crimson")}>{line}</span>
                </div>
              ))}
            </pre>
          ) : (
            <ol className="relative space-y-3 border-l border-border pl-4">
              {sorted.map((m) => (
                <li key={m.incident.incident_id} className="relative">
                  <span className="absolute -left-[19px] top-1.5 h-2.5 w-2.5 rounded-full border border-border bg-cyan" />
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-medium text-cyan">
                      {m.incident.incident_id}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {m.incident.timestamp.slice(0, 10)} · sim {(m.similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px]">{m.incident.symptom}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    fix: {m.incident.mitigation}
                  </p>
                  <div className="mt-1 h-1 w-full rounded-full bg-muted">
                    <div
                      className="h-1 rounded-full bg-cyan"
                      style={{ width: `${Math.round(m.similarity * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
              {sorted.length === 0 && (
                <li className="font-mono text-[11px] text-muted-foreground">
                  Run diagnosis to see memory matches.
                </li>
              )}
            </ol>
          )}
        </div>
      </div>

      {/* Playbook */}
      <div className="surface-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Remediation playbook</h3>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {diagnosis
                ? `${diagnosis.remediation.length} actions · confidence ${diagnosis.confidencePct}%`
                : "awaiting diagnosis"}
            </p>
          </div>
          <button
            type="button"
            onClick={onDeploy}
            disabled={!diagnosis}
            className="tilt-hover inline-flex h-9 items-center gap-1.5 rounded-md border border-cyan/40 bg-cyan/10 px-3 text-xs font-medium text-cyan hover:bg-cyan/15 disabled:opacity-50"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Confirm & deploy playbook
          </button>
        </div>
        {diagnosis?.playbookName ? (
          <div className="rounded-md border border-border bg-muted/30 p-3 font-mono text-[11px] text-muted-foreground">
            Recommended playbook: <span className="text-foreground">{diagnosis.playbookName}</span>
            <br />
            {diagnosis.playbookRationale}
          </div>
        ) : null}
        <ol className="mt-3 space-y-2">
          {(diagnosis?.remediation ?? []).map((step, index) => (
            <li
              key={`${step}-${index}`}
              className="tilt-hover rounded-md border border-border bg-muted/30 p-3 text-[12px]"
            >
              {step}
            </li>
          ))}
          {!diagnosis && (
            <li className="rounded-md border border-dashed border-border p-6 text-center font-mono text-[11px] text-muted-foreground">
              Run diagnosis to generate a memory-assisted remediation playbook.
            </li>
          )}
        </ol>
      </div>
    </section>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-[12px] transition-colors",
        active
          ? "border-cyan text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
