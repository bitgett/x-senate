"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// X Layer hexagonal logo SVG
function XLayerLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L21 7V17L12 22L3 17V7L12 2Z"
        stroke="url(#xlGrad)"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M8 9L12 12L16 9M8 15L12 12L16 15"
        stroke="url(#xlGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="xlGrad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Chronological flow: Sentinel → Proposals → Agents → Stake → Projects → X Layer
const NAV_ITEMS = [
  { href: "/sentinel",  label: "Sentinel",  desc: "Monitor" },
  { href: "/app",       label: "Proposals", desc: "Review"  },
  { href: "/agents",    label: "Agents",    desc: "Debate"  },
  { href: "/stake",     label: "Stake",     desc: "Govern"  },
  { href: "/projects",  label: "Projects",  desc: "Register"},
  { href: "/onchain",   label: "X Layer",   desc: "On-Chain", icon: true },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800/60 bg-[#0a0a0f]/90 backdrop-blur-md">
      {/* Subtle top glow line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-purple-500/20 blur-md group-hover:bg-purple-500/30 transition-all" />
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600/30 to-blue-600/20 border border-purple-500/30">
              <span className="text-sm font-black text-purple-300">X</span>
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-white text-sm tracking-tight">X-Senate</span>
            <span className="text-[10px] text-gray-600 tracking-widest uppercase">AI Governance</span>
          </div>
        </Link>

        {/* Nav items */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map((item, idx) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative group px-3 py-1.5 rounded-lg text-sm transition-all duration-200 flex items-center gap-1.5 ${
                  isActive
                    ? "text-white bg-purple-600/20 border border-purple-500/30"
                    : "text-gray-500 hover:text-gray-200 hover:bg-gray-800/60"
                }`}
              >
                {item.icon && <XLayerLogo size={14} />}
                <span>{item.label}</span>
                {/* Step number */}
                {idx < 4 && (
                  <span className={`text-[9px] font-mono ml-0.5 ${isActive ? "text-purple-400" : "text-gray-700 group-hover:text-gray-600"}`}>
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                )}
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute -bottom-px left-1/2 -translate-x-1/2 w-4 h-px bg-purple-400 rounded-full" />
                )}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="w-px h-5 bg-gray-800 mx-2" />

          {/* Status badge */}
          <div className="flex items-center gap-2 bg-gray-900/80 border border-gray-800/60 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400 font-medium">Genesis 5</span>
            <span className="text-[10px] text-gray-600">Online</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
