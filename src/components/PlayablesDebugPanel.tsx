import { useCallback, useEffect, useState } from "react";

export type Status = "pending" | "pass" | "fail" | "skip";
export type Test = { name: string; status: Status; message?: string };
export type LogEntry = { t: number; level: "info" | "warn" | "error"; msg: string };
export type SelfCheckResult = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  sdkVersion: string | null;
  inPlayablesEnv: boolean;
  userAgent: string;
  language: string | null;
  summary: { total: number; pass: number; fail: number; skip: number };
  tests: Test[];
  logs: LogEntry[];
};

const TEST_KEY = "__csr_selfcheck__";

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export const INITIAL_TESTS: Test[] = [
  { name: "SDK loaded", status: "pending" },
  { name: "In Playables env", status: "pending" },
  { name: "firstFrameReady + gameReady", status: "pending" },
  { name: "Audio state", status: "pending" },
  { name: "getLanguage", status: "pending" },
  { name: "Pause/Resume hooks", status: "pending" },
  { name: "onAudioEnabledChange", status: "pending" },
  { name: "Cloud save round-trip", status: "pending" },
  { name: "engagement.sendScore", status: "pending" },
  { name: "Ads API surface", status: "pending" },
  { name: "Health logging", status: "pending" },
];

/**
 * Runs the full Playables integration self-check.
 * Safe to call headlessly (e.g. automatically on game load).
 */
