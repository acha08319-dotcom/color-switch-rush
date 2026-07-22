import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { detectLanguage, getDict, type Dict, type Lang } from "../lib/i18n";
import { PlayablesDebugPanel } from "../components/PlayablesDebugPanel";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Color Switch Rush" },
      { name: "description", content: "Match the gate's color before you crash through it. Fast reflex arcade game." },
      { property: "og:title", content: "Color Switch Rush" },
      { property: "og:description", content: "Tap to cycle color and thread the spinning gates. How high can your combo go?" },
    ],
  }),
  component: Game,
});

type ColorDef = { name: string; css: string; cbCss: string; symbol: string };

const COLORS: ColorDef[] = [
  { name: "pink",   css: "#ff3b8b", cbCss: "#e6194B", symbol: "●" },
  { name: "cyan",   css: "#22d3ee", cbCss: "#4363d8", symbol: "▲" },
  { name: "yellow", css: "#facc15", cbCss: "#ffe119", symbol: "■" },
  { name: "violet", css: "#a855f7", cbCss: "#f58231", symbol: "★" },
];

const SPEED_STEP_INTERVAL = 6;
const BASE_SPEED = 180;
const SPEED_PER_LEVEL = 55;

type Milestone = { combo: number; label: string; emoji: string };
const MILESTONES: Milestone[] = [
  { combo: 5,   label: "Warmed Up",   emoji: "🔥" },
  { combo: 10,  label: "On Fire",     emoji: "🔥" },
  { combo: 25,  label: "Unstoppable", emoji: "⚡" },
  { combo: 50,  label: "Legendary",   emoji: "💎" },
  { combo: 100, label: "Godlike",     emoji: "👑" },
];

type Mode = "classic" | "daily" | "practice";

const MODE_LABEL: Record<Mode, string> = {
  classic: "Endless",
  daily: "Daily",
  practice: "Practice",
};

type Gate = {
  y: number;
  rotation: number;
  spin: number;
  segments: number[];
  passed: boolean;
};

// Seeded RNG
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function loadStreak(): number {
  try {
    const last = localStorage.getItem("csr_daily_last");
    const streak = Number(localStorage.getItem("csr_daily_streak") || "0");
    if (!last) return 0;
    if (last === todayKey() || last === yesterdayKey()) return streak;
    return 0;
  } catch {
    return 0;
  }
}
function recordDailyPlay(): number {
  try {
    const today = todayKey();
    const last = localStorage.getItem("csr_daily_last");
    let streak = Number(localStorage.getItem("csr_daily_streak") || "0");
    if (last === today) return streak;
    if (last === yesterdayKey()) streak += 1;
    else streak = 1;
    localStorage.setItem("csr_daily_streak", String(streak));
    localStorage.setItem("csr_daily_last", today);
    return streak;
  } catch {
    return 0;
  }
}

function makeGate(y: number, level: number, rand: () => number): Gate {
  const segs = [0, 1, 2, 3];
  // Fisher-Yates with seeded rand
  for (let i = segs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [segs[i], segs[j]] = [segs[j], segs[i]];
  }
  const spinBase = 0.55 + rand() * 0.7 + level * 0.18;
  const spin = spinBase * (rand() < 0.5 ? -1 : 1);
  return { y, rotation: rand() * Math.PI * 2, spin, segments: segs, passed: false };
}

