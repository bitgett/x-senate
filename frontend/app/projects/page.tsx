"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import { useWallet } from "@/contexts/WalletContext";

function safeAddr(env: string | undefined, fallback: string): string {
  try { return ethers.getAddress((env ?? fallback).trim().toLowerCase()); } catch { return fallback; }
}
const REGISTRY_ADDRESS = safeAddr(process.env.NEXT_PUBLIC_XSEN_REGISTRY_ADDRESS,  "0xFd11e955CCEA6346911F33119B3bf84b3f0E6678");
const XSEN_TOKEN       = safeAddr(process.env.NEXT_PUBLIC_XSEN_TOKEN_ADDRESS,      "0x1bAB744c4c98D844984e297744Cb6b4E24e2E89b");
const XSEN_STAKING     = safeAddr(process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS,    "0xc8FD7B12De6bFb10dF3eaCb38AAc09CBbeb25bFD");

const TOKEN_ABI    = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];
const REGISTRY_ABI = ["function registerProject(string,string,address,address) external"];
const TOKEN_IFACE    = new ethers.Interface(TOKEN_ABI);
const REGISTRY_IFACE = new ethers.Interface(REGISTRY_ABI);
const RPC_PROVIDER   = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
async function sendTx(rawProv: any, from: string, to: string, data: string): Promise<string> {
  return await rawProv.request({ method: "eth_sendTransaction", params: [{ from, to, data, gas: "0x3D090" }] });
}
async function waitTx(hash: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const r = await RPC_PROVIDER.getTransactionReceipt(hash).catch(() => null);
    if (r) return;
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error("Transaction not confirmed after 2 minutes");
}

function truncateAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

type RegStep = "idle" | "checking" | "approving" | "registering" | "saving" | "done";