export async function runSelfCheck(
  onProgress?: (tests: Test[]) => void,
): Promise<SelfCheckResult> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const tests: Test[] = INITIAL_TESTS.map((t) => ({ ...t }));
  const logs: LogEntry[] = [];
  let detectedLanguage: string | null = null;

  const log = (level: LogEntry["level"], msg: string) => {
    logs.push({ t: Date.now() - started, level, msg });
  };
  const update = (name: string, status: Status, message?: string) => {
    const idx = tests.findIndex((t) => t.name === name);
    if (idx >= 0) tests[idx] = { ...tests[idx], status, message };
    log(status === "fail" ? "error" : status === "skip" ? "warn" : "info", `${name}: ${status}${message ? ` — ${message}` : ""}`);
    onProgress?.(tests.map((t) => ({ ...t })));
  };

  const yt = typeof window !== "undefined" ? window.ytgame : undefined;

  const finish = (): SelfCheckResult => {
    const finished = Date.now();
    return {
      startedAt,
      finishedAt: new Date(finished).toISOString(),
      durationMs: finished - started,
      sdkVersion: yt?.SDK_VERSION ?? null,
      inPlayablesEnv: Boolean(yt?.IN_PLAYABLES_ENV),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      language: detectedLanguage,
      summary: {
        total: tests.length,
        pass: tests.filter((t) => t.status === "pass").length,
        fail: tests.filter((t) => t.status === "fail").length,
        skip: tests.filter((t) => t.status === "skip").length,
      },
      tests: tests.map((t) => ({ ...t })),
      logs,
    };
  };

  // 1. SDK global present
  if (!yt) {
    update("SDK loaded", "fail", "window.ytgame is undefined — script did not load");
    for (const t of tests) {
      if (t.status === "pending") update(t.name, "skip", "SDK unavailable");
    }
    return finish();
  }
  update("SDK loaded", "pass", `v${yt.SDK_VERSION ?? "unknown"}`);

  // 2. Environment flag
  update(
    "In Playables env",
    yt.IN_PLAYABLES_ENV ? "pass" : "skip",
    yt.IN_PLAYABLES_ENV ? "Running inside YouTube" : "Not inside YouTube host — SDK stubs are inert",
  );

  // 3. firstFrameReady / gameReady callable
  try {
    yt.game.firstFrameReady();
    yt.game.gameReady();
    update("firstFrameReady + gameReady", "pass", "Both signals sent");
  } catch (e: any) {
    update("firstFrameReady + gameReady", "fail", e?.message ?? String(e));
  }

  // 4. Audio enabled
  try {
    const enabled = yt.system.isAudioEnabled();
    update("Audio state", "pass", enabled ? "Audio enabled" : "Audio disabled");
  } catch (e: any) {
    update("Audio state", "fail", e?.message ?? String(e));
  }

  // 5. Language
  try {
    const lang = await withTimeout(yt.system.getLanguage(), 3000, "getLanguage");
    detectedLanguage = lang;
    update("getLanguage", "pass", `Locale: ${lang}`);
  } catch (e: any) {
    update("getLanguage", "fail", e?.message ?? String(e));
  }

  // 6. pause/resume listener registration
  try {
    const offPause = yt.system.onPause(() => {});
    const offResume = yt.system.onResume(() => {});
    if (typeof offPause !== "function" || typeof offResume !== "function") {
      throw new Error("Listener did not return an unsubscribe function");
    }
    offPause();
    offResume();
    update("Pause/Resume hooks", "pass", "Listeners register + unregister");
  } catch (e: any) {
    update("Pause/Resume hooks", "fail", e?.message ?? String(e));
  }

  // 7. onAudioEnabledChange registers
  try {
    const off = yt.system.onAudioEnabledChange(() => {});
    if (typeof off !== "function") throw new Error("No unsubscribe returned");
    off();
    update("onAudioEnabledChange", "pass", "Listener registers");
  } catch (e: any) {
    update("onAudioEnabledChange", "fail", e?.message ?? String(e));
  }

  // 8. saveData / loadData round-trip (only real inside Playables env)
  if (!yt.IN_PLAYABLES_ENV) {
    update("Cloud save round-trip", "skip", "Requires Playables host");
  } else {
    try {
      // Preserve real save to avoid clobbering user data.
      const original = await withTimeout(yt.game.loadData(), 4000, "loadData(orig)");
      const marker = JSON.stringify({ [TEST_KEY]: Date.now(), original });
      await withTimeout(yt.game.saveData(marker), 4000, "saveData");
      const roundTrip = await withTimeout(yt.game.loadData(), 4000, "loadData");
      const ok = roundTrip === marker;
      // Restore original data so we don't destroy real save state.
      if (typeof original === "string") {
        await withTimeout(yt.game.saveData(original), 4000, "saveData(restore)");
      }
      update(
        "Cloud save round-trip",
        ok ? "pass" : "fail",
        ok ? "Data persisted + restored" : "Round-trip mismatch",
      );
    } catch (e: any) {
      update("Cloud save round-trip", "fail", e?.message ?? String(e));
    }
  }

  // 9. sendScore API present
  try {
    if (typeof yt.engagement?.sendScore !== "function") {
      throw new Error("engagement.sendScore is not a function");
    }
    update("engagement.sendScore", "pass", "API available");
  } catch (e: any) {
    update("engagement.sendScore", "fail", e?.message ?? String(e));
  }

  // 10. Ads APIs available (do not actually request)
  try {
    const hasInterstitial = typeof yt.ads?.requestInterstitialAd === "function";
    const hasRewarded = typeof yt.ads?.requestRewardedAd === "function";
    if (!hasInterstitial || !hasRewarded) throw new Error("Ads API missing");
    update("Ads API surface", "pass", "Interstitial + rewarded available");
  } catch (e: any) {
    update("Ads API surface", "fail", e?.message ?? String(e));
  }

  // 11. Health logging
  try {
    yt.health.logWarning();
    update("Health logging", "pass", "logWarning callable");
  } catch (e: any) {
    update("Health logging", "fail", e?.message ?? String(e));
  }

  return finish();
}

const STATUS_STYLE: Record<Status, string> = {
  pending: "bg-white/10 text-white/50",
  pass: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
  fail: "bg-rose-500/25 text-rose-200 border-rose-400/50",
  skip: "bg-amber-500/20 text-amber-200 border-amber-400/40",
};

export type DebugLabels = {
  title: string;
  run: string;
  running: string;
  close: string;
  pass: string;
  fail: string;
  skip: string;
  copyReport: string;
  copied: string;
  downloadReport: string;
};