// --- Audio ---
let audioCtx: AudioContext | null = null;
function getAudio() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}
function beep(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15) {
  const ctx = getAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

type Settings = {
  sound: boolean;
  shake: boolean;
  colorblind: boolean;
  reducedMotion: boolean;
};

const DEFAULT_SETTINGS: Settings = { sound: true, shake: true, colorblind: false, reducedMotion: false };

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem("csr_settings");
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function highestBadge(peak: number): Milestone | null {
  let best: Milestone | null = null;
  for (const m of MILESTONES) if (peak >= m.combo) best = m;
  return best;
}

function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [dailyBest, setDailyBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState(1);
  const [nextSpeedIn, setNextSpeedIn] = useState(SPEED_STEP_INTERVAL);
  const [newBest, setNewBest] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [peakCombo, setPeakCombo] = useState(0);
  const [mode, setMode] = useState<Mode>("classic");
  const [badgePopup, setBadgePopup] = useState<Milestone | null>(null);
  const badgeTimerRef = useRef<number | null>(null);
  const [passes, setPasses] = useState(0);
  const [misses, setMisses] = useState(0);
  const [longestChain, setLongestChain] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lang, setLang] = useState<Lang>("en");
  const [showDebug, setShowDebug] = useState(false);
  const t: Dict = getDict(lang);


  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const stateRef = useRef({
    ballColor: 0,
    ballY: 0,
    fallSpeed: BASE_SPEED,
    gates: [] as Gate[],
    nextGateY: 0,
    time: 0,
    score: 0,
    combo: 0,
    peakCombo: 0,
    over: false,
    running: false,
    missFlash: 0,
    nearMissGlow: 0,
    shake: 0,
    level: 1,
    speedFlashTimer: 0,
    rand: Math.random as () => number,
    speedSeed: 0,
    mode: "classic" as Mode,
    passes: 0,
    misses: 0,
    chain: 0,
    longestChain: 0,
  });

  const sfx = useCallback((fn: () => void) => {
    if (settingsRef.current.sound) fn();
  }, []);
  const playPass = useCallback((c: number) => sfx(() => beep(440 + Math.min(c, 20) * 40, 0.12, "triangle", 0.12)), [sfx]);
  const playNearMiss = useCallback(() => sfx(() => {
    beep(880, 0.06, "square", 0.08);
    setTimeout(() => beep(660, 0.05, "square", 0.06), 40);
  }), [sfx]);
  const playCrash = useCallback(() => sfx(() => {
    beep(180, 0.3, "sawtooth", 0.2);
    setTimeout(() => beep(90, 0.4, "sawtooth", 0.18), 60);
  }), [sfx]);
  const playSpeedUp = useCallback(() => sfx(() => {
    beep(300, 0.08, "square", 0.1);
    setTimeout(() => beep(500, 0.08, "square", 0.1), 80);
    setTimeout(() => beep(700, 0.12, "square", 0.1), 160);
  }), [sfx]);
  const playMilestone = useCallback(() => sfx(() => {
    beep(660, 0.1, "triangle", 0.14);
    setTimeout(() => beep(880, 0.1, "triangle", 0.14), 90);
    setTimeout(() => beep(1200, 0.18, "triangle", 0.14), 180);
  }), [sfx]);

  const showBadge = useCallback((m: Milestone) => {
    setBadgePopup(m);
    if (badgeTimerRef.current) window.clearTimeout(badgeTimerRef.current);
    badgeTimerRef.current = window.setTimeout(() => setBadgePopup(null), 1800);
  }, []);

  const loadBests = useCallback(() => {
    try {
      setBest(Number(localStorage.getItem("csr_best") || "0"));
      setBestCombo(Number(localStorage.getItem("csr_bestCombo") || "0"));
      setDailyBest(Number(localStorage.getItem(`csr_daily_${todayKey()}`) || "0"));
      setStreak(loadStreak());
    } catch {}
  }, []);

  useEffect(() => {
    loadBests();
    setSettings(loadSettings());
    detectLanguage().then((l) => setLang(l)).catch(() => {});
  }, [loadBests]);


  // YouTube Playables SDK integration.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const yt = window.ytgame;
    if (!yt) return;

    // Signal first frame + interactivity as required by the SDK.
    try { yt.game.firstFrameReady(); } catch {}
    const readyTimer = window.setTimeout(() => {
      try { yt.game.gameReady(); } catch {}
    }, 0);

    // Mirror YouTube's audio setting into our sound toggle.
    try {
      const enabled = yt.system.isAudioEnabled();
      setSettings((prev) => {
        if (prev.sound === enabled) return prev;
        const next = { ...prev, sound: enabled };
        try { localStorage.setItem("csr_settings", JSON.stringify(next)); } catch {}
        return next;
      });
    } catch {}
    const offAudio = yt.system.onAudioEnabledChange((enabled) => {
      setSettings((prev) => {
        if (prev.sound === enabled) return prev;
        const next = { ...prev, sound: enabled };
        try { localStorage.setItem("csr_settings", JSON.stringify(next)); } catch {}
        return next;
      });
    });

    // Auto-pause / resume on YouTube system events.
    const offPause = yt.system.onPause(() => {
      const s = stateRef.current;
      if (s.running && !s.over) setPaused(true);
    });
    const offResume = yt.system.onResume(() => {
      setPaused(false);
    });

    // Hydrate best scores + settings from cloud save when available.
    if (yt.IN_PLAYABLES_ENV) {
      yt.game.loadData()
        .then((raw) => {
          if (!raw) return;
          const data = JSON.parse(raw) as Partial<{
            best: number;
            bestCombo: number;
            dailyBest: Record<string, number>;
            streak: number;
            streakLast: string;
            settings: Partial<Settings>;
          }>;
          try {
            if (typeof data.best === "number") {
              const prev = Number(localStorage.getItem("csr_best") || "0");
              if (data.best > prev) localStorage.setItem("csr_best", String(data.best));
            }
            if (typeof data.bestCombo === "number") {
              const prev = Number(localStorage.getItem("csr_bestCombo") || "0");
              if (data.bestCombo > prev) localStorage.setItem("csr_bestCombo", String(data.bestCombo));
            }
            if (data.dailyBest) {
              for (const [k, v] of Object.entries(data.dailyBest)) {
                const key = `csr_daily_${k}`;
                const prev = Number(localStorage.getItem(key) || "0");
                if (v > prev) localStorage.setItem(key, String(v));
              }
            }
            if (typeof data.streak === "number") {
              localStorage.setItem("csr_daily_streak", String(data.streak));
            }
            if (typeof data.streakLast === "string") {
              localStorage.setItem("csr_daily_last", data.streakLast);
            }
            if (data.settings) {
              setSettings((prev) => ({ ...prev, ...data.settings! }));
            }
          } catch {}
          loadBests();
        })
        .catch(() => {});
    }

    return () => {
      window.clearTimeout(readyTimer);
      try { offAudio?.(); } catch {}
      try { offPause?.(); } catch {}
      try { offResume?.(); } catch {}
    };
  }, [loadBests]);

  // Persist bests + settings to YouTube cloud save when values change.
  useEffect(() => {
    const yt = typeof window !== "undefined" ? window.ytgame : undefined;
    if (!yt || !yt.IN_PLAYABLES_ENV) return;
    try {
      const dailyBest: Record<string, number> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("csr_daily_") && !k.startsWith("csr_daily_streak") && !k.startsWith("csr_daily_last")) {
          dailyBest[k.slice("csr_daily_".length)] = Number(localStorage.getItem(k) || "0");
        }
      }
      const payload = JSON.stringify({
        best,
        bestCombo,
        dailyBest,
        streak,
        streakLast: localStorage.getItem("csr_daily_last") || "",
        settings,
      });
      yt.game.saveData(payload).catch(() => {
        try { yt.health.logWarning(); } catch {}
      });
    } catch {
      try { yt.health.logError(); } catch {}
    }
  }, [best, bestCombo, dailyBest, streak, settings]);

  // Report score to YouTube on game over (endless mode is the canonical score).
  useEffect(() => {
    if (!gameOver) return;
    const yt = typeof window !== "undefined" ? window.ytgame : undefined;
    if (!yt) return;
    if (modeRef.current !== "classic") return;
    try {
      yt.engagement.sendScore({ value: Math.max(0, Math.floor(score)) }).catch(() => {});
    } catch {}
  }, [gameOver, score]);



  const updateSetting = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem("csr_settings", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const reset = useCallback((selectedMode: Mode = modeRef.current) => {
    const s = stateRef.current;
    const isDaily = selectedMode === "daily";
    const seed = isDaily ? hashStr("csr-" + todayKey()) : (Math.random() * 2 ** 32) >>> 0;
    const rand = mulberry32(seed);
    s.rand = rand;
    s.speedSeed = seed;
    s.mode = selectedMode;
    s.ballColor = Math.floor(rand() * 4);
    s.ballY = 0;
    s.fallSpeed = BASE_SPEED;
    s.gates = [];
    s.nextGateY = 340;
    s.time = 0;
    s.score = 0;
    s.combo = 0;
    s.peakCombo = 0;
    s.over = false;
    s.running = true;
    s.missFlash = 0;
    s.nearMissGlow = 0;
    s.shake = 0;
    s.level = 1;
    s.speedFlashTimer = 0;
    s.passes = 0;
    s.misses = 0;
    s.chain = 0;
    s.longestChain = 0;
    setMode(selectedMode);
    setScore(0);
    setCombo(0);
    setPeakCombo(0);
    setLevel(1);
    setNextSpeedIn(SPEED_STEP_INTERVAL);
    setGameOver(false);
    setRunning(true);
    setPaused(false);
    setNewBest(false);
    setShowSettings(false);
    setBadgePopup(null);
    setPasses(0);
    setMisses(0);
    setLongestChain(0);
    getAudio()?.resume();
  }, []);

  const quitToMenu = useCallback(() => {
    const s = stateRef.current;
    s.running = false;
    s.over = false;
    setPaused(false);
    setRunning(false);
    setGameOver(false);
  }, []);

  const togglePause = useCallback(() => {
    const s = stateRef.current;
    if (!s.running || s.over) return;
    setPaused((p) => !p);
  }, []);

  const cycleColor = useCallback(() => {
    getAudio()?.resume();
    const s = stateRef.current;
    if (s.over || !s.running) {
      reset();
      return;
    }
    if (pausedRef.current) return;
    s.ballColor = (s.ballColor + 1) % 4;
    sfx(() => beep(520, 0.03, "sine", 0.05));
  }, [reset, sfx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyQ" && pausedRef.current) {
        e.preventDefault();
        quitToMenu();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        cycleColor();
      } else if (e.code === "KeyP" || e.code === "Escape") {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycleColor, togglePause, quitToMenu]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = (now: number) => {
      const rawDt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      const cb = settingsRef.current.colorblind;
      const reduced = settingsRef.current.reducedMotion;
      const shakeEnabled = settingsRef.current.shake && !reduced;
      const isPaused = pausedRef.current;
      const dt = isPaused ? 0 : rawDt;
      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0a0514");
      bg.addColorStop(1, "#1a0b2e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const shakeAmt = shakeEnabled ? s.shake : 0;
      const shakeX = shakeAmt > 0 ? (Math.random() - 0.5) * shakeAmt * 14 : 0;
      const shakeY = shakeAmt > 0 ? (Math.random() - 0.5) * shakeAmt * 14 : 0;
      ctx.save();
      ctx.translate(shakeX, shakeY);

      const tunnelW = Math.min(W * 0.9, 420);
      const tx = (W - tunnelW) / 2;
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fillRect(tx, 0, tunnelW, H);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.strokeRect(tx, 0, tunnelW, H);

      if (s.speedFlashTimer > 0 && !reduced) {
        const a = Math.min(1, s.speedFlashTimer) * 0.15;
        ctx.fillStyle = `rgba(250,204,21,${a})`;
        ctx.fillRect(tx, 0, tunnelW, H);
      }
      if (s.speedFlashTimer > 0) s.speedFlashTimer -= dt;

      const ballX = W / 2;
      const ballScreenY = H * 0.32;
      const ballRadius = 14;

      if (s.running && !s.over && !isPaused) {
        s.time += dt;

        if (s.mode !== "practice") {
          const newLevel = 1 + Math.floor(s.time / SPEED_STEP_INTERVAL);
          if (newLevel !== s.level) {
            s.level = newLevel;
            setLevel(newLevel);
            s.speedFlashTimer = 0.7;
            if (!settingsRef.current.reducedMotion) s.shake = Math.max(s.shake, 0.3);
            playSpeedUp();
          }
        }
        let speed: number;
        if (s.mode === "practice") {
          speed = 130;
        } else {
          speed = BASE_SPEED + (s.level - 1) * SPEED_PER_LEVEL;
          if (s.mode === "daily") {
            const seedPhase = (s.speedSeed % 1000) / 1000 * Math.PI * 2;
            const jitter = Math.sin(s.time * 0.9 + seedPhase) * 25
              + Math.sin(s.time * 0.31 + seedPhase * 1.7) * 18;
            speed += jitter;
          }
        }
        s.fallSpeed = speed;
        const remaining = SPEED_STEP_INTERVAL - (s.time % SPEED_STEP_INTERVAL);
        setNextSpeedIn(remaining);

        s.ballY += s.fallSpeed * dt;

        while (s.nextGateY < s.ballY + H) {
          s.gates.push(makeGate(s.nextGateY, s.level, s.rand));
          s.nextGateY += Math.max(160, 220 - s.level * 5);
        }
        for (const g of s.gates) g.rotation += g.spin * dt;
        s.gates = s.gates.filter((g) => g.y > s.ballY - 200);

        for (const g of s.gates) {
          if (g.passed) continue;
          const dist = g.y - s.ballY;
          if (dist > 0 && dist < 70) {
            const twoPi = Math.PI * 2;
            let a = -Math.PI / 2 - g.rotation;
            a = ((a % twoPi) + twoPi) % twoPi;
            const segIdx = Math.floor(a / (Math.PI / 2)) % 4;
            if (g.segments[segIdx] !== s.ballColor) {
              const proximity = 1 - dist / 70;
              if (proximity > 0.5 && s.nearMissGlow < proximity) {
                s.nearMissGlow = proximity;
              }
            }
          }
        }

        for (const g of s.gates) {
          if (!g.passed && g.y <= s.ballY) {
            g.passed = true;
            const twoPi = Math.PI * 2;
            let a = -Math.PI / 2 - g.rotation;
            a = ((a % twoPi) + twoPi) % twoPi;
            const segIdx = Math.floor(a / (Math.PI / 2)) % 4;
            const gateColor = g.segments[segIdx];
            if (gateColor === s.ballColor) {
              const gained = 1 + Math.floor(s.combo / 3);
              s.score += gained;
              s.combo += 1;
              s.passes += 1;
              const wasNearMiss = s.nearMissGlow > 0.5;
              if (wasNearMiss) {
                s.chain = 0;
              } else {
                s.chain += 1;
                if (s.chain > s.longestChain) {
                  s.longestChain = s.chain;
                  setLongestChain(s.longestChain);
                }
              }
              if (s.combo > s.peakCombo) {
                s.peakCombo = s.combo;
                setPeakCombo(s.peakCombo);
              }
              setScore(s.score);
              setCombo(s.combo);
              setPasses(s.passes);
              playPass(s.combo);
              const hit = MILESTONES.find((m) => m.combo === s.combo);
              if (hit) {
                playMilestone();
                if (!settingsRef.current.reducedMotion) {
                  s.shake = Math.max(s.shake, 0.4);
                  s.speedFlashTimer = Math.max(s.speedFlashTimer, 0.4);
                }
                showBadge(hit);
              }
              if (s.nearMissGlow > 0.6) {
                playNearMiss();
                if (!settingsRef.current.reducedMotion) s.shake = Math.max(s.shake, 0.25);
              }
              s.nearMissGlow = 0;
            } else {
              s.over = true;
              s.running = false;
              s.missFlash = 1;
              s.shake = settingsRef.current.reducedMotion ? 0 : 1;
              s.misses += 1;
              s.chain = 0;
              setMisses(s.misses);
              playCrash();
              let nb = false;
              try {
                if (s.mode === "classic") {
                  const prevBest = Number(localStorage.getItem("csr_best") || "0");
                  if (s.score > prevBest) {
                    localStorage.setItem("csr_best", String(s.score));
                    setBest(s.score);
                    nb = true;
                  }
                } else if (s.mode === "daily") {
                  const key = `csr_daily_${todayKey()}`;
                  const prev = Number(localStorage.getItem(key) || "0");
                  if (s.score > prev) {
                    localStorage.setItem(key, String(s.score));
                    setDailyBest(s.score);
                    nb = true;
                  }
                  setStreak(recordDailyPlay());
                }
                if (s.mode !== "practice") {
                  const prevBC = Number(localStorage.getItem("csr_bestCombo") || "0");
                  if (s.peakCombo > prevBC) {
                    localStorage.setItem("csr_bestCombo", String(s.peakCombo));
                    setBestCombo(s.peakCombo);
                  }
                }
              } catch {}
              setNewBest(nb);
              setGameOver(true);
              setRunning(false);
            }
          }
        }
      }

      s.shake = Math.max(0, s.shake - rawDt * 2);
      s.nearMissGlow = Math.max(0, s.nearMissGlow - rawDt * 0.5);

      const gateRadius = Math.min(tunnelW * 0.42, 170);
      const gateThickness = 22;
      for (const g of s.gates) {
        const screenY = ballScreenY + (g.y - s.ballY);
        if (screenY < -gateRadius || screenY > H + gateRadius) continue;
        ctx.save();
        ctx.translate(ballX, screenY);
        ctx.rotate(g.rotation);
        for (let i = 0; i < 4; i++) {
          const start = i * (Math.PI / 2) - Math.PI / 2;
          const end = start + Math.PI / 2;
          const colorDef = COLORS[g.segments[i]];
          const stroke = cb ? colorDef.cbCss : colorDef.css;
          ctx.beginPath();
          ctx.arc(0, 0, gateRadius, start, end);
          ctx.lineWidth = gateThickness;
          ctx.strokeStyle = stroke;
          ctx.shadowBlur = 10;
          ctx.shadowColor = stroke;
          ctx.stroke();
          if (cb) {
            const mid = (start + end) / 2;
            const sx = Math.cos(mid) * gateRadius;
            const sy = Math.sin(mid) * gateRadius;
            ctx.save();
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#0a0514";
            ctx.strokeStyle = "#0a0514";
            ctx.lineWidth = 3;
            ctx.font = "bold 18px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.translate(sx, sy);
            ctx.rotate(-g.rotation);
            ctx.strokeText(colorDef.symbol, 0, 0);
            ctx.fillText(colorDef.symbol, 0, 0);
            ctx.restore();
          }
        }
        ctx.restore();
        ctx.shadowBlur = 0;
      }

      if (s.nearMissGlow > 0 && !reduced) {
        const rr = ballRadius + 6 + s.nearMissGlow * 18;
        ctx.beginPath();
        ctx.arc(ballX, ballScreenY, rr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,80,80,${s.nearMissGlow})`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 25;
        ctx.shadowColor = "#ff2020";
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      const ballColorDef = COLORS[s.ballColor];
      const ballCss = cb ? ballColorDef.cbCss : ballColorDef.css;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ballX, ballScreenY, ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = ballCss;
      ctx.shadowBlur = reduced ? 6 : 20;
      ctx.shadowColor = ballCss;
      ctx.fill();
      if (cb) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#0a0514";
        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ballColorDef.symbol, ballX, ballScreenY + 1);
      }
      ctx.restore();

      ctx.restore();

      if (s.missFlash > 0) {
        const intensity = reduced ? 0.2 : 0.5;
        ctx.fillStyle = `rgba(255,60,60,${s.missFlash * intensity})`;
        ctx.fillRect(0, 0, W, H);
        s.missFlash -= rawDt * 1.5;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (badgeTimerRef.current) window.clearTimeout(badgeTimerRef.current);
    };
  }, [playPass, playCrash, playNearMiss, playSpeedUp, playMilestone, showBadge]);

  const topBadge = highestBadge(peakCombo);

  const generateShareImage = (): string => {
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 1080;
    const g = c.getContext("2d")!;
    const cb = settings.colorblind;

    const bg = g.createLinearGradient(0, 0, 1080, 1080);
    bg.addColorStop(0, "#0a0514");
    bg.addColorStop(1, "#2a0b4e");
    g.fillStyle = bg;
    g.fillRect(0, 0, 1080, 1080);

    COLORS.forEach((col, i) => {
      const cx = 540 + Math.cos((i / 4) * Math.PI * 2 - Math.PI / 2) * 380;
      const cy = 540 + Math.sin((i / 4) * Math.PI * 2 - Math.PI / 2) * 380;
      const fill = cb ? col.cbCss : col.css;
      g.beginPath();
      g.arc(cx, cy, 60, 0, Math.PI * 2);
      g.fillStyle = fill;
      g.shadowBlur = 60;
      g.shadowColor = fill;
      g.fill();
    });
    g.shadowBlur = 0;

    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.font = "bold 48px system-ui, sans-serif";
    g.fillText("COLOR SWITCH RUSH", 540, 170);

    g.font = "600 22px system-ui, sans-serif";
    g.fillStyle = mode === "daily" ? "#facc15" : "rgba(255,255,255,0.65)";
    const modeLine = mode === "daily"
      ? `DAILY CHALLENGE · ${todayKey()}`
      : mode === "practice"
        ? "PRACTICE MODE"
        : "ENDLESS MODE";
    g.fillText(modeLine, 540, 210);

    g.font = "600 24px system-ui, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.fillText("SCORE", 540, 370);

    g.fillStyle = "#ffffff";
    g.font = "bold 260px system-ui, sans-serif";
    g.fillText(String(score), 540, 610);

    g.font = "600 32px system-ui, sans-serif";
    g.fillStyle = "#facc15";
    g.fillText(`BEST COMBO x${peakCombo}`, 540, 680);

    // Highest badge earned
    if (topBadge) {
      const badgeText = `${topBadge.emoji}  ${topBadge.label.toUpperCase()}  ${topBadge.emoji}`;
      g.font = "bold 40px system-ui, sans-serif";
      const w = g.measureText(badgeText).width + 80;
      const bx = 540 - w / 2;
      const by = 730;
      const bh = 78;
      // pill background
      g.fillStyle = "rgba(250,204,21,0.15)";
      g.strokeStyle = "rgba(250,204,21,0.7)";
      g.lineWidth = 3;
      const r = bh / 2;
      g.beginPath();
      g.moveTo(bx + r, by);
      g.arcTo(bx + w, by, bx + w, by + bh, r);
      g.arcTo(bx + w, by + bh, bx, by + bh, r);
      g.arcTo(bx, by + bh, bx, by, r);
      g.arcTo(bx, by, bx + w, by, r);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = "#facc15";
      g.textBaseline = "middle";
      g.fillText(badgeText, 540, by + bh / 2 + 2);
      g.textBaseline = "alphabetic";
    }

    g.font = "500 22px system-ui, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.55)";
    const bestLine = mode === "daily"
      ? `Level ${level} · Today's best ${Math.max(dailyBest, score)}`
      : `Level ${level} reached · Best ${Math.max(best, score)}`;
    g.fillText(bestLine, 540, 860);

    g.font = "600 24px system-ui, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.fillText("Can you beat it?", 540, 970);

    return c.toDataURL("image/png");
  };

  const shareScore = async () => {
    const dataUrl = generateShareImage();
    const badgeText = topBadge ? ` · ${topBadge.emoji} ${topBadge.label}` : "";
    const modeText = mode === "daily"
      ? ` (Daily ${todayKey()})`
      : mode === "practice"
        ? " (Practice)"
        : " (Endless)";
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "color-switch-rush.png", { type: "image/png" });
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Color Switch Rush",
          text: `I scored ${score} with an x${peakCombo} combo${badgeText}${modeText}!`,
        });
        return;
      }
    } catch {}
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `color-switch-rush-${score}.png`;
    a.click();
  };

  const speedPct = Math.max(0, Math.min(1, 1 - nextSpeedIn / SPEED_STEP_INTERVAL));
  const earnedBadges = MILESTONES.filter((m) => peakCombo >= m.combo);
  const nextBadge = MILESTONES.find((m) => peakCombo < m.combo);

  const colorFor = (i: number) => (settings.colorblind ? COLORS[i].cbCss : COLORS[i].css);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0a0514] text-white select-none overflow-hidden">
      <div ref={wrapRef} className="relative w-full max-w-md aspect-[9/16] mx-auto shadow-2xl">
        <canvas
          ref={canvasRef}
          onClick={cycleColor}
          onTouchStart={(e) => {
            e.preventDefault();
            cycleColor();
          }}
          className="absolute inset-0 w-full h-full cursor-pointer touch-none"
        />

        {/* HUD */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50">
              {t.score} {mode === "daily" && <span className="text-yellow-300">· {t.modeDaily}</span>}
            </div>
            <div className="text-3xl font-bold tabular-nums">{score}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-white/50">{t.combo}</div>
            <div className={`text-3xl font-bold tabular-nums ${combo >= 5 ? "text-yellow-300" : ""}`}>

              x{combo}
            </div>
          </div>
        </div>

        {/* Pause button */}
        {running && !gameOver && (
          <button
            onClick={(e) => { e.stopPropagation(); togglePause(); }}
            aria-label={paused ? t.resume : t.paused}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 flex items-center justify-center text-white text-sm"
          >
            {paused ? "▶" : "❚❚"}
          </button>
        )}

        {running && !gameOver && mode !== "practice" && (
          <div className="pointer-events-none absolute top-20 left-4 right-4 z-10">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-white/60 mb-1">
              <span>{t.level} {level}</span>
              <span className={nextSpeedIn < 1.5 ? "text-yellow-300 animate-pulse" : ""}>
                {t.speedUpIn} {nextSpeedIn.toFixed(1)}s

              </span>
            </div>
            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-100 ${
                  nextSpeedIn < 1.5
                    ? "bg-yellow-300 shadow-[0_0_10px_rgba(250,204,21,0.8)]"
                    : "bg-white/60"
                }`}
                style={{ width: `${speedPct * 100}%` }}
              />
            </div>
          </div>
        )}

        {running && !gameOver && mode === "practice" && (
          <div className="pointer-events-none absolute top-20 left-0 right-0 text-center text-[10px] uppercase tracking-widest text-cyan-300/80">
            {t.practiceHint}
          </div>
        )}

        <div className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-xs text-white/40 tracking-wider">
          {mode === "daily"
            ? <>{t.todaysBest} {dailyBest} · {t.allTime} x{bestCombo}</>
            : mode === "practice"
              ? <>{t.practiceComplete}</>
              : <>{t.best} {best} · {t.bestCombo} x{bestCombo}</>}
        </div>


        {/* Live milestone badge popup */}
        {badgePopup && (
          <div className="pointer-events-none absolute inset-x-0 top-32 z-30 flex justify-center">
            <div
              key={badgePopup.combo}
              className="px-5 py-2.5 rounded-full bg-gradient-to-br from-yellow-300 to-pink-500 text-black font-black text-sm shadow-[0_0_40px_rgba(250,204,21,0.6)] animate-fade-in flex items-center gap-2"
            >
              <span className="text-lg">{badgePopup.emoji}</span>
              <span>x{badgePopup.combo} {badgePopup.label}</span>
            </div>
          </div>
        )}

        {/* Pause overlay */}
        {paused && running && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-40 animate-fade-in px-6">
            <div className="text-xs uppercase tracking-widest text-white/50 mb-2">{t.paused}</div>
            <div className="text-4xl font-black mb-6">❚❚</div>
            <div className="flex flex-col gap-2 w-full max-w-[220px]">
              <button
                onClick={togglePause}
                className="px-8 py-3 rounded-full bg-white text-black font-black text-sm uppercase tracking-widest hover:scale-105 transition-transform"
              >
                {t.resume}
              </button>
              <button
                onClick={quitToMenu}
                className="px-8 py-3 rounded-full border border-white/30 text-white/90 font-black text-sm uppercase tracking-widest hover:bg-white/10 transition"
              >
                {t.quitRun}
              </button>
            </div>
            <div className="text-white/40 text-[10px] mt-5 space-y-0.5 text-center">
              <div><b className="text-white/60">P / Esc</b> — {t.quitHint}</div>
              <div>{t.quitDiscards}</div>
            </div>

          </div>
        )}

        {/* Start screen */}
        {!running && !gameOver && !showSettings && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20 animate-fade-in px-6 overflow-y-auto py-6">
            <h1 className="text-4xl font-black tracking-tight mb-1 text-center">{t.title}</h1>
            <p className="text-white/50 text-xs uppercase tracking-[0.3em] mb-4">{t.tagline}</p>

            {streak > 0 && (
              <div className="mb-4 px-3 py-1.5 rounded-full bg-orange-500/15 border border-orange-400/40 flex items-center gap-1.5 text-xs font-bold text-orange-200">
                <span>🔥</span>
                <span>{t.streakDays(streak)}</span>
                <span className="text-orange-200/60 font-medium">· {t.streakKeep}</span>
              </div>
            )}

            <div className="flex gap-3 mb-4">
              {COLORS.map((c, i) => (
                <div
                  key={c.name}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[#0a0514] font-black"
                  style={{ background: colorFor(i), boxShadow: `0 0 14px ${colorFor(i)}` }}
                >
                  {settings.colorblind ? c.symbol : ""}
                </div>
              ))}
            </div>

            <div className="mb-4 w-full max-w-[260px] space-y-1.5 text-sm">
              <div className="flex items-center gap-3 text-white/80">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white/10 text-xs font-bold">👆</span>
                <span><b>Tap / Click / Space</b> — {t.cycleColor}</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white/10 text-[10px] font-bold">P</span>
                <span>{t.pauseResumeAnytime}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full max-w-[260px] mb-3">
              <button
                onClick={() => reset("classic")}
                className="px-8 py-3.5 rounded-full bg-white text-black font-black text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              >
                {t.playEndless}
              </button>
              <button
                onClick={() => reset("daily")}
                className="px-8 py-3 rounded-full bg-gradient-to-r from-yellow-300 to-pink-500 text-black font-black text-sm uppercase tracking-widest hover:scale-105 transition-transform"
              >
                {t.playDaily}
              </button>
              <button
                onClick={() => reset("practice")}
                className="px-8 py-2.5 rounded-full border border-cyan-300/50 text-cyan-100 font-bold text-xs uppercase tracking-widest hover:bg-cyan-300/10 transition"
              >
                {t.playPractice}
              </button>
            </div>

            <div className="text-[10px] text-white/40 uppercase tracking-widest text-center mb-3">
              <div>{t.modeEndless} {t.best}: {best} · x{bestCombo}</div>
              <div>{t.todaysBest}: {dailyBest} <span className="opacity-60">({todayKey()})</span></div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettings(true)}
                className="text-white/60 hover:text-white text-xs uppercase tracking-widest"
              >
                ⚙ {t.settings}
              </button>
              <span className="text-white/20">·</span>
              <button
                onClick={() => setShowDebug(true)}
                className="text-white/40 hover:text-white text-[10px] uppercase tracking-widest"
              >
                🔧 {t.debugPanel}
              </button>
            </div>
          </div>

        )}

        {/* Settings */}
        {showSettings && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm z-30 animate-fade-in px-6">
            <h2 className="text-2xl font-black tracking-tight mb-6">{t.settings}</h2>
            <div className="w-full max-w-[280px] space-y-3 mb-6">
              {([
                { key: "sound", label: t.sound, desc: t.soundDesc },
                { key: "shake", label: t.shake, desc: t.shakeDesc },
                { key: "reducedMotion", label: t.reducedMotion, desc: t.reducedMotionDesc },
                { key: "colorblind", label: t.colorblind, desc: t.colorblindDesc },
              ] as const).map((row) => {

                const on = settings[row.key];
                return (
                  <button
                    key={row.key}
                    onClick={() => updateSetting({ [row.key]: !on } as Partial<Settings>)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition text-left"
                  >
                    <div>
                      <div className="text-sm font-bold">{row.label}</div>
                      <div className="text-xs text-white/50">{row.desc}</div>
                    </div>
                    <div
                      className={`w-11 h-6 rounded-full relative transition ${on ? "bg-yellow-300" : "bg-white/20"}`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-black transition-all ${on ? "left-[22px]" : "left-0.5"}`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="px-8 py-3 rounded-full bg-white text-black font-bold text-sm uppercase tracking-widest hover:scale-105 transition-transform"
            >
              {t.done}
            </button>

          </div>
        )}

        {/* Game over */}
        {gameOver && !showSettings && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm z-20 animate-fade-in px-6 overflow-y-auto py-6">
            <div className="text-xs uppercase tracking-widest text-white/50 mb-1">
              {mode === "daily"
                ? `Daily · ${todayKey()}`
                : mode === "practice"
                  ? "Practice Run"
                  : "Endless · Game Over"}
            </div>
            <div className="text-6xl font-black tabular-nums mb-1">{score}</div>
            <div className="text-white/60 mb-1">Peak combo x{peakCombo}</div>
            {mode !== "practice" && (
              <div className="text-white/40 text-xs mb-3">Reached level {level}</div>
            )}
            {mode === "practice" && (
              <div className="text-cyan-300/70 text-xs mb-3">Warm-up complete · scores not saved</div>
            )}

            {mode === "daily" && streak > 0 && (
              <div className="mb-3 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-400/40 text-xs font-bold text-orange-200 flex items-center gap-1.5">
                <span>🔥</span>
                <span>{streak}-day streak</span>
              </div>
            )}

            {mode !== "practice" && (newBest ? (
              <div className="text-yellow-300 text-sm font-black uppercase tracking-widest mb-3 animate-pulse">
                ★ {mode === "daily" ? "New daily best" : "New best score"} ★
              </div>
            ) : (
              <div className="text-white/50 text-xs mb-3">
                {mode === "daily" ? `Today's best ${dailyBest}` : `Best ${best}`} · x{bestCombo} combo
              </div>
            ))}

            {/* Run summary */}
            <div className="w-full max-w-[300px] mb-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-center">
                <div className="text-[9px] uppercase tracking-widest text-white/50">Best combo</div>
                <div className="text-lg font-black tabular-nums">x{peakCombo}</div>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-center">
                <div className="text-[9px] uppercase tracking-widest text-white/50">Perfect chain</div>
                <div className="text-lg font-black tabular-nums">{longestChain}</div>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-center">
                <div className="text-[9px] uppercase tracking-widest text-white/50">Pass / Miss</div>
                <div className="text-lg font-black tabular-nums">
                  <span className="text-emerald-300">{passes}</span>
                  <span className="text-white/30">/</span>
                  <span className="text-rose-300">{misses}</span>
                </div>
              </div>
            </div>

            {earnedBadges.length > 0 && (
              <div className="w-full max-w-[300px] mb-4">
                <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2 text-center">
                  Combo Badges Earned
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {earnedBadges.map((b) => (
                    <div
                      key={b.combo}
                      className="px-3 py-1.5 rounded-full bg-gradient-to-br from-yellow-300/20 to-pink-400/20 border border-yellow-300/40 text-xs font-bold flex items-center gap-1.5"
                    >
                      <span>{b.emoji}</span>
                      <span>x{b.combo}</span>
                      <span className="text-white/70 font-medium">{b.label}</span>
                    </div>
                  ))}
                </div>
                {nextBadge && (
                  <div className="text-[10px] text-white/40 text-center mt-2">
                    Next: x{nextBadge.combo} {nextBadge.label} — {nextBadge.combo - peakCombo} to go
                  </div>
                )}
              </div>
            )}

            {earnedBadges.length === 0 && nextBadge && (
              <div className="text-[10px] text-white/40 mb-4">
                Chain x{nextBadge.combo} for your first badge
              </div>
            )}

            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() => reset(mode)}
                className="px-6 py-3 rounded-full bg-white text-black font-bold text-sm uppercase tracking-widest hover:scale-105 transition-transform"
              >
                Play again
              </button>
              <button
                onClick={() => { setGameOver(false); setRunning(false); stateRef.current.running = false; stateRef.current.over = false; }}
                className="px-4 py-3 rounded-full border border-white/20 text-white/70 font-bold text-sm uppercase tracking-widest hover:bg-white/10 transition"
              >
                Menu
              </button>
              <button
                onClick={shareScore}
                className="px-6 py-3 rounded-full border border-white/40 text-white font-bold text-sm uppercase tracking-widest hover:bg-white/10 transition"
              >
                Share
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-3 rounded-full border border-white/20 text-white/70 font-bold text-sm uppercase tracking-widest hover:bg-white/10 transition"
              >
                ⚙
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
