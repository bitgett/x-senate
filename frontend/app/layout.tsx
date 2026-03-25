import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./NavBar";

export const metadata: Metadata = {
  title: "X-Senate | AI Governance for X Layer",
  description: "Five AI agents. One senate. Every project on X Layer.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#0a0a0f] text-gray-100">
        <NavBar />
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">{children}</main>
        <footer className="border-t border-gray-800/50 px-6 py-3 text-center text-xs text-gray-700">
          X-Senate · AI Governance Infrastructure · X Layer chainId 196
        </footer>
      </body>
    </html>
  );
}
