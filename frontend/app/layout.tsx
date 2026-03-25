import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "X-Senate | Agentic Governance Layer",
  description: "Multi-AI governance system for DAOs — powered by Genesis 5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0a0a0f] text-gray-100">
        {/* Top Nav */}
        <nav className="border-b border-gray-800 px-6 py-3 flex items-center justify-between sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span>X-Senate</span>
            <span className="text-xs font-normal text-gray-500 ml-1">Agentic Governance</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/app" className="hover:text-white transition-colors">Proposals</Link>
            <Link href="/sentinel" className="hover:text-white transition-colors">Sentinel</Link>
            <Link href="/agents" className="hover:text-white transition-colors">Agents</Link>
            <Link href="/projects" className="hover:text-white transition-colors">Projects</Link>
            <Link href="/stake" className="hover:text-white transition-colors">Stake</Link>
            <Link href="/onchain" className="hover:text-white transition-colors">X Layer</Link>
            <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-full px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-xs text-gray-300">Genesis 5 Online</span>
            </div>
          </div>
        </nav>
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">{children}</main>
        <footer className="border-t border-gray-800 px-6 py-3 text-center text-xs text-gray-600">
          X-Senate v0.1 · Powered by Claude AI · X Layer Onchain OS
        </footer>
      </body>
    </html>
  );
}
