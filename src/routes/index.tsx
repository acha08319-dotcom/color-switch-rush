import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";

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

const MILESTONES: { combo: number; label: string; emoji: string }[] = [
  { combo: 5,   label: "Warmed Up",     emoji: "🔥" },
  { combo: 10,  label: "On Fire",       emoji: "🔥" },
  { combo: 25,  label: "Unstoppable",   emoji: "⚡" },
  { combo: 50,  label: "Legendary",     emoji: "💎" },
  { combo: 100, label: "Godlike",       emoji: "👑" },
];

type Gate = {
  y: number;
  rotation: number;
  spin: number;
  segments: number[];
  passed: boolean;
};

function makeGate(y: number, level: number): Gate {
  const segs = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const spinBase = 0.55 + Math.random() * 0.7 + level * 0.18;
  const spin = spinBase * (Math.random() < 0.5 ? -1 : 1);
  return { y, rotation: Math.random() * Math.PI * 2, spin, segments: segs, passed: false };
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
};

const DEFAULT_SETTINGS: Settings = { sound: true, shake: true, colorblind: false };

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem("csr_settings");
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [level, setLevel] = useState(1);
  const [nextSpeedIn, setNextSpeedIn] = useState(SPEED_STEP_INTERVAL);
  const [newBest, setNewBest] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [peakCombo, setPeakCombo] = useState(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

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

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("csr_best") || "0"));
      setBestCombo(Number(localStorage.getItem("csr_bestCombo") || "0"));
    } catch {}
    setSettings(loadSettings());
  }, []);

  const updateSetting = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem("csr_settings", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const s = stateRef.current;
    s.ballColor = Math.floor(Math.random() * 4);
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
    setScore(0);
    setCombo(0);
    setPeakCombo(0);
    setLevel(1);
    setNextSpeedIn(SPEED_STEP_INTERVAL);
    setGameOver(false);
    setRunning(true);
    setNewBest(false);
    setShowSettings(false);
    getAudio()?.resume();
  }, []);

  const cycleColor = useCallback(() => {
    getAudio()?.resume();
    const s = stateRef.current;
    if (s.over || !s.running) {
      reset();
      return;
    }
    s.ballColor = (s.ballColor + 1) % 4;
    sfx(() => beep(520, 0.03, "sine", 0.05));
  }, [reset, sfx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        cycleColor();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycleColor]);

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
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      const cb = settingsRef.current.colorblind;
      const shakeEnabled = settingsRef.current.shake;
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

      if (s.speedFlashTimer > 0) {
        const a = Math.min(1, s.speedFlashTimer) * 0.15;
        ctx.fillStyle = `rgba(250,204,21,${a})`;
        ctx.fillRect(tx, 0, tunnelW, H);
        s.speedFlashTimer -= dt;
      }

      const ballX = W / 2;
      const ballScreenY = H * 0.32;
      const ballRadius = 14;

      if (s.running && !s.over) {
        s.time += dt;

        const newLevel = 1 + Math.floor(s.time / SPEED_STEP_INTERVAL);
        if (newLevel !== s.level) {
          s.level = newLevel;
          setLevel(newLevel);
          s.speedFlashTimer = 0.7;
          s.shake = Math.max(s.shake, 0.3);
          playSpeedUp();
        }
        s.fallSpeed = BASE_SPEED + (s.level - 1) * SPEED_PER_LEVEL;
        const remaining = SPEED_STEP_INTERVAL - (s.time % SPEED_STEP_INTERVAL);
        setNextSpeedIn(remaining);

        s.ballY += s.fallSpeed * dt;

        while (s.nextGateY < s.ballY + H) {
          s.gates.push(makeGate(s.nextGateY, s.level));
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
              if (s.combo > s.peakCombo) {
                s.peakCombo = s.combo;
                setPeakCombo(s.peakCombo);
              }
              setScore(s.score);
              setCombo(s.combo);
              playPass(s.combo);
              if (MILESTONES.some((m) => m.combo === s.combo)) {
                playMilestone();
                s.shake = Math.max(s.shake, 0.4);
                s.speedFlashTimer = Math.max(s.speedFlashTimer, 0.4);
              }
              if (s.nearMissGlow > 0.6) {
                playNearMiss();
                s.shake = Math.max(s.shake, 0.25);
              }
              s.nearMissGlow = 0;
            } else {
              s.over = true;
              s.running = false;
              s.missFlash = 1;
              s.shake = 1;
              playCrash();
              let nb = false;
              try {
                const prevBest = Number(localStorage.getItem("csr_best") || "0");
                if (s.score > prevBest) {
                  localStorage.setItem("csr_best", String(s.score));
                  setBest(s.score);
                  nb = true;
                }
                const prevBC = Number(localStorage.getItem("csr_bestCombo") || "0");
                if (s.peakCombo > prevBC) {
                  localStorage.setItem("csr_bestCombo", String(s.peakCombo));
                  setBestCombo(s.peakCombo);
                }
              } catch {}
              setNewBest(nb);
              setGameOver(true);
              setRunning(false);
            }
          }
        }
      }

      s.shake = Math.max(0, s.shake - dt * 2);
      s.nearMissGlow = Math.max(0, s.nearMissGlow - dt * 0.5);

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
            // Draw symbol on segment midpoint
            const mid = (start + end) / 2;
            const sx = Math.cos(mid) * gateRadius;
            const sy = Math.sin(mid) * gateRadius;
            ctx.save();
            ctx.rotate(0);
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

      if (s.nearMissGlow > 0) {
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
      ctx.shadowBlur = 20;
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
        ctx.fillStyle = `rgba(255,60,60,${s.missFlash * 0.5})`;
        ctx.fillRect(0, 0, W, H);
        s.missFlash -= dt * 1.5;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [playPass, playCrash, playNearMiss, playSpeedUp, playMilestone]);

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
    g.fillText("COLOR SWITCH RUSH", 540, 180);

    g.font = "600 24px system-ui, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.fillText("SCORE", 540, 380);

    g.fillStyle = "#ffffff";
    g.font = "bold 260px system-ui, sans-serif";
    g.fillText(String(score), 540, 620);

    g.font = "600 32px system-ui, sans-serif";
    g.fillStyle = "#facc15";
    g.fillText(`BEST COMBO x${peakCombo}`, 540, 700);

    g.font = "500 22px system-ui, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.fillText(`Level ${level} reached · Best ${best}`, 540, 760);

    g.font = "600 24px system-ui, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.fillText("Can you beat it?", 540, 960);

    return c.toDataURL("image/png");
  };

  const shareScore = async () => {
    const dataUrl = generateShareImage();
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "color-switch-rush.png", { type: "image/png" });
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Color Switch Rush",
          text: `I scored ${score} with an x${peakCombo} combo in Color Switch Rush!`,
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
            <div className="text-xs uppercase tracking-widest text-white/50">Score</div>
            <div className="text-3xl font-bold tabular-nums">{score}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-white/50">Combo</div>
            <div className={`text-3xl font-bold tabular-nums ${combo >= 5 ? "text-yellow-300" : ""}`}>
              x{combo}
            </div>
          </div>
        </div>

        {running && !gameOver && (
          <div className="pointer-events-none absolute top-20 left-4 right-4 z-10">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-white/60 mb-1">
              <span>Level {level}</span>
              <span className={nextSpeedIn < 1.5 ? "text-yellow-300 animate-pulse" : ""}>
                Speed up in {nextSpeedIn.toFixed(1)}s
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

        <div className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-xs text-white/40 tracking-wider">
          Best {best} · Best combo x{bestCombo}
        </div>

        {/* Start screen */}
        {!running && !gameOver && !showSettings && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20 animate-fade-in px-6">
            <h1 className="text-4xl font-black tracking-tight mb-1 text-center">Color Switch Rush</h1>
            <p className="text-white/50 text-xs uppercase tracking-[0.3em] mb-6">Match · Thread · Combo</p>

            <div className="flex gap-3 mb-6">
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

            <div className="mb-6 w-full max-w-[260px] space-y-2 text-sm">
              <div className="flex items-center gap-3 text-white/80">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white/10 text-xs font-bold">👆</span>
                <span><b>Tap</b> anywhere to cycle color</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white/10 text-xs font-bold">🖱</span>
                <span><b>Click</b> to cycle color</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white/10 text-[10px] font-bold px-1">SPACE</span>
                <span>on keyboard</span>
              </div>
              <p className="text-white/50 text-xs pt-2 text-center">
                Thread the segment matching your ball. Chain hits to build a combo.
              </p>
            </div>

            <div className="text-xs uppercase tracking-widest text-white/50 mb-1">Best</div>
            <div className="text-xl font-bold tabular-nums mb-5">
              {best} <span className="text-white/40 text-sm font-normal">· x{bestCombo} combo</span>
            </div>

            <button
              onClick={reset}
              className="px-10 py-4 rounded-full bg-white text-black font-black text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              ▶ Play
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="mt-4 text-white/60 hover:text-white text-xs uppercase tracking-widest"
            >
              ⚙ Settings
            </button>
          </div>
        )}

        {/* Settings */}
        {showSettings && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm z-30 animate-fade-in px-6">
            <h2 className="text-2xl font-black tracking-tight mb-6">Settings</h2>
            <div className="w-full max-w-[280px] space-y-3 mb-6">
              {([
                { key: "sound", label: "Sound", desc: "Beeps & feedback tones" },
                { key: "shake", label: "Screen shake", desc: "Rumble on near-miss & crash" },
                { key: "colorblind", label: "Colorblind mode", desc: "Distinct hues + shape symbols" },
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
              Done
            </button>
          </div>
        )}

        {/* Game over */}
        {gameOver && !showSettings && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm z-20 animate-fade-in px-6 overflow-y-auto py-6">
            <div className="text-xs uppercase tracking-widest text-white/50 mb-1">Game Over</div>
            <div className="text-6xl font-black tabular-nums mb-1">{score}</div>
            <div className="text-white/60 mb-1">Peak combo x{peakCombo}</div>
            <div className="text-white/40 text-xs mb-3">Reached level {level}</div>

            {newBest ? (
              <div className="text-yellow-300 text-sm font-black uppercase tracking-widest mb-3 animate-pulse">
                ★ New best score ★
              </div>
            ) : (
              <div className="text-white/50 text-xs mb-3">
                Best {best} · x{bestCombo} combo
              </div>
            )}

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
                onClick={reset}
                className="px-6 py-3 rounded-full bg-white text-black font-bold text-sm uppercase tracking-widest hover:scale-105 transition-transform"
              >
                Play again
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
