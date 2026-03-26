"use client";
import Image from "next/image";
import { ReactNode } from "react";
import { WalletProvider, useWallet } from "@/contexts/WalletContext";

function WalletModal() {
  const { showModal, closeModal, connect, connectError, connecting } = useWallet();
  if (!showModal) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={closeModal}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <h3 className="text-lg font-bold text-white">Connect Wallet</h3>
          <p className="text-xs text-gray-500 mt-1">Connect to X Layer Mainnet (chainId 196)</p>
          {connectError && (
            <p className="text-xs text-red-400 mt-2 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-1.5">{connectError}</p>
          )}
        </div>
        <div className="space-y-3">
          <button
            onClick={() => connect("metamask")}
            disabled={connecting}
            className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 hover:border-orange-500/50 rounded-xl px-4 py-3.5 transition-all"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
              <Image src="/metamask-logo.svg" alt="MetaMask" width={40} height={40} />
            </div>
            <div className="text-left">
              <div className="font-semibold text-white text-sm">MetaMask</div>
              <div className="text-xs text-gray-500">Browser wallet</div>
            </div>
          </button>
          <button
            onClick={() => connect("okx")}
            disabled={connecting}
            className="w-full flex items-center gap-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 hover:border-gray-500/50 rounded-xl px-4 py-3.5 transition-all"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
              <Image src="/okx-logo.svg" alt="OKX" width={40} height={40} />
            </div>
            <div className="text-left">
              <div className="font-semibold text-white text-sm">OKX Wallet</div>
              <div className="text-xs text-gray-500">Native X Layer</div>
            </div>
          </button>
        </div>
        <button
          onClick={closeModal}
          className="w-full mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors py-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      {children}
      <WalletModal />
    </WalletProvider>
  );
}
