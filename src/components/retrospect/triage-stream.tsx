import { cn } from "@/lib/utils";
import { SeverityChip } from "./severity-chip";
import type { LiveIncident } from "@/lib/retrospect/types";

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function TriageStream({
  incidents,
  selectedId,
  onSelect,
}: {
  incidents: LiveIncident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="flex h-full flex-col surface-flat overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Live Triage Stream</h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {incidents.length} active · real-time
          </p>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-emerald">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald" />
          stream
        </span>
      </header>
      <div className="scroll-thin flex-1 overflow-y-auto">
        <ul className="divide-y divide-border">
          {incidents.map((inc) => {
            const active = inc.id === selectedId;
            return (
              <li key={inc.id}>
                <button
                  type="button"
                  onClick={() => onSelect(inc.id)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors hover:bg-secondary/60",
                    active && "bg-secondary",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <SeverityChip severity={inc.severity} />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {timeAgo(inc.timestamp)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug">
                    {inc.title}
                  </p>
                  <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{inc.error_code}</span>
                    <span>{inc.service}</span>
                    <span className="text-muted-foreground/70">·</span>
                    <span>{inc.region}</span>
                  </div>
                  {active && (
                    <div className="mt-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-cyan">
                      <span className="h-1 w-1 rounded-full bg-cyan" /> selected
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
