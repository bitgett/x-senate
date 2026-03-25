// X Layer grid-X logo (matches OKX / X Layer brand mark)
function XLayerLogoMono({ size = 20 }: { size?: number }) {
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
      {cells.map(([col, row]) => (
        <rect
          key={`${col}-${row}`}
          x={col * s + gap / 2}
          y={row * s + gap / 2}
          width={cell}
          height={cell}
          rx={cell * 0.15}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="relative border-t border-gray-800/50 bg-[#0a0a0f]">
      {/* top glow line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">

        {/* Left: branding */}
        <div className="flex items-center gap-3">
          <div className="text-gray-600">
            <XLayerLogoMono size={22} />
          </div>
          <div className="text-xs leading-snug">
            <p className="text-gray-300 font-semibold tracking-tight">
              X-Senate — Built for X Layer.
            </p>
            <p className="text-gray-600">Incubated by Quack AI.</p>
          </div>
        </div>

        {/* Center: chain info */}
        <div className="flex items-center gap-2 text-[11px] text-gray-700 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
          <span>X Layer Mainnet</span>
          <span className="text-gray-800">·</span>
          <span>chainId 196</span>
        </div>

        {/* Right: links */}
        <div className="flex items-center gap-4 text-xs text-gray-700">
          <a
            href="https://www.okx.com/web3/explorer/xlayer"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            Explorer
          </a>
          <span className="text-gray-800">·</span>
          <a
            href="https://github.com/bitgett/x-senate"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            GitHub
          </a>
          <span className="text-gray-800">·</span>
          <span className="text-gray-800">Genesis 5</span>
        </div>
      </div>
    </footer>
  );
}
