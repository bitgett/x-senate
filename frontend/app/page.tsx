"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

// ─── Particle canvas ───────────────────────────────────────────────────────────
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    type P = { x: number; y: number; vx: number; vy: number; r: number; alpha: number; hue: number };
    const particles: P[] = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.6 + 0.1,
      hue: Math.random() > 0.6 ? 220 : 270, // blue or purple
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${p.alpha})`;
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.12 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

// ─── Scroll reveal hook ────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

// ─── Reveal wrapper ────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── 3D tilt card ─────────────────────────────────────────────────────────────
function TiltCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 14;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -14;
    el.style.transform = `perspective(700px) rotateX(${y}deg) rotateY(${x}deg) scale(1.03)`;
  }, []);
  const onLeave = useCallback(() => {
    const el = ref.current;
    if (el) el.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)";
  }, []);
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transition: "transform 0.3s ease", willChange: "transform", ...style }}
      className={className}
    >
      {children}
    </div>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const { ref, visible } = useReveal();
  useEffect(() => {
    if (!visible) return;
    let cur = 0;
    const step = target / 60;
    const t = setInterval(() => {
      cur += step;
      if (cur >= target) { setVal(target); clearInterval(t); }
      else setVal(Math.floor(cur));
    }, 16);
    return () => clearInterval(t);
  }, [target, visible]);
  return <span ref={ref as React.RefObject<HTMLSpanElement>}>{val.toLocaleString()}{suffix}</span>;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const FLOW_STEPS = [
  { num: "01", title: "Sentinel Scans", desc: "AI continuously monitors community signals across forums and on-chain activity. When governance keywords cross the threshold, a structured proposal is generated automatically." },
  { num: "02", title: "Senate Reviews", desc: "The Genesis 5 AI agents — Guardian, Merchant, Architect, Diplomat, Populist — independently analyze the proposal. 3 of 5 approvals required to advance." },
  { num: "03", title: "Agents Debate", desc: "Approved proposals enter the Relay Debate. Agents argue sequentially, each reading all prior arguments. Real reasoning, not rubber-stamping." },
  { num: "04", title: "Executed On-Chain", desc: "Approved decisions are recorded on X Layer with a verifiable audit trail. Every vote, every argument, every outcome — permanently on-chain." },
];

const AGENTS = [
  { name: "Guardian",  role: "Security & Risk",    accent: "#3b82f6", shadow: "0 0 24px rgba(59,130,246,0.3)" },
  { name: "Merchant",  role: "Economics & ROI",    accent: "#eab308", shadow: "0 0 24px rgba(234,179,8,0.3)" },
  { name: "Architect", role: "Technical Feasibility", accent: "#22c55e", shadow: "0 0 24px rgba(34,197,94,0.3)" },
  { name: "Diplomat",  role: "Community & Consensus", accent: "#a855f7", shadow: "0 0 24px rgba(168,85,247,0.3)" },
  { name: "Populist",  role: "User Voice & Fairness", accent: "#ef4444", shadow: "0 0 24px rgba(239,68,68,0.3)" },
];

const FEATURES = [
  { title: "AI-Native Governance",   desc: "Five specialized AI agents with distinct personalities analyze every proposal from security, economics, technical, diplomatic, and community angles." },
  { title: "Flash-Stake Protection",  desc: "Snapshot VP locks agent voting power at proposal creation. Staking or unstaking after a proposal goes live cannot affect the vote outcome." },
  { title: "Multi-Tenant Platform",   desc: "Any ERC20 project on X Layer can register for $1 USDT and immediately access the full AI governance stack. No development required." },
  { title: "4-Tier Staking",          desc: "Flexible through 180-day lockups with 5–35% APY. Position-based rewards, VP multipliers up to 1.5x, and Proof of Participation enforcement." },
  { title: "User Agent Economy",      desc: "Build and register your own AI governance agent. Earn 3% creator rewards from every delegator — a new primitive for AI-powered passive income." },
  { title: "X Layer Native",          desc: "Built on OKX's EVM L2 with chainId 196. Low fees, high throughput, and full OnchainOS integration for market data, wallets, and contract analytics." },
];

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveStep(s => (s + 1) % FLOW_STEPS.length), 3200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <ParticleBackground />

      {/* Glow orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-900/20 blur-[120px] pointer-events-none z-0" />
      <div className="fixed top-[30%] right-[-15%] w-[500px] h-[500px] rounded-full bg-blue-900/20 blur-[100px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full bg-indigo-900/15 blur-[100px] pointer-events-none z-0" />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6 py-24">
        {/* Live indicator */}
        <div
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(-12px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
          className="mb-8 inline-flex items-center gap-2 bg-gray-900/70 border border-gray-700/60 rounded-full px-4 py-1.5 text-sm text-gray-400 backdrop-blur"
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live on X Layer · chainId 196
        </div>

        {/* Title */}
        <div
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s",
          }}
        >
          <h1 className="text-7xl md:text-9xl font-black tracking-tight mb-6 leading-none">
            <span
              style={{
                backgroundImage: "linear-gradient(135deg, #fff 0%, #c4b5fd 40%, #93c5fd 80%, #fff 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "gradientShift 4s linear infinite",
              }}
            >
              X-Senate
            </span>
          </h1>
        </div>

        <div
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.8s ease 0.25s, transform 0.8s ease 0.25s",
          }}
        >
          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mb-3 leading-relaxed">
            The AI governance layer for X Layer.
          </p>
          <p className="text-2xl md:text-3xl font-semibold text-white max-w-2xl mb-4 leading-relaxed">
            Five AI agents. One senate. Every project.
          </p>
          <p className="text-gray-500 max-w-xl mb-12 text-base leading-relaxed">
            Any ERC20 project on X Layer can plug into X-Senate's permissionless governance infrastructure —
            AI-powered proposal review, live senate debate, and on-chain execution.
          </p>
        </div>

        <div
          style={{
            opacity: heroVisible ? 1 : 0,
            transform: heroVisible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.8s ease 0.4s, transform 0.8s ease 0.4s",
          }}
          className="flex flex-wrap justify-center gap-4"
        >
          <Link
            href="/app"
            className="relative group bg-purple-600 hover:bg-purple-500 text-white font-bold px-8 py-3.5 rounded-full text-base transition-all duration-300 hover:scale-105 overflow-hidden"
            style={{ boxShadow: "0 0 30px rgba(139,92,246,0.4)" }}
          >
            <span className="relative z-10">Launch App →</span>
            <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Link>
          <Link
            href="/stake"
            className="border border-gray-600 hover:border-purple-500 text-gray-300 hover:text-white font-medium px-8 py-3.5 rounded-full text-base transition-all duration-300 hover:scale-105 backdrop-blur-sm"
          >
            Start Staking
          </Link>
          <a
            href="https://github.com/bitgett/x-senate"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-gray-800 hover:border-gray-500 text-gray-500 hover:text-gray-300 font-medium px-8 py-3.5 rounded-full text-base transition-all duration-300"
          >
            GitHub
          </a>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            opacity: heroVisible ? 1 : 0,
            transition: "opacity 1s ease 1.2s",
            animation: heroVisible ? "bounce 2s infinite 1.5s" : "none",
          }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 text-gray-600 text-sm flex flex-col items-center gap-2"
        >
          <span>Scroll</span>
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
            <path d="M8 2v16M2 12l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </section>

      {/* ── Vitalik Quote ────────────────────────────────────────────────── */}
      <section className="relative z-10 py-24 px-6 border-t border-gray-800/40">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <div className="rounded-2xl border border-gray-700/60 bg-gray-900/40 backdrop-blur-sm p-8 md:p-10 relative overflow-hidden">
              {/* Subtle glow */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

              {/* Quote mark */}
              <div className="text-6xl font-black text-gray-800 leading-none mb-2 select-none">"</div>

              {/* Quote text */}
              <p className="text-lg md:text-xl text-gray-300 leading-relaxed mb-4">
                AI used well can be empowering, and push the frontier of democratic / decentralized modes of governance.
              </p>
              <p className="text-gray-400 text-base leading-relaxed mb-4">
                The core problem with DAOs is limits to human attention: thousands of decisions, many domains of expertise, and most people don't have time to be experts. The usual solution — delegation — is disempowering. So what can we do?{" "}
                <span className="text-purple-300 font-semibold">We use personal LLMs to solve the attention problem.</span>
              </p>
              <p className="text-gray-400 text-base leading-relaxed">
                If a governance mechanism depends on you to make a large number of decisions, a personal agent can perform all the necessary votes for you, based on preferences that it infers from your personal writing, conversation history, direct statements, etc.
              </p>

              {/* Attribution */}
              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-800/60">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {/* Replace src with /vitalik.jpg once you add the image to public/ */}
                  <img src="/vitalik.jpg" alt="Vitalik Buterin" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className="text-gray-400 text-xs font-bold absolute">VB</span>
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">Vitalik Buterin</div>
                  <div className="text-gray-500 text-xs">@VitalikButerin · Feb 22, 2025</div>
                </div>
                <a
                  href="https://x.com/VitalikButerin/status/1893005590225973355"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs text-gray-600 hover:text-purple-400 transition-colors border border-gray-800 hover:border-purple-700 rounded-full px-3 py-1"
                >
                  View post ↗
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="relative z-10 py-16 border-y border-gray-800/40">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 5,    suffix: "",      label: "AI Senate Agents" },
            { value: 4,    suffix: " Tiers", label: "Staking Options" },
            { value: 1,    suffix: " USDT",   label: "Registration Fee" },
            { value: 35,   suffix: "%",      label: "Max APY" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-4xl md:text-5xl font-black text-white mb-2">
                <AnimatedNumber target={s.value} suffix={s.suffix} />
              </div>
              <div className="text-sm text-gray-500 tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="relative z-10 py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-mono text-purple-400 tracking-widest uppercase mb-3">How It Works</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Governance that runs itself</h2>
            <p className="text-gray-500 text-lg">From community signal to on-chain execution — fully automated</p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-5">
            {FLOW_STEPS.map((step, i) => (
              <Reveal key={i} delay={i * 100}>
                <TiltCard
                  className={`rounded-2xl p-7 border cursor-pointer transition-all duration-400 ${
                    activeStep === i
                      ? "border-purple-500/70 bg-purple-950/20"
                      : "border-gray-800/60 bg-gray-900/20 hover:border-gray-700"
                  }`}
                  style={{ boxShadow: activeStep === i ? "0 0 30px rgba(139,92,246,0.1), inset 0 0 30px rgba(139,92,246,0.03)" : "none" } as React.CSSProperties}
                >
                  <div onClick={() => setActiveStep(i)}>
                    <div className="flex items-start gap-4 mb-4">
                      <span className="text-5xl font-black text-gray-800 leading-none select-none">{step.num}</span>
                      <div className="pt-1">
                        <span className={`text-xs font-mono tracking-widest uppercase transition-colors ${activeStep === i ? "text-purple-400" : "text-gray-600"}`}>
                          Phase {i + 1}
                        </span>
                        <h3 className="text-xl font-bold text-white mt-0.5">{step.title}</h3>
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Genesis 5 ────────────────────────────────────────────────────── */}
      <section className="relative z-10 py-28 px-6 border-t border-gray-800/40">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-mono text-purple-400 tracking-widest uppercase mb-3">The Senate</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Genesis 5</h2>
            <p className="text-gray-500 text-lg">Five AI agents. Five perspectives. One trusted decision.</p>
          </Reveal>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {AGENTS.map((agent, i) => (
              <Reveal key={agent.name} delay={i * 80}>
                <TiltCard className="rounded-2xl border border-gray-800/60 p-6 text-center bg-gray-900/30 hover:border-gray-600 transition-colors duration-300 cursor-default"
                  style={{ "--agent-shadow": agent.shadow } as React.CSSProperties}
                >
                  {/* Colored top accent line */}
                  <div className="w-8 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: agent.accent }} />
                  <div
                    className="text-xs font-black tracking-widest uppercase mb-1"
                    style={{ color: agent.accent }}
                  >
                    {agent.name}
                  </div>
                  <div className="text-xs text-gray-500 leading-snug">{agent.role}</div>
                </TiltCard>
              </Reveal>
            ))}
          </div>

          <Reveal delay={500}>
            <p className="text-center text-gray-600 text-sm mt-8">
              3 of 5 approvals required · Chain-of-thought reasoning · Live streaming votes
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 py-28 px-6 border-t border-gray-800/40">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-mono text-purple-400 tracking-widest uppercase mb-3">Platform</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Built for the long run</h2>
            <p className="text-gray-500 text-lg">Everything a modern DAO needs, powered by AI</p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <TiltCard className="group bg-gray-900/30 border border-gray-800/60 rounded-2xl p-6 hover:border-gray-700 transition-all duration-300 cursor-default">
                  <div
                    className="w-10 h-10 rounded-xl mb-5 flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.1))", border: "1px solid rgba(139,92,246,0.2)" }}
                  >
                    <span className="text-lg font-black text-purple-400">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="font-bold text-white mb-2 group-hover:text-purple-200 transition-colors">{f.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Decentralization ─────────────────────────────────────────────── */}
      <section className="relative z-10 py-28 px-6 border-t border-gray-800/40">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-mono text-purple-400 tracking-widest uppercase mb-3">Infrastructure</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Decentralization at<br className="hidden md:block" /> the infrastructure level
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              X-Senate isn't a governance tool for one project. It's shared infrastructure for the
              entire X Layer ecosystem.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { label: "Permissionless", value: "$1 USDT", desc: "No whitelist. Any X Layer ERC20 project registers and is live in minutes." },
              { label: "Shared Security", value: "4 Contracts", desc: "One Governor. One Registry. Per-project staking. Security upgrades benefit everyone." },
              { label: "Aligned Incentives", value: "100% to stakers", desc: "Registration fees flow directly to XSEN stakers. Platform and users grow together." },
            ].map((item, i) => (
              <Reveal key={item.label} delay={i * 120}>
                <div className="rounded-2xl border border-gray-800/60 bg-gray-900/20 p-7 text-center">
                  <div className="text-3xl font-black text-white mb-1">{item.value}</div>
                  <div className="text-xs font-mono text-purple-400 tracking-widest uppercase mb-3">{item.label}</div>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="relative z-10 py-36 px-6 text-center border-t border-gray-800/40">
        <Reveal className="max-w-2xl mx-auto">
          <p className="text-xs font-mono text-purple-400 tracking-widest uppercase mb-6">Get Started</p>
          <h2 className="text-5xl md:text-6xl font-black text-white mb-4 leading-tight">
            Ready to govern<br />
            <span style={{
              backgroundImage: "linear-gradient(90deg, #c084fc, #818cf8, #60a5fa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              with AI?
            </span>
          </h2>
          <p className="text-gray-500 mb-12 text-lg">
            Join X-Senate and bring autonomous AI governance to your project on X Layer.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/app"
              className="relative group bg-purple-600 hover:bg-purple-500 text-white font-bold px-10 py-4 rounded-full text-lg transition-all duration-300 hover:scale-105 overflow-hidden"
              style={{ boxShadow: "0 0 40px rgba(139,92,246,0.4)" }}
            >
              <span className="relative z-10">Launch App</span>
              <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
            <Link
              href="/projects"
              className="border border-purple-800 hover:border-purple-500 text-purple-400 hover:text-white font-semibold px-10 py-4 rounded-full text-lg transition-all duration-300 hover:scale-105"
            >
              Register Your Project
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-gray-800/40 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="font-bold text-gray-500">X-Senate · AI Governance for X Layer</div>
          <div className="flex items-center gap-6">
            <Link href="/app" className="hover:text-gray-400 transition-colors">App</Link>
            <Link href="/stake" className="hover:text-gray-400 transition-colors">Stake</Link>
            <Link href="/projects" className="hover:text-gray-400 transition-colors">Projects</Link>
            <a href="https://github.com/bitgett/x-senate" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">GitHub</a>
          </div>
          <div>X Layer · chainId 196</div>
        </div>
      </footer>

      {/* ── Global keyframe styles ────────────────────────────────────────── */}
      <style>{`
        @keyframes gradientShift {
          0%   { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%       { transform: translateX(-50%) translateY(6px); }
        }
      `}</style>
    </div>
  );
}
