import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/retrospect/types";

const STYLES: Record<Severity, string> = {
  critical:
    "bg-crimson/15 text-crimson border-crimson/40",
  high: "bg-amber/15 text-amber border-amber/40",
  medium: "bg-cyan/15 text-cyan border-cyan/40",
  low: "bg-muted text-muted-foreground border-border",
};

export function SeverityChip({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider",
        STYLES[severity],
        className,
      )}
    >
      {severity === "critical" && (
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-crimson" />
      )}
      {severity}
    </span>
  );
}
