"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * X Layer logo — grid X pattern with two vertical bars on the right.
 * Based on the OKX / X Layer brand mark.
 *
 *  ■■ ·· ■■  | ‖
 *  ■■ ·· ■■  | ‖
 *  ·· ■■ ··  | ‖
 *  ·· ■■ ··
 *  ■■ ·· ■■  | ‖
 *  ■■ ·· ■■  | ‖
 */
function XLayerLogo({
  height = 24,
  color = "#ffffff",
  gradStart,
  gradEnd,
  gradId,
}: {
  height?: number;
  color?: string;
  gradStart?: string;
  gradEnd?: string;
  gradId?: string;
}) {
  const unit  = height / 6;        // 6 rows
  const gap   = unit * 0.16;
  const sq    = unit - gap;
  const r     = sq * 0.14;         // corner radius

  // cells for the X pattern [col, row]
  const xCells: [number, number][] = [
    [0,0],[1,0],[3,0],[4,0],
    [0,1],[1,1],[3,1],[4,1],
    [1,2],[2,2],[3,2],
    [1,3],[2,3],[3,3],
    [0,4],[1,4],[3,4],[4,4],
    [0,5],[1,5],[3,5],[4,5],
  ];

  const fill = gradId ? `url(#${gradId})` : color;
  const barX1 = 5.8 * unit;
  const barX2 = 7.0 * unit;
  const barW1 = sq;
  const barW2 = sq * 0.65;
  const totalW = barX2 + barW2 + gap;

  return (
    <svg width={totalW} height={height} viewBox={`0 0 ${totalW} ${height}`} fill="none">
      {gradId && gradStart && gradEnd && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2={totalW} y2={height} gradientUnits="userSpaceOnUse">
            <stop stopColor={gradStart} />
            <stop offset="1" stopColor={gradEnd} />
          </linearGradient>
        </defs>
      )}

      {/* X pattern */}
      {xCells.map(([col, row]) => (
        <rect
          key={`${col}-${row}`}
          x={col * unit + gap / 2}
          y={row * unit + gap / 2}
          width={sq} height={sq} rx={r}
          fill={fill}
        />
      ))}

      {/* Right vertical bars */}
      <rect x={barX1} y={gap / 2} width={barW1} height={height - gap} rx={r} fill={fill} />
      <rect x={barX2} y={gap / 2} width={barW2} height={height - gap} rx={r * 0.8} fill={fill} />
    </svg>
  );
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

// Export for reuse in Footer etc.
export { XLayerLogo };