export function PlayablesDebugPanel({
  open,
  onClose,
  labels,
  result,
  onResult,
}: {
  open: boolean;
  onClose: () => void;
  labels: DebugLabels;
  result?: SelfCheckResult | null;
  onResult?: (r: SelfCheckResult) => void;
}) {
  const [tests, setTests] = useState<Test[]>(result?.tests ?? INITIAL_TESTS);
  const [report, setReport] = useState<SelfCheckResult | null>(result ?? null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  // Adopt an externally provided (auto-run) result when it arrives.
  useEffect(() => {
    if (result && !isRunning) {
      setReport(result);
      setTests(result.tests);
    }
  }, [result, isRunning]);

  const run = useCallback(async () => {
    setTests(INITIAL_TESTS.map((t) => ({ ...t, status: "pending", message: undefined })));
    setIsRunning(true);
    setCopied(false);
    try {
      const r = await runSelfCheck(setTests);
      setReport(r);
      setTests(r.tests);
      onResult?.(r);
    } finally {
      setIsRunning(false);
    }
  }, [onResult]);

  const reportJson = useCallback(() => JSON.stringify(report, null, 2), [report]);

  const copyReport = useCallback(async () => {
    if (!report) return;
    const text = reportJson();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [report, reportJson]);

  const downloadReport = useCallback(() => {
    if (!report) return;
    const blob = new Blob([reportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `playables-selfcheck-${report.startedAt.replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report, reportJson]);

  if (!open) return null;

  const passCount = tests.filter((t) => t.status === "pass").length;
  const failCount = tests.filter((t) => t.status === "fail").length;
  const skipCount = tests.filter((t) => t.status === "skip").length;
  const done = tests.every((t) => t.status !== "pending");

  const statusLabel = (s: Status) =>
    s === "pass" ? labels.pass : s === "fail" ? labels.fail : s === "skip" ? labels.skip : "…";

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm animate-fade-in">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/40">Debug</div>
          <h2 className="text-lg font-black">{labels.title}</h2>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm"
          aria-label={labels.close}
        >
          ✕
        </button>
      </div>

      <div className="px-4 pb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest">
        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
          {passCount} {labels.pass}
        </span>
        {failCount > 0 && (
          <span className="px-2 py-0.5 rounded bg-rose-500/25 text-rose-200">
            {failCount} {labels.fail}
          </span>
        )}
        {skipCount > 0 && (
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200">
            {skipCount} {labels.skip}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
        {tests.map((t) => (
          <div
            key={t.name}
            className={`rounded-lg border border-white/10 px-3 py-2 text-xs ${
              t.status === "fail" ? "bg-rose-500/10" : "bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-white/90">{t.name}</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-transparent ${STATUS_STYLE[t.status]}`}
              >
                {statusLabel(t.status)}
              </span>
            </div>
            {t.message && (
              <div className="mt-1 text-[11px] text-white/60 font-mono break-words">{t.message}</div>
            )}
          </div>
        ))}
      </div>

      <div className="px-4 pb-2 flex gap-2">
        <button
          onClick={copyReport}
          disabled={!report || isRunning}
          className="flex-1 px-3 py-2 rounded-full border border-white/20 text-white/80 font-bold text-[11px] uppercase tracking-widest hover:bg-white/10 transition disabled:opacity-40"
        >
          {copied ? `✓ ${labels.copied}` : `⧉ ${labels.copyReport}`}
        </button>
        <button
          onClick={downloadReport}
          disabled={!report || isRunning}
          className="flex-1 px-3 py-2 rounded-full border border-white/20 text-white/80 font-bold text-[11px] uppercase tracking-widest hover:bg-white/10 transition disabled:opacity-40"
        >
          ⤓ {labels.downloadReport}
        </button>
      </div>

      <div className="p-4 pt-2 flex gap-2 border-t border-white/10">
        <button
          onClick={run}
          disabled={isRunning}
          className="flex-1 px-4 py-3 rounded-full bg-white text-black font-black text-sm uppercase tracking-widest disabled:opacity-50 hover:scale-[1.02] transition-transform"
        >
          {isRunning ? labels.running : done ? labels.run + " ↻" : labels.run}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-3 rounded-full border border-white/20 text-white/70 font-bold text-sm uppercase tracking-widest hover:bg-white/10 transition"
        >
          {labels.close}
        </button>
      </div>
    </div>
  );
}