export default function ProjectsPage() {
  const router = useRouter();
  const { wallet, openModal, rawProvider } = useWallet();

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  // Form
  const [formId,          setFormId]          = useState("");
  const [formName,        setFormName]        = useState("");
  const [formToken,       setFormToken]       = useState("");
  const [formDesc,        setFormDesc]        = useState("");
  const [formTwitter,     setFormTwitter]     = useState("");
  const [formDiscord,     setFormDiscord]     = useState("");
  const [formTelegram,    setFormTelegram]    = useState("");
  const [logoBase64,      setLogoBase64]      = useState<string | null>(null);

  // Registration state
  const [step,      setStep]      = useState<RegStep>("idle");
  const [regError,  setRegError]  = useState("");
  const [regResult, setRegResult] = useState<any>(null);

  // Token scan
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning,   setScanning]   = useState(false);

  useEffect(() => {
    fetch("/api/registry/projects")
      .then(r => r.json())
      .then(d => { if (d.projects) setProjects(d.projects); })
      .finally(() => setLoading(false));
  }, []);

  async function handleScanToken() {
    if (!formToken.startsWith("0x")) return;
    setScanning(true); setScanResult(null);
    try {
      const res = await fetch(`/api/onchain/security/scan-token?chain_index=196&token_address=${formToken}`, { method: "POST" });
      setScanResult(await res.json());
    } catch {}
    setScanning(false);
  }

  async function handleRegister() {
    setRegError(""); setRegResult(null);
    if (!wallet) { openModal(); return; }
    if (!formId.trim() || !formName.trim() || !formToken.trim()) { setRegError("Project ID, name, and token address are required."); return; }
    if (!formToken.startsWith("0x") || formToken.length !== 42) { setRegError("Invalid token address."); return; }

    const pid = formId.trim().toUpperCase();

    try {
      const raw = rawProvider();

      // Step 1: Check XSEN balance
      setStep("checking");
      const token = new ethers.Contract(XSEN_TOKEN, TOKEN_ABI, RPC_PROVIDER);
      const bal = await token.balanceOf(wallet);
      const fee = ethers.parseEther("1000");
      if (bal < fee) {
        setRegError(`Insufficient XSEN. Need 1,000 XSEN, have ${Number(ethers.formatEther(bal)).toFixed(0)} XSEN.`);
        setStep("idle"); return;
      }

      // Step 2: Approve Registry to spend 1000 XSEN
      setStep("approving");
      const approveHash = await sendTx(raw, wallet, XSEN_TOKEN,
        TOKEN_IFACE.encodeFunctionData("approve", [REGISTRY_ADDRESS, fee]));
      await waitTx(approveHash);

      // Step 3: Call Registry.registerProject on-chain
      setStep("registering");
      const registerHash = await sendTx(raw, wallet, REGISTRY_ADDRESS,
        REGISTRY_IFACE.encodeFunctionData("registerProject", [pid, formName.trim(), formToken.trim(), XSEN_STAKING]));
      await waitTx(registerHash);

      // Step 4: Save social meta to DB
      setStep("saving");
      await fetch("/api/registry/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id:    pid,
          name:          formName.trim(),
          description:   formDesc.trim() || null,
          token_address: formToken.trim(),
          twitter:       formTwitter.trim() || null,
          discord:       formDiscord.trim() || null,
          telegram:      formTelegram.trim() || null,
          registrant:    wallet,
          tx_hash:       registerHash,
          logo_base64:   logoBase64 || null,
        }),
      });

      setStep("done");
      setRegResult({ project_id: pid, tx_hash: registerHash });
      // Reload project list
      fetch("/api/registry/projects").then(r => r.json()).then(d => { if (d.projects) setProjects(d.projects); });
      // Navigate to new project page after 2s
      setTimeout(() => router.push(`/projects/${pid}`), 2000);

    } catch (e: any) {
      const msg = e?.code === 4001 ? "Transaction rejected." : (e?.reason ?? e?.message ?? "Registration failed.");
      setRegError(msg.slice(0, 120));
      setStep("idle");
    }
  }

  const stepLabel: Record<RegStep, string> = {
    idle:       "Register Project — 1,000 XSEN",
    checking:   "Checking XSEN balance...",
    approving:  "Approve 1,000 XSEN in wallet...",
    registering:"Confirm registration tx in wallet...",
    saving:     "Saving project info...",
    done:       "✓ Registered!",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">X-Senate Governance Platform</h1>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Any project on X Layer can plug into X-Senate's Genesis 5 AI Senate and governance infrastructure.
          One registration — access to AI senate review, relay debate, on-chain execution, and staking rewards.
        </p>
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Registered Projects", value: projects.length || "—" },
          { label: "Genesis AI Agents",   value: "5" },
          { label: "Network",             value: "X Layer" },
          { label: "Registration Fee",    value: "1,000 XSEN" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-gray-900/50 border border-purple-800/30 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-3">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-400">
          <div className="flex gap-3">
            <span className="text-2xl">1️⃣</span>
            <div>
              <div className="text-white font-medium mb-1">Register Your Token</div>
              Submit your X Layer ERC20 address and pay 1,000 XSEN. Fee flows to the XSEN staker ecosystem fund.
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">2️⃣</span>
            <div>
              <div className="text-white font-medium mb-1">Genesis 5 AI Senate</div>
              Guardian, Merchant, Architect, Diplomat, and Populist autonomously debate and vote on your proposals.
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-2xl">3️⃣</span>
            <div>
              <div className="text-white font-medium mb-1">On-Chain Execution</div>
              Approved proposals are executed on X Layer. Full debate transcript preserved on-chain.
            </div>
          </div>
        </div>
      </div>

      {/* Project grid */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Registered Projects</h2>
        {loading && <div className="text-center py-8 text-gray-500">Loading projects...</div>}
        {!loading && projects.length === 0 && (
          <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-10 text-center">
            <div className="text-4xl mb-3">🏗️</div>
            <p className="text-gray-400">No projects registered yet. Be the first below.</p>
          </div>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.project_id} href={`/projects/${p.project_id}`}>
              <div className="bg-gray-900 border border-gray-800 hover:border-purple-600 rounded-xl p-5 transition-all cursor-pointer h-full flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {p.logo_base64 ? (
                      <img src={p.logo_base64} alt={p.project_id} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-lg shrink-0">
                        {p.project_id === "XSEN" ? "🏛️" : "🔷"}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-lg">{p.project_id}</span>
                        {p.project_id === "XSEN" && (
                          <span className="text-[10px] bg-purple-800 text-purple-200 rounded-full px-2 py-0.5">Native</span>
                        )}
                      </div>
                      <div className="text-gray-400 text-sm">{p.name}</div>
                    </div>
                  </div>
                </div>
                {p.description && (
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">{p.description}</p>
                )}
                <div className="space-y-1 text-xs text-gray-600 mt-auto">
                  <div className="flex justify-between">
                    <span>Token</span>
                    <span className="text-gray-400 font-mono">{truncateAddr(p.token_address)}</span>
                  </div>
                </div>
                {/* Social links */}
                {(p.twitter || p.discord || p.telegram) && (
                  <div className="flex gap-2 mt-3">
                    {p.twitter  && <span className="text-[10px] text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded-full">𝕏 Twitter</span>}
                    {p.discord  && <span className="text-[10px] text-indigo-400 bg-indigo-900/20 px-2 py-0.5 rounded-full">Discord</span>}
                    {p.telegram && <span className="text-[10px] text-sky-400 bg-sky-900/20 px-2 py-0.5 rounded-full">Telegram</span>}
                  </div>
                )}
                <div className="mt-3 text-xs text-purple-400 font-medium">View governance →</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Registration form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Register Your Project</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              Bring X-Senate AI governance to your X Layer community.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 bg-yellow-900/20 border border-yellow-700/40 rounded-full px-3 py-1.5">
            <span className="text-yellow-400 text-xs">⚡</span>
            <span className="text-yellow-400 text-xs font-bold">1,000 XSEN</span>
            <span className="text-yellow-600 text-[11px]">fee</span>
          </div>
        </div>

        <div className="space-y-4 max-w-lg">
          {/* Project ID */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Project ID *</label>
            <input type="text" placeholder="QTKN" value={formId}
              onChange={e => setFormId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              maxLength={12}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono uppercase"
            />
            <p className="text-xs text-gray-600 mt-1">Uppercase letters and numbers only, max 12 chars</p>
          </div>

          {/* Project Name */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Project Name *</label>
            <input type="text" placeholder="Q Protocol" value={formName}
              onChange={e => setFormName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Token Logo */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Token Logo</label>
            <div className="flex items-center gap-4">
              {logoBase64 ? (
                <img src={logoBase64} alt="logo" className="w-16 h-16 rounded-xl object-cover border border-gray-700" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gray-800 border border-dashed border-gray-600 flex items-center justify-center text-gray-600 text-xs">
                  200x200
                </div>
              )}
              <div className="flex-1">
                <label className="cursor-pointer inline-block bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs px-4 py-2 rounded-lg transition-colors">
                  {logoBase64 ? "Change Logo" : "Upload Logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 500_000) { setRegError("Image too large. Max 500KB."); return; }
                    const reader = new FileReader();
                    reader.onload = () => {
                      const img = new window.Image();
                      img.onload = () => {
                        const canvas = document.createElement("canvas");
                        canvas.width = 200; canvas.height = 200;
                        const ctx = canvas.getContext("2d")!;
                        const scale = Math.max(200 / img.width, 200 / img.height);
                        const w = img.width * scale, h = img.height * scale;
                        ctx.drawImage(img, (200 - w) / 2, (200 - h) / 2, w, h);
                        setLogoBase64(canvas.toDataURL("image/jpeg", 0.85));
                      };
                      img.src = reader.result as string;
                    };
                    reader.readAsDataURL(file);
                  }} />
                </label>
                <p className="text-xs text-gray-600 mt-1">PNG/JPG, max 500KB. Resized to 200×200</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Description</label>
            <textarea placeholder="A brief description of your project..." value={formDesc}
              onChange={e => setFormDesc(e.target.value)} rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {/* Token Address */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Token Contract Address (X Layer) *</label>
            <div className="flex gap-2">
              <input type="text" placeholder="0x..." value={formToken}
                onChange={e => { setFormToken(e.target.value); setScanResult(null); }}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono"
              />
              <button onClick={handleScanToken} disabled={scanning || !formToken.startsWith("0x")}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-2 rounded-lg disabled:opacity-40 transition-colors whitespace-nowrap">
                {scanning ? "Scanning..." : "🔍 Scan"}
              </button>
            </div>
            {scanResult && (
              <div className={`mt-2 p-3 rounded-lg text-xs ${
                scanResult.risk_level === "LOW"
                  ? "bg-green-900/30 border border-green-700/40 text-green-300"
                  : "bg-yellow-900/30 border border-yellow-700/40 text-yellow-300"
              }`}>
                OKX Security: {scanResult.risk_level ?? "Unknown"} risk
                {scanResult.risk_items?.length > 0 && <span className="ml-2">· {scanResult.risk_items.length} issue(s)</span>}
              </div>
            )}
          </div>

          {/* Social Links */}
          <div className="border-t border-gray-800 pt-4">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Community Links (optional)</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-sm w-20 shrink-0">𝕏 Twitter</span>
                <input type="text" placeholder="https://twitter.com/yourproject" value={formTwitter}
                  onChange={e => setFormTwitter(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-sm w-20 shrink-0">Discord</span>
                <input type="text" placeholder="https://discord.gg/yourproject" value={formDiscord}
                  onChange={e => setFormDiscord(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-sm w-20 shrink-0">Telegram</span>
                <input type="text" placeholder="https://t.me/yourproject" value={formTelegram}
                  onChange={e => setFormTelegram(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {regError && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">{regError}</div>
          )}

          {/* Success */}
          {regResult && (
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-sm text-green-300">
              <div className="font-semibold">Project {regResult.project_id} registered!</div>
              <div className="text-xs mt-1 text-green-500 font-mono">TX: {regResult.tx_hash?.slice(0, 20)}...</div>
              <div className="text-xs mt-1 text-green-400">Redirecting to governance page...</div>
            </div>
          )}

          {/* Steps indicator */}
          {step !== "idle" && step !== "done" && (
            <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-900/20 border border-purple-700/30 rounded-lg p-3">
              <div className="w-3 h-3 rounded-full border-2 border-purple-400 border-t-transparent animate-spin shrink-0" />
              {stepLabel[step]}
            </div>
          )}

          <button
            onClick={wallet ? handleRegister : openModal}
            disabled={step !== "idle" && step !== "done"}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all text-sm"
            style={{ boxShadow: "0 0 16px rgba(139,92,246,0.25)" }}
          >
            {!wallet ? "Connect Wallet to Register" : stepLabel[step]}
          </button>
          <p className="text-[11px] text-gray-700 text-center">
            1,000 XSEN fee flows to XSEN staker ecosystem fund · Name must be unique on-chain
          </p>
        </div>
      </div>

    </div>
  );
}
