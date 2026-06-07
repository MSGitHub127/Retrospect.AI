import { useTheme } from "./theme-provider";
import { Activity, Moon, Sun } from "lucide-react";
import type { SystemHealth } from "@/lib/retrospect/types";

export function StatusBar({ health }: { health?: SystemHealth }) {
  const { theme, toggle } = useTheme();
  const now = new Date().toUTCString().split(" ").slice(4, 5).join(" ");

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-rail/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-rail/60">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background">
            <Activity className="h-3.5 w-3.5" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight">Retrospect<span className="text-cyan">.AI</span></div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Incident Intelligence · v3.2
            </div>
          </div>
        </div>
      </div>

      <div className="hidden items-center gap-6 font-mono text-[11px] text-muted-foreground md:flex">
        <Pill label="STATUS" value={health?.open_incidents ? "DEGRADED" : "OPERATIONAL"} tone={health?.open_incidents ? "warn" : "ok"} />
        <Pill label="MEMORY" value={`${health?.memory_count ?? "—"} INC`} />
        <Pill label="MATCH" value={`${health?.match_rate_pct ?? "—"}%`} />
        <Pill label="P50 DIAG" value={`${health?.median_diagnosis_seconds ?? "—"}s`} />
        <span className="hidden lg:inline">UTC {now}</span>
      </div>

      <button
        type="button"
        onClick={toggle}
        className="surface-flat tilt-hover flex h-8 items-center gap-2 px-2 text-xs"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        <span className="hidden font-mono uppercase tracking-wider text-muted-foreground sm:inline">
          {theme}
        </span>
      </button>
    </header>
  );
}

function Pill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "neutral";
}) {
  const dot =
    tone === "ok" ? "bg-emerald" : tone === "warn" ? "bg-amber" : "bg-muted-foreground";
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="uppercase tracking-widest">{label}</span>
      <span className="text-foreground">{value}</span>
    </span>
  );
}
