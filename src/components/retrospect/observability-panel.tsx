import { Download, FileText, ShieldCheck } from "lucide-react";
import type {
  ConfidenceCell,
  Diagnosis,
  PostMortem,
  SystemHealth,
} from "@/lib/retrospect/types";
import { cn } from "@/lib/utils";

export function ObservabilityPanel({
  health,
  diagnosis,
  postmortem,
  matrix,
  onExport,
  onGeneratePostMortem,
}: {
  health?: SystemHealth;
  diagnosis: Diagnosis | null;
  postmortem: PostMortem | null;
  matrix: ConfidenceCell[];
  onExport: () => void;
  onGeneratePostMortem: () => void;
}) {
  return (
    <aside className="flex h-full flex-col gap-3 overflow-y-auto scroll-thin">
      {/* Memory health */}
      <div className="surface-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight">Institutional memory</h3>
          <ShieldCheck className="h-4 w-4 text-emerald" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Incidents indexed" value={`${health?.memory_count ?? "—"}`} />
          <Stat label="Recall quality" value={`${health?.recall_quality_pct ?? "—"}%`} />
          <Stat label="Match rate" value={`${health?.match_rate_pct ?? "—"}%`} />
          <Stat label="P50 diagnosis" value={`${health?.median_diagnosis_seconds ?? "—"}s`} />
        </div>
        <div className="mt-3 space-y-1.5">
          {health?.services.map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-2 py-1.5 font-mono text-[11px]"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    s.status === "healthy" && "bg-emerald",
                    s.status === "degraded" && "bg-amber",
                    s.status === "down" && "bg-crimson",
                  )}
                />
                <span>{s.name}</span>
              </div>
              <span className="text-muted-foreground">{s.latency_ms}ms</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confidence matrix */}
      <div className="surface-card p-4">
        <h3 className="text-sm font-semibold tracking-tight">Confidence matrix</h3>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          service × failure-class
        </p>
        <div className="scroll-thin mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className="p-1" />
                {Array.from(new Set(matrix.map((m) => m.category))).map((c) => (
                  <th key={c} className="p-1 font-mono text-[9px] uppercase text-muted-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(new Set(matrix.map((m) => m.service))).map((svc) => (
                <tr key={svc}>
                  <td className="p-1 pr-2 text-right font-mono text-[10px] text-muted-foreground">
                    {svc}
                  </td>
                  {matrix
                    .filter((m) => m.service === svc)
                    .map((cell) => (
                      <td key={cell.category} className="p-0.5">
                        <div
                          title={`${cell.score}% · ${cell.samples} samples`}
                          className="grid h-7 w-full place-items-center rounded font-mono text-[10px] text-foreground"
                          style={{
                            background: `color-mix(in oklab, var(--color-cyan) ${cell.score}%, var(--color-muted))`,
                          }}
                        >
                          {cell.score}
                        </div>
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Post-mortem preview */}
      <div className="surface-card flex-1 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Auto post-mortem</h3>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {postmortem ? "ready · review before export" : "awaiting diagnosis"}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onGeneratePostMortem}
              disabled={!diagnosis}
              className="tilt-hover inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-[11px] hover:bg-secondary disabled:opacity-50"
            >
              <FileText className="h-3 w-3" /> Generate
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={!postmortem}
              className="tilt-hover inline-flex h-8 items-center gap-1 rounded-md border border-cyan/40 bg-cyan/10 px-2 text-[11px] text-cyan hover:bg-cyan/15 disabled:opacity-50"
            >
              <Download className="h-3 w-3" /> Export
            </button>
          </div>
        </div>

        {postmortem ? (
          <div className="mt-3 space-y-3 text-[12px]">
            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Summary
              </h4>
              <p className="mt-1 leading-snug">{postmortem.summary}</p>
            </div>
            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Timeline
              </h4>
              <ul className="mt-1 space-y-1 font-mono text-[11px]">
                {postmortem.timeline.map((t) => (
                  <li key={t.at} className="flex gap-2">
                    <span className="w-14 text-cyan">{t.at}</span>
                    <span className="text-foreground/85">{t.event}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Action items
              </h4>
              <ul className="mt-1 space-y-1">
                {postmortem.action_items.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded border border-border bg-muted/30 px-2 py-1 font-mono text-[11px]"
                  >
                    <span>
                      <span className="text-cyan">@{a.owner}</span> · {a.item}
                    </span>
                    <span className="text-muted-foreground">{a.due}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-dashed border-border p-6 text-center font-mono text-[11px] text-muted-foreground">
            Run diagnosis, then generate a post-mortem to preview Notion / Confluence export.
          </div>
        )}
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-2">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-lg font-semibold tracking-tight text-cyan">
        {value}
      </div>
    </div>
  );
}
