"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ─── Particle canvas background ───────────────────────────────────────────────
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

    const particles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

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
        ctx.fillStyle = `rgba(139, 92, 246, ${p.alpha})`;
        ctx.fill();
      }
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.15 * (1 - dist / 120)})`;
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

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" />;
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / 60;
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return <>{val.toLocaleString()}{suffix}</>;
}

// ─── Flow step ────────────────────────────────────────────────────────────────
const FLOW_STEPS = [
  { icon: "🔍", title: "Sentinel Scans", desc: "AI continuously monitors community signals across forums, Discord, and on-chain activity. When governance keywords cross the threshold, a structured proposal is generated automatically." },
  { icon: "🏛️", title: "Senate Reviews", desc: "The Genesis 5 AI agents — Guardian, Merchant, Architect, Diplomat, Populist — independently analyze the proposal from five distinct perspectives. 3 of 5 approvals required." },
  { icon: "⚡", title: "Agents Debate", desc: "Approved proposals enter the Relay Debate. Agents argue sequentially, each reading all prior arguments before responding. Real reasoning, not just rubber-stamping." },
  { icon: "⛓️", title: "Executed On-Chain", desc: "Approved decisions are recorded on X Layer with a verifiable audit trail. Every vote, every argument, every outcome — permanently on-chain." },
];

const FEATURES = [
  { icon: "🤖", title: "AI-Native Governance", desc: "Five specialized AI agents with distinct personalities analyze every proposal from security, economics, technical, diplomatic, and community perspectives." },
  { icon: "🔐", title: "Flash-Stake Proof", desc: "Snapshot VP locks agent voting power at proposal creation. Staking or unstaking after a proposal is created cannot affect the vote outcome." },
  { icon: "🏗️", title: "Multi-Tenant Platform", desc: "Any ERC20 project on X Layer can register for 1,000 XSEN and immediately access the full AI governance stack — no development required." },
  { icon: "💎", title: "4-Tier Staking", desc: "Flexible through 180-day lockups with 5–35% APY. Position-based rewards, Voting Power multipliers, and Proof of Participation enforcement." },
  { icon: "🧑‍💻", title: "User Agent Economy", desc: "Build and register your own AI governance agent. Earn 3% creator rewards from every delegator — a new primitive for AI-powered passive income." },
  { icon: "🌐", title: "X Layer Native", desc: "Built on OKX's EVM L2 with chainId 196. Low fees, high throughput, and full OKX OnchainOS integration for market data, wallets, and security scanning." },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActiveStep(s => (s + 1) % FLOW_STEPS.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <ParticleBackground />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 py-24">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 bg-purple-950/60 border border-purple-700/50 rounded-full px-4 py-1.5 text-sm text-purple-300 backdrop-blur">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          Built for OKX × X Layer Hackathon 2025
        </div>

        {/* Title */}
        <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-6 leading-none">
          <span className="bg-gradient-to-r from-white via-purple-200 to-blue-300 bg-clip-text text-transparent">
            X-Senate
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mb-4 leading-relaxed">
          The AI governance layer for X Layer.
          <br />
          <span className="text-white font-medium">Five AI agents. One senate. Every project.</span>
        </p>

        <p className="text-gray-500 max-w-xl mb-10 text-base">
          Any ERC20 project on X Layer can plug into X-Senate's permissionless governance infrastructure —
          AI-powered proposal review, live senate debate, and on-chain execution. No development required.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/app"
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-8 py-3.5 rounded-full text-base transition-all hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
          >
            Launch App →
          </Link>
          <Link
            href="/stake"
            className="border border-gray-600 hover:border-purple-500 text-gray-300 hover:text-white font-medium px-8 py-3.5 rounded-full text-base transition-all"
          >
            💎 Start Staking
          </Link>
          <a
            href="https://github.com/bitgett/x-senate"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white font-medium px-8 py-3.5 rounded-full text-base transition-all"
          >
            GitHub
          </a>
        </div>

        {/* Network tag */}
        <div className="mt-12 flex items-center gap-3 text-sm text-gray-500">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live on X Layer · chainId 196
          <span className="mx-2">·</span>
          Powered by Claude AI
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <section className="relative py-16 border-y border-gray-800/50">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 5, suffix: "", label: "AI Senate Agents" },
            { value: 4, suffix: " Tiers", label: "Staking Options" },
            { value: 1000, suffix: " XSEN", label: "Registration Fee" },
            { value: 35, suffix: "%", label: "Max APY" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-4xl font-black text-white mb-1">
                <AnimatedNumber target={s.value} suffix={s.suffix} />
              </div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-3">How It Works</h2>
            <p className="text-gray-400 text-lg">Governance that runs itself — from signal to execution</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {FLOW_STEPS.map((step, i) => (
              <div
                key={i}
                onClick={() => setActiveStep(i)}
                className={`cursor-pointer rounded-2xl p-6 border transition-all duration-500 ${
                  activeStep === i
                    ? "border-purple-500 bg-purple-950/30 shadow-lg shadow-purple-500/10"
                    : "border-gray-800 bg-gray-900/30 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{step.icon}</span>
                  <div>
                    <span className="text-xs text-purple-400 font-mono">PHASE {i + 1}</span>
                    <h3 className="text-lg font-bold text-white">{step.title}</h3>
                  </div>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Genesis 5 ──────────────────────────────────────────────────────── */}
      <section className="relative py-24 px-6 border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-3">Genesis 5 Senate</h2>
            <p className="text-gray-400 text-lg">Five AI agents. Five perspectives. One trusted decision.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { emoji: "🛡️", name: "Guardian", role: "Security & Risk", color: "from-blue-600/20 to-blue-900/10 border-blue-800/50" },
              { emoji: "💰", name: "Merchant", role: "Economics & ROI", color: "from-yellow-600/20 to-yellow-900/10 border-yellow-800/50" },
              { emoji: "⚙️", name: "Architect", role: "Technical", color: "from-green-600/20 to-green-900/10 border-green-800/50" },
              { emoji: "🤝", name: "Diplomat", role: "Community", color: "from-purple-600/20 to-purple-900/10 border-purple-800/50" },
              { emoji: "👥", name: "Populist", role: "User Voice", color: "from-red-600/20 to-red-900/10 border-red-800/50" },
            ].map((agent) => (
              <div key={agent.name} className={`bg-gradient-to-b ${agent.color} border rounded-2xl p-5 text-center`}>
                <div className="text-4xl mb-2">{agent.emoji}</div>
                <div className="font-bold text-white text-sm">{agent.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{agent.role}</div>
              </div>
            ))}
          </div>

          <p className="text-center text-gray-500 text-sm mt-8">
            3 of 5 approvals required · Chain-of-thought reasoning · Live streaming votes
          </p>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="relative py-24 px-6 border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-3">Platform Features</h2>
            <p className="text-gray-400 text-lg">Everything a modern DAO needs, powered by AI</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-colors">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── X Layer Section ────────────────────────────────────────────────── */}
      <section className="relative py-24 px-6 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Decentralization at the Infrastructure Level
          </h2>
          <p className="text-gray-400 text-lg mb-12 max-w-2xl mx-auto">
            X-Senate isn't just a governance tool for one project.
            It's shared infrastructure for the entire X Layer ecosystem —
            accelerating decentralization across every project that builds here.
          </p>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            {[
              {
                title: "Permissionless Access",
                desc: "No whitelist. No approval process. Any X Layer ERC20 project registers with 1,000 XSEN and is live in minutes. The protocol is the gatekeeper, not a team.",
                icon: "🔓",
              },
              {
                title: "Shared Security",
                desc: "All projects share the same battle-tested Governor and Registry contracts. Security improvements benefit everyone. No project needs to audit their own governance code.",
                icon: "🛡️",
              },
              {
                title: "Aligned Incentives",
                desc: "Registration fees flow to XSEN stakers. More projects = more fees = better staking rewards. The platform and its users grow together.",
                icon: "⚖️",
              },
            ].map((item) => (
              <div key={item.title} className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="relative py-32 px-6 text-center border-t border-gray-800/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-5xl font-black text-white mb-4">
            Ready to govern<br />
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              with AI?
            </span>
          </h2>
          <p className="text-gray-400 mb-10 text-lg">
            Join X-Senate and bring autonomous AI governance to your project on X Layer.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/app"
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-10 py-4 rounded-full text-lg transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30"
            >
              Launch App
            </Link>
            <Link
              href="/projects"
              className="border border-purple-700 hover:border-purple-400 text-purple-300 hover:text-white font-semibold px-10 py-4 rounded-full text-lg transition-all"
            >
              Register Your Project
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="relative border-t border-gray-800 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span className="text-purple-400">🏛️</span>
            <span className="font-bold text-gray-400">X-Senate</span>
            <span>· AI Governance for X Layer</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/app" className="hover:text-gray-400 transition-colors">App</Link>
            <Link href="/stake" className="hover:text-gray-400 transition-colors">Stake</Link>
            <Link href="/projects" className="hover:text-gray-400 transition-colors">Projects</Link>
            <a href="https://github.com/bitgett/x-senate" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">GitHub</a>
          </div>
          <div>Built for OKX × X Layer Hackathon 2025</div>
        </div>
      </footer>
    </div>
  );
}
