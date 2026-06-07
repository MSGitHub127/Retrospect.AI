import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { StatusBar } from "@/components/retrospect/status-bar";
import { SideRail } from "@/components/retrospect/side-rail";
import { TriageStream } from "@/components/retrospect/triage-stream";
import { AnalysisPanel } from "@/components/retrospect/analysis-panel";
import { ObservabilityPanel } from "@/components/retrospect/observability-panel";
import {
  diagnose,
  generatePostMortem,
  getConfidenceMatrix,
  getSystemHealth,
  listLiveIncidents,
} from "@/lib/retrospect/api.functions";
import type { Diagnosis, MemoryMatch, PostMortem } from "@/lib/retrospect/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Retrospect.AI — Incident Intelligence Console" },
      {
        name: "description",
        content:
          "Enterprise incident command center: live triage, memory-based incident matching, and auto post-mortems.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchLive = useServerFn(listLiveIncidents);
  const fetchHealth = useServerFn(getSystemHealth);
  const fetchMatrix = useServerFn(getConfidenceMatrix);
  const runDiagnose = useServerFn(diagnose);
  const runPostMortem = useServerFn(generatePostMortem);

  const live = useQuery({ queryKey: ["live"], queryFn: () => fetchLive() });
  const health = useQuery({ queryKey: ["health"], queryFn: () => fetchHealth() });
  const matrix = useQuery({ queryKey: ["matrix"], queryFn: () => fetchMatrix() });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [diagnosisByIncident, setDiagnosisByIncident] = useState<
    Record<string, { diagnosis: Diagnosis; matches: MemoryMatch[] }>
  >({});
  const [postmortem, setPostmortem] = useState<PostMortem | null>(null);
  const [tab, setTab] = useState<"triage" | "analysis" | "observe">("analysis");

  useEffect(() => {
    if (live.data && !selectedId) setSelectedId(live.data[0]?.id ?? null);
  }, [live.data, selectedId]);

  const selected = useMemo(
    () => live.data?.find((i) => i.id === selectedId) ?? null,
    [live.data, selectedId],
  );

  const diagnoseMut = useMutation({
    mutationFn: (input: { log: string; incident_id: string }) => runDiagnose({ data: input }),
    onSuccess: (res, vars) => {
      setDiagnosisByIncident((prev) => ({ ...prev, [vars.incident_id]: res }));
      setPostmortem(null);
    },
  });

  const postMortemMut = useMutation({
    mutationFn: (input: { incident_id: string; log: string }) =>
      runPostMortem({ data: input }),
    onSuccess: (pm) => setPostmortem(pm),
  });

  const current = selected ? diagnosisByIncident[selected.id] : undefined;

  const handleExport = () => {
    if (!postmortem) return;
    const md = renderPostMortemMarkdown(postmortem);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${postmortem.incidentId}-postmortem.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <StatusBar health={health.data} />
      <div className="flex min-h-0 flex-1">
        <SideRail />
        <main className="flex min-h-0 flex-1 flex-col">
          {/* Mobile tab switcher */}
          <div className="flex border-b border-border bg-rail/50 px-3 lg:hidden">
            {(["triage", "analysis", "observe"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-[12px] capitalize border-b-2 ${
                  tab === t
                    ? "border-cyan text-foreground"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[280px_minmax(0,1fr)_340px] xl:grid-cols-[300px_minmax(0,1fr)_380px]">
            {/* Left */}
            <div className={`min-h-0 ${tab !== "triage" ? "hidden lg:block" : ""}`}>
              <TriageStream
                incidents={live.data ?? []}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setTab("analysis");
                }}
              />
            </div>

            {/* Center */}
            <div className={`min-h-0 ${tab !== "analysis" ? "hidden lg:block" : ""}`}>
              {selected ? (
                <AnalysisPanel
                  incident={selected}
                  diagnosis={current?.diagnosis ?? null}
                  matches={current?.matches ?? []}
                  loading={diagnoseMut.isPending}
                  onDiagnose={() =>
                    diagnoseMut.mutate({ log: selected.log, incident_id: selected.id })
                  }
                  onDeploy={() => {
                    if (current?.diagnosis) {
                      window.alert(
                        `Playbook deployed for ${selected.id}\nConfidence: ${current.diagnosis.confidencePct}%`,
                      );
                    }
                  }}
                />
              ) : (
                <div className="grid h-full place-items-center surface-card text-sm text-muted-foreground">
                  Select an incident from the triage stream
                </div>
              )}
            </div>

            {/* Right */}
            <div className={`min-h-0 ${tab !== "observe" ? "hidden lg:block" : ""}`}>
              <ObservabilityPanel
                health={health.data}
                matrix={matrix.data ?? []}
                diagnosis={current?.diagnosis ?? null}
                postmortem={postmortem}
                onGeneratePostMortem={() => {
                  if (selected && current?.diagnosis) {
                    postMortemMut.mutate({
                      incident_id: selected.id,
                      log: selected.log,
                    });
                  }
                }}
                onExport={handleExport}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function renderPostMortemMarkdown(pm: PostMortem) {
  return [
    `# Post-mortem: ${pm.incidentId}`,
    `Generated: ${pm.generated_at}`,
    ``,
    `## Summary`,
    pm.summary,
    ``,
    `## Timeline`,
    ...pm.timeline.map((t) => `- **${t.at}** — ${t.event}`),
    ``,
    `## Contributing factors`,
    ...pm.contributing_factors.map((c) => `- ${c}`),
    ``,
    `## Action items`,
    ...pm.action_items.map((a) => `- [ ] @${a.owner} — ${a.item} _(due ${a.due})_`),
    ``,
    `## Lessons`,
    ...pm.lessons.map((l) => `- ${l}`),
  ].join("\n");
}
