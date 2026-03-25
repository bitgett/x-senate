import Image from "next/image";

export default function Footer() {
  return (
    <footer className="relative border-t border-gray-800/50 bg-[#0a0a0f]">
      {/* top glow line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">

        {/* Left: branding */}
        <div className="flex items-center gap-3">
          <Image
            src="/xlayer-logo.jpg"
            alt="X Layer"
            width={22}
            height={22}
            className="rounded-sm object-cover mix-blend-luminosity opacity-40"
          />
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
