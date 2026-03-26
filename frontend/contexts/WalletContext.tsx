"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { ethers } from "ethers";

const STAKING_ADDRESS = process.env.NEXT_PUBLIC_XSEN_STAKING_ADDRESS ?? "0xc8FD7B12De6bFb10dF3eaCb38AAc09CBbeb25bFD";
const VP_ABI = ["function getEffectiveVP(address) view returns (uint256)"];
const XLAYER = {
  chainId: "0xc4",
  chainName: "X Layer Mainnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: ["https://rpc.xlayer.tech"],
  blockExplorerUrls: ["https://www.okx.com/web3/explorer/xlayer"],
};
const LS_KEY = "xsenate_wallet_v2";

export interface WalletCtx {
  wallet: string | null;
  walletType: "metamask" | "okx" | null;
  effectiveVP: number;
  connecting: boolean;
  connectError: string | null;
  showModal: boolean;
  openModal: () => void;
  closeModal: () => void;
  connect: (type: "metamask" | "okx") => Promise<void>;
  disconnect: () => void;
  rawProvider: () => any;
  refreshVP: () => Promise<void>;
}

const WalletContext = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<"metamask" | "okx" | null>(null);
  const [effectiveVP, setVP] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchVP = useCallback(async (address: string, type: "metamask" | "okx") => {
    try {
      const raw = type === "okx" ? (window as any).okxwallet : (window as any).ethereum;
      if (!raw) return;
      const provider = new ethers.BrowserProvider(raw, { chainId: 196, name: "xlayer" });
      const staking = new ethers.Contract(STAKING_ADDRESS, VP_ABI, provider);
      const vp = await staking.getEffectiveVP(address).catch(() => 0n);
      setVP(Number(ethers.formatEther(vp)));
    } catch {}
  }, []);

  // Auto-reconnect from localStorage on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? "null");
      if (saved?.address && saved?.type) {
        setWallet(saved.address);
        setWalletType(saved.type);
        fetchVP(saved.address, saved.type);
      }
    } catch {}
  }, [fetchVP]);

  async function connect(type: "metamask" | "okx") {
    setShowModal(false);
    setConnectError(null);
    const raw = type === "okx" ? (window as any).okxwallet : (window as any).ethereum;
    if (!raw) {
      alert(type === "okx" ? "OKX Wallet not found. Install from okx.com/web3" : "MetaMask not found.");
      return;
    }
    setConnecting(true);
    try {
      try {
        await raw.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xc4" }] });
      } catch {
        await raw.request({ method: "wallet_addEthereumChain", params: [XLAYER] });
      }
      const accounts = await raw.request({ method: "eth_requestAccounts" });
      const addr = accounts[0];
      setWallet(addr);
      setWalletType(type);
      localStorage.setItem(LS_KEY, JSON.stringify({ address: addr, type }));
      await fetchVP(addr, type);
    } catch (e: any) {
      const msg = e?.code === 4001 ? "연결이 거부되었습니다." : "지갑 연결에 실패했습니다. 다시 시도해주세요.";
      setConnectError(msg);
    }
    setConnecting(false);
  }

  function disconnect() {
    setWallet(null);
    setWalletType(null);
    setVP(0);
    localStorage.removeItem(LS_KEY);
  }

  function rawProvider() {
    return walletType === "okx" ? (window as any).okxwallet : (window as any).ethereum;
  }

  async function refreshVP() {
    if (wallet && walletType) await fetchVP(wallet, walletType);
  }

  return (
    <WalletContext.Provider value={{
      wallet, walletType, effectiveVP, connecting, connectError,
      showModal,
      openModal: () => { setShowModal(true); setConnectError(null); },
      closeModal: () => setShowModal(false),
      connect, disconnect, rawProvider, refreshVP,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
