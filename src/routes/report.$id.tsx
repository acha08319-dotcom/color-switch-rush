import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/report/$id")({
  component: ReportView,
  head: () => ({
    meta: [
      { title: "Shared Self-Check Report | Color Switch Rush" },
      {
        name: "description",
        content:
          "View a shared Color Switch Rush Playables integration self-check report: test results, logs and build details.",
      },
      { property: "og:title", content: "Shared Self-Check Report | Color Switch Rush" },
      {
        property: "og:description",
        content: "Playables integration diagnostics shared from Color Switch Rush.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ReportView() {
  const { id } = Route.useParams();
  const [json, setJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("selfcheck_reports")
      .select("report, created_at")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else if (!data) setError("This report has expired or does not exist.");
        else setJson(JSON.stringify(data.report, null, 2));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <h1 className="text-xl font-black uppercase tracking-widest mb-1">Self-check report</h1>
      <p className="text-xs text-white/40 font-mono mb-4">{id}</p>
      {error && <p className="text-rose-300 text-sm">{error}</p>}
      {!error && !json && <p className="text-white/50 text-sm">Loading…</p>}
      {json && (
        <pre className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/60 p-4">
          {json}
        </pre>
      )}
    </main>
  );
}
