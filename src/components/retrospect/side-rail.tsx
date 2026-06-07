import { cn } from "@/lib/utils";
import {
  Activity,
  Boxes,
  BrainCircuit,
  FileText,
  GaugeCircle,
  History,
  Settings2,
  ShieldAlert,
} from "lucide-react";

const ITEMS = [
  { icon: ShieldAlert, label: "Triage", active: true },
  { icon: BrainCircuit, label: "Memory" },
  { icon: GaugeCircle, label: "Health" },
  { icon: FileText, label: "Post-mortems" },
  { icon: History, label: "History" },
  { icon: Boxes, label: "Runbooks" },
  { icon: Activity, label: "Telemetry" },
  { icon: Settings2, label: "Settings" },
];

export function SideRail() {
  return (
    <nav className="hidden h-full w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-rail py-3 md:flex">
      {ITEMS.map((it) => (
        <button
          key={it.label}
          type="button"
          className={cn(
            "group relative grid h-10 w-10 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            it.active && "bg-secondary text-foreground",
          )}
          aria-label={it.label}
        >
          <it.icon className="h-4 w-4" />
          {it.active && (
            <span className="absolute left-0 top-1.5 h-7 w-0.5 rounded-r bg-cyan" />
          )}
          <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-elevated group-hover:block">
            {it.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
