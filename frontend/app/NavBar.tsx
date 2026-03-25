"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// X Layer grid-X logo — each instance needs a unique gradient id to avoid SVG conflicts
function XLayerLogo({ size = 20, gradId = "xlG0", bright = false }: { size?: number; gradId?: string; bright?: boolean }) {
  const cells: [number, number][] = [
    [0,0],[1,0],[3,0],[4,0],
    [0,1],[4,1],
    [2,2],
    [0,3],[4,3],
    [0,4],[1,4],[3,4],[4,4],
  ];
  const s = size / 5;
  const gap = s * 0.18;
  const cell = s - gap;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2={size} y2={size} gradientUnits="userSpaceOnUse">
          <stop stopColor={bright ? "#93c5fd" : "#60a5fa"} />
          <stop offset="1" stopColor={bright ? "#c4b5fd" : "#a78bfa"} />
        </linearGradient>
      </defs>
      {cells.map(([col, row]) => (
        <rect
          key={`${col}-${row}`}
          x={col * s + gap / 2}
          y={row * s + gap / 2}
          width={cell}
          height={cell}
          rx={cell * 0.15}
          fill={`url(#${gradId})`}
        />
      ))}
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/sentinel", label: "Sentinel",  num: "01" },
  { href: "/app",      label: "Proposals", num: "02" },
  { href: "/agents",   label: "Agents",    num: "03" },
  { href: "/stake",    label: "Stake",     num: "04" },
  { href: "/projects", label: "Projects",  num: null },
  { href: "/onchain",  label: "X Layer",   num: null, icon: true },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800/60 bg-[#0a0a0f]/90 backdrop-blur-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* ── Logo ── */}
        <Link href="/" className="flex items-center gap-3 group">
          {/* X Layer grid logo */}
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gray-900 border border-gray-700/60 group-hover:border-purple-500/50 transition-all overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 group-hover:from-blue-600/20 group-hover:to-purple-600/20 transition-all" />
            <div className="relative">
              <XLayerLogo size={22} gradId="xlLogo" />
            </div>
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
                  <span className={`transition-all ${isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}>
                    <XLayerLogo size={13} gradId={`xlNav-${item.href}`} bright={isActive} />
                  </span>
                )}
                <span>{item.label}</span>
                {item.num && (
                  <span className={`text-[9px] font-mono ${isActive ? "text-purple-400" : "text-gray-600 group-hover:text-gray-400"} transition-colors`}>
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
