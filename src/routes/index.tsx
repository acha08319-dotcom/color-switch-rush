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

const COLORS = [
  { name: "pink", css: "#ff3b8b" },
  { name: "cyan", css: "#22d3ee" },
  { name: "yellow", css: "#facc15" },
  { name: "violet", css: "#a855f7" },
];

const SPEED_STEP_INTERVAL = 6; // seconds between speed ups
const BASE_SPEED = 180;
const SPEED_PER_LEVEL = 55;

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
function playPass(combo: number) {
  beep(440 + Math.min(combo, 20) * 40, 0.12, "triangle", 0.12);
}
function playNearMiss() {
  beep(880, 0.06, "square", 0.08);
  setTimeout(() => beep(660, 0.05, "square", 0.06), 40);
}
function playCrash() {
  beep(180, 0.3, "sawtooth", 0.2);
  setTimeout(() => beep(90, 0.4, "sawtooth", 0.18), 60);
}
function playSpeedUp() {
  beep(300, 0.08, "square", 0.1);
  setTimeout(() => beep(500, 0.08, "square", 0.1), 80);
  setTimeout(() => beep(700, 0.12, "square", 0.1), 160);
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

  const stateRef = useRef({
    ballColor: 0,
    ballY: 0,
    fallSpeed: BASE_SPEED,
    gates: [] as Gate[],
    nextGateY: 0,
    time: 0,
    score: 0,
    combo: 0,
    over: false,
    running: false,
    missFlash: 0,
    nearMissGlow: 0,
    shake: 0,
    level: 1,
    speedFlashTimer: 0,
  });

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("csr_best") || "0"));
      setBestCombo(Number(localStorage.getItem("csr_bestCombo") || "0"));
    } catch {}
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
    s.over = false;
    s.running = true;
    s.missFlash = 0;
    s.nearMissGlow = 0;
    s.shake = 0;
    s.level = 1;
    s.speedFlashTimer = 0;
    setScore(0);
    setCombo(0);
    setLevel(1);
    setNextSpeedIn(SPEED_STEP_INTERVAL);
    setGameOver(false);
    setRunning(true);
    setNewBest(false);
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
    beep(520, 0.03, "sine", 0.05);
  }, [reset]);

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
      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0a0514");
      bg.addColorStop(1, "#1a0b2e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Shake
      const shakeX = s.shake > 0 ? (Math.random() - 0.5) * s.shake * 14 : 0;
      const shakeY = s.shake > 0 ? (Math.random() - 0.5) * s.shake * 14 : 0;
      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Tunnel
      const tunnelW = Math.min(W * 0.9, 420);
      const tx = (W - tunnelW) / 2;
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fillRect(tx, 0, tunnelW, H);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.strokeRect(tx, 0, tunnelW, H);

      // Speed-up flash
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

        // level / speed ramp
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

        // near-miss check: any gate within a small band above the ball where currently ball color isn't matching the segment at top - warn
        for (const g of s.gates) {
          if (g.passed) continue;
          const dist = g.y - s.ballY;
          if (dist > 0 && dist < 70) {
            const twoPi = Math.PI * 2;
            let a = -Math.PI / 2 - g.rotation;
            a = ((a % twoPi) + twoPi) % twoPi;
            const segIdx = Math.floor(a / (Math.PI / 2)) % 4;
            if (g.segments[segIdx] !== s.ballColor) {
              // getting close & still wrong
              const proximity = 1 - dist / 70;
              if (proximity > 0.5 && s.nearMissGlow < proximity) {
                s.nearMissGlow = proximity;
              }
            }
          }
        }

        // collision
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
              setScore(s.score);
              setCombo(s.combo);
              playPass(s.combo);
              // if we were near-missing, upgrade sound
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
                if (s.combo > prevBC) {
                  localStorage.setItem("csr_bestCombo", String(s.combo));
                  setBestCombo(s.combo);
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

      // Gates
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
          ctx.beginPath();
          ctx.arc(0, 0, gateRadius, start, end);
          ctx.lineWidth = gateThickness;
          ctx.strokeStyle = COLORS[g.segments[i]].css;
          ctx.shadowBlur = 10;
          ctx.shadowColor = COLORS[g.segments[i]].css;
          ctx.stroke();
        }
        ctx.restore();
        ctx.shadowBlur = 0;
      }

      // Near-miss glow ring around ball
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

      // Ball
      ctx.save();
      ctx.beginPath();
      ctx.arc(ballX, ballScreenY, ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[s.ballColor].css;
      ctx.shadowBlur = 20;
      ctx.shadowColor = COLORS[s.ballColor].css;
      ctx.fill();
      ctx.restore();

      ctx.restore(); // shake

      // miss flash overlay (no shake)
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
  }, []);

  // Share image generation
  const generateShareImage = (): string => {
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 1080;
    const g = c.getContext("2d")!;

    // background
    const bg = g.createLinearGradient(0, 0, 1080, 1080);
    bg.addColorStop(0, "#0a0514");
    bg.addColorStop(1, "#2a0b4e");
    g.fillStyle = bg;
    g.fillRect(0, 0, 1080, 1080);

    // color dots
    COLORS.forEach((col, i) => {
      const cx = 540 + Math.cos((i / 4) * Math.PI * 2 - Math.PI / 2) * 380;
      const cy = 540 + Math.sin((i / 4) * Math.PI * 2 - Math.PI / 2) * 380;
      g.beginPath();
      g.arc(cx, cy, 60, 0, Math.PI * 2);
      g.fillStyle = col.css;
      g.shadowBlur = 60;
      g.shadowColor = col.css;
      g.fill();
    });
    g.shadowBlur = 0;

    // title
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
    g.fillText(`COMBO x${combo}`, 540, 700);

    g.font = "500 22px system-ui, sans-serif";
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.fillText(`Level ${level} reached · Best ${best}`, 540, 760);

    // footer
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
          text: `I scored ${score} with an x${combo} combo in Color Switch Rush!`,
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

        {/* Speed level indicator */}
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
        {!running && !gameOver && (
          <div
            onClick={cycleColor}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer z-20 animate-fade-in"
          >
            <h1 className="text-4xl font-black tracking-tight mb-2">Color Switch Rush</h1>
            <p className="text-white/60 text-sm mb-6 max-w-[80%] text-center leading-relaxed">
              Match the gate's color before you crash through.
              <br />
              Tap · click · space to cycle color.
            </p>
            <div className="flex gap-2 mb-6">
              {COLORS.map((c) => (
                <div
                  key={c.name}
                  className="w-6 h-6 rounded-full"
                  style={{ background: c.css, boxShadow: `0 0 12px ${c.css}` }}
                />
              ))}
            </div>
            <div className="text-xs uppercase tracking-widest text-white/50 mb-1">Best</div>
            <div className="text-2xl font-bold tabular-nums mb-6">
              {best} <span className="text-white/40 text-sm font-normal">· x{bestCombo} combo</span>
            </div>
            <button className="px-8 py-3 rounded-full bg-white text-black font-bold text-sm uppercase tracking-widest hover:scale-105 transition-transform">
              Tap to start
            </button>
          </div>
        )}

        {/* Game over */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20 animate-fade-in px-6">
            <div className="text-xs uppercase tracking-widest text-white/50 mb-1">Game Over</div>
            <div className="text-6xl font-black tabular-nums mb-1">{score}</div>
            <div className="text-white/60 mb-2">Combo peaked at x{combo}</div>
            <div className="text-white/40 text-xs mb-4">Reached level {level}</div>

            {newBest ? (
              <div className="text-yellow-300 text-sm font-black uppercase tracking-widest mb-5 animate-pulse">
                ★ New best score ★
              </div>
            ) : (
              <div className="text-white/50 text-xs mb-5">
                Best {best} · x{bestCombo} combo
              </div>
            )}

            <div className="flex gap-3">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
