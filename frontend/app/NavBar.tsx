"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";

function fmt(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(0);
}

const NAV_ITEMS = [
  { href: "/sentinel", label: "Sentinel",  num: "01" },
  { href: "/app",      label: "Proposals", num: "02" },
  { href: "/agents",   label: "Agents",    num: "03" },
  { href: "/stake",    label: "Stake",     num: "04" },
  { href: "/projects", label: "Projects",  num: null },
  { href: "/activity", label: "Activity",  num: null },
  { href: "/onchain",  label: "X Layer",   num: null, icon: true },
];

export default function NavBar() {
  const pathname = usePathname();
  const { wallet, effectiveVP, connecting, openModal, disconnect } = useWallet();

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800/60 bg-[#0a0a0f]/90 backdrop-blur-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* ── Logo ── */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden border border-gray-700/60 group-hover:border-purple-500/50 transition-all">
            <Image
              src="/xlayer-logo.jpg"
              alt="X Layer"
              width={36}
              height={36}
              className="object-cover mix-blend-luminosity opacity-80 group-hover:opacity-100 scale-110 transition-all"
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-white text-sm tracking-tight">X-Senate</span>
            <span className="text-[10px] text-gray-500 tracking-widest uppercase">AI Governance</span>
          </div>
        </Link>

        {/* ── Nav items ── */}
        <div className="flex items-center gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative group px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-1.5 ${
                  isActive
                    ? "text-white bg-purple-600/25 border border-purple-500/40"
                    : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-gray-700/60"
                }`}
              >
                {item.icon && (
                  <Image
                    src="/xlayer-logo.jpg"
                    alt="X Layer"
                    width={14}
                    height={14}
                    className={`rounded-sm object-cover mix-blend-luminosity transition-opacity ${isActive ? "opacity-100" : "opacity-50 group-hover:opacity-90"}`}
                  />
                )}
                <span>{item.label}</span>
                {item.num && (
                  <span className={`text-[9px] font-mono transition-colors ${isActive ? "text-purple-400" : "text-gray-600 group-hover:text-gray-400"}`}>
                    {item.num}
                  </span>
                )}
                {isActive && (
                  <span className="absolute -bottom-px left-1/2 -translate-x-1/2 w-4 h-px bg-purple-400 rounded-full" />
                )}
              </Link>
            );
          })}

          <div className="w-px h-5 bg-gray-800 mx-2" />

          {/* ── Wallet Connect ── */}
          {wallet ? (
            <div className="relative group">
              <div className="flex items-center gap-2 bg-gray-900/80 border border-gray-700/60 rounded-full px-3 py-1.5 cursor-pointer hover:border-gray-600 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-xs font-mono text-gray-300">{wallet.slice(0, 6)}...{wallet.slice(-4)}</span>
                {effectiveVP > 0 && (
                  <span className="text-[11px] text-purple-300 font-semibold">{fmt(effectiveVP)} VP</span>
                )}
              </div>
              {/* Hover dropdown */}
              <div className="absolute right-0 top-full mt-1.5 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-150 z-50">
                <div className="bg-gray-900 border border-gray-700/60 rounded-xl p-1.5 shadow-xl min-w-[140px]">
                  <div className="px-3 py-1.5 text-[11px] text-gray-500 font-mono truncate max-w-[160px]">
                    {wallet.slice(0, 10)}...{wallet.slice(-6)}
                  </div>
                  <div className="h-px bg-gray-800 my-1" />
                  <button
                    onClick={disconnect}
                    className="w-full text-xs text-red-400 hover:text-red-300 hover:bg-red-900/10 px-3 py-1.5 text-left rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={openModal}
              disabled={connecting}
              className="text-xs font-semibold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-full transition-colors"
            >
              {connecting ? "..." : "Connect"}
            </button>
          )}

          <div className="w-px h-5 bg-gray-800 mx-2" />

          <div className="flex items-center gap-2 bg-gray-900/80 border border-gray-800/60 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-300 font-medium">Genesis 5</span>
            <span className="text-[10px] text-gray-600">Online</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
