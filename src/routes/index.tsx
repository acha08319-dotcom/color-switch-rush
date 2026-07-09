import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

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

type Gate = {
  y: number;
  rotation: number;
  spin: number; // rad/sec
  segments: number[]; // color indices, length 4
  passed: boolean;
};

function makeGate(y: number, difficulty: number): Gate {
  // shuffle colors
  const segs = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const spin = (0.6 + Math.random() * 0.8 + difficulty * 0.35) * (Math.random() < 0.5 ? -1 : 1);
  return {
    y,
    rotation: Math.random() * Math.PI * 2,
    spin,
    segments: segs,
    passed: false,
  };
}

function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [running, setRunning] = useState(false);

  const stateRef = useRef({
    ballColor: 0,
    ballY: 0,
    fallSpeed: 180,
    gates: [] as Gate[],
    nextGateY: 0,
    time: 0,
    score: 0,
    combo: 0,
    over: false,
    running: false,
    lastMissFlash: 0,
  });

  useEffect(() => {
    try {
      const b = Number(localStorage.getItem("csr_best") || "0");
      const c = Number(localStorage.getItem("csr_bestCombo") || "0");
      setBest(b);
      setBestCombo(c);
    } catch {}
  }, []);

  const reset = () => {
    const s = stateRef.current;
    s.ballColor = Math.floor(Math.random() * 4);
    s.ballY = 0;
    s.fallSpeed = 180;
    s.gates = [];
    s.nextGateY = 320;
    s.time = 0;
    s.score = 0;
    s.combo = 0;
    s.over = false;
    s.running = true;
    s.lastMissFlash = 0;
    setScore(0);
    setCombo(0);
    setGameOver(false);
    setRunning(true);
  };

  const cycleColor = () => {
    const s = stateRef.current;
    if (s.over) {
      reset();
      return;
    }
    if (!s.running) {
      reset();
      return;
    }
    s.ballColor = (s.ballColor + 1) % 4;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        cycleColor();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

      // Tunnel walls (subtle)
      const tunnelW = Math.min(W * 0.9, 420);
      const tx = (W - tunnelW) / 2;
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fillRect(tx, 0, tunnelW, H);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.strokeRect(tx, 0, tunnelW, H);

      const ballX = W / 2;
      const ballScreenY = H * 0.28;
      const ballRadius = 14;

      if (s.running && !s.over) {
        s.time += dt;
        // difficulty ramp
        const difficulty = s.time / 15;
        s.fallSpeed = 180 + s.time * 8;

        s.ballY += s.fallSpeed * dt;

        // spawn gates
        while (s.nextGateY < s.ballY + H) {
          s.gates.push(makeGate(s.nextGateY, difficulty));
          s.nextGateY += 220;
        }

        // update gates
        for (const g of s.gates) {
          g.rotation += g.spin * dt;
        }

        // remove old
        s.gates = s.gates.filter((g) => g.y > s.ballY - 200);

        // collision - when ball crosses gate line
        for (const g of s.gates) {
          if (!g.passed && g.y <= s.ballY) {
            g.passed = true;
            // determine which segment the ball (top, angle 0 relative to gate center? ball is at center X)
            // The gate is a ring around ball at that moment; ball is at center. So we need which color segment is "at" the ball entry point.
            // Instead: ball enters from top of gate. Angle at top = -PI/2. Segment index = floor(((angle - rot) mod 2pi) / (pi/2))
            const twoPi = Math.PI * 2;
            const segAngle = Math.PI / 2;
            let a = -Math.PI / 2 - g.rotation;
            a = ((a % twoPi) + twoPi) % twoPi;
            const segIdx = Math.floor(a / segAngle) % 4;
            const gateColor = g.segments[segIdx];
            if (gateColor === s.ballColor) {
              s.score += 1 + Math.floor(s.combo / 3);
              s.combo += 1;
              setScore(s.score);
              setCombo(s.combo);
            } else {
              s.over = true;
              s.running = false;
              s.lastMissFlash = 1;
              try {
                if (s.score > Number(localStorage.getItem("csr_best") || "0")) {
                  localStorage.setItem("csr_best", String(s.score));
                  setBest(s.score);
                }
                if (s.combo > Number(localStorage.getItem("csr_bestCombo") || "0")) {
                  localStorage.setItem("csr_bestCombo", String(s.combo));
                  setBestCombo(s.combo);
                }
              } catch {}
              setGameOver(true);
              setRunning(false);
            }
          }
        }
      }

      // Draw gates
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
          ctx.stroke();
          // glow
          ctx.shadowBlur = 12;
          ctx.shadowColor = COLORS[g.segments[i]].css;
        }
        ctx.restore();
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

      // miss flash
      if (s.lastMissFlash > 0) {
        ctx.fillStyle = `rgba(255,60,60,${s.lastMissFlash * 0.4})`;
        ctx.fillRect(0, 0, W, H);
        s.lastMissFlash -= dt * 2;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0a0514] text-white select-none overflow-hidden">
      <div className="relative w-full max-w-md aspect-[9/16] mx-auto shadow-2xl">
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
        <div className="pointer-events-none absolute top-0 left-0 right-0 p-4 flex justify-between items-start">
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

        <div className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-xs text-white/40 tracking-wider">
          Best {best} · Best combo x{bestCombo}
        </div>

        {!running && !gameOver && (
          <div
            onClick={cycleColor}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
          >
            <h1 className="text-4xl font-black tracking-tight mb-2">Color Switch Rush</h1>
            <p className="text-white/60 text-sm mb-6 max-w-[80%] text-center">
              Match the gate's color before you crash through.
              <br />
              Tap / click / space to cycle color.
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
            <button className="px-6 py-3 rounded-full bg-white text-black font-bold text-sm uppercase tracking-widest">
              Tap to start
            </button>
          </div>
        )}

        {gameOver && (
          <div
            onClick={cycleColor}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer animate-fade-in"
          >
            <div className="text-xs uppercase tracking-widest text-white/50 mb-1">Game Over</div>
            <div className="text-6xl font-black tabular-nums mb-1">{score}</div>
            <div className="text-white/60 mb-6">Combo peaked at x{combo}</div>
            {score >= best && score > 0 && (
              <div className="text-yellow-300 text-sm font-bold mb-4 animate-pulse">
                NEW BEST!
              </div>
            )}
            <button className="px-6 py-3 rounded-full bg-white text-black font-bold text-sm uppercase tracking-widest">
              Tap to retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
