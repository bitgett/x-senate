"use client";
import { useEffect, useState } from "react";

const BASE = "http://localhost:8000";

export default function OnchainPage() {
  const [market, setMarket] = useState<any>(null);
  const [gas, setGas] = useState<any>(null);
  const [address, setAddress] = useState("");
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [xlayerInfo, setXlayerInfo] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/api/onchain/market/summary`).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/api/onchain/gas`).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/api/onchain/xlayer/info`).then(r => r.ok ? r.json() : null),
    ]).then(([m, g, info]) => {
      setMarket(m);
      setGas(g);
      setXlayerInfo(info);
      setLoadingMarket(false);
    });
  }, []);

  async function lookupPortfolio() {
    if (!address.trim()) return;
    setLoadingPortfolio(true);
    try {
      const res = await fetch(`${BASE}/api/onchain/wallet/${address.trim()}/portfolio`);
      const data = await res.json();
      setPortfolio(data);
    } catch {}
    setLoadingPortfolio(false);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">⛓️ X Layer OnchainOS</h1>
        <p className="text-gray-400 mt-1">
          Live data from OKX OnchainOS Market API & Wallet API on X Layer (chainIndex: 196)
        </p>
      </div>

      {/* X Layer info */}
      {xlayerInfo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Network", value: xlayerInfo.name },
            { label: "Chain Index", value: xlayerInfo.chain_index },
            { label: "Native Token", value: xlayerInfo.native_token },
            { label: "OnchainOS APIs", value: xlayerInfo.onchainos_skills_used?.join(", ") },
          ].map((item) => (
            <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">{item.label}</div>
              <div className="text-white font-semibold text-sm">{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Market Summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">📊 X Layer Market Data</h3>
          <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded-full">
            OKX Market API — Live
          </span>
        </div>
        {loadingMarket ? (
          <div className="text-gray-500 text-sm">Fetching from OKX API...</div>
        ) : market ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">ETH Price (X Layer)</div>
                <div className="text-white font-bold text-lg">
                  ${market?.ETH?.price ? Number(market.ETH.price).toFixed(2) : "N/A"}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">24h Change</div>
                <div className={`font-bold text-lg ${(market?.price_change_24h_pct || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {market?.price_change_24h_pct !== undefined
                    ? `${market.price_change_24h_pct > 0 ? "+" : ""}${market.price_change_24h_pct.toFixed(2)}%`
                    : "N/A"}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-600">
              Data source: {market.data_source} · Used in agent reflection loop
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">Market data unavailable (OKX API offline)</div>
        )}
      </div>

      {/* Gas Price */}
      {gas && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-3">⛽ X Layer Gas Prices</h3>
          <div className="grid grid-cols-3 gap-3">
            {["normal", "fast", "rapid"].map((speed) => (
              <div key={speed} className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 capitalize mb-1">{speed}</div>
                <div className="text-white font-semibold text-sm">
                  {gas?.gas_prices?.[speed] || "0"} Gwei
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">{gas?.note}</p>
        </div>
      )}

      {/* Wallet Portfolio Lookup */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="font-semibold text-white mb-3">👛 Wallet Portfolio Lookup</h3>
        <p className="text-gray-400 text-sm mb-4">
          Query any wallet's holdings on X Layer via OKX Wallet API.
          Used for vote delegation power estimation.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x... wallet address"
            className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:border-purple-500"
            onKeyDown={(e) => e.key === "Enter" && lookupPortfolio()}
          />
          <button
            onClick={lookupPortfolio}
            disabled={loadingPortfolio || !address.trim()}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
          >
            {loadingPortfolio ? "Loading..." : "Lookup"}
          </button>
        </div>

        {portfolio && (
          <div className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-500">Total Portfolio Value (X Layer)</div>
                <div className="text-white font-bold text-xl">
                  ${Number(portfolio.total_usd_value || 0).toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Estimated Voting Power</div>
                <div className="text-purple-400 font-bold text-xl">
                  {Number(portfolio.total_usd_value || 0).toFixed(0)} VP
                </div>
              </div>
            </div>

            {portfolio.tokens && portfolio.tokens.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-2">Token Holdings</div>
                <div className="space-y-1">
                  {portfolio.tokens.slice(0, 5).map((token: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-300">{token.symbol || "Unknown"}</span>
                      <span className="text-gray-400">${Number(token.usd_value || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-600">
              Powered by OKX OnchainOS Wallet API · Chain: {portfolio.chain}
            </p>
          </div>
        )}
      </div>

      {/* OnchainOS Integration Info */}
      <div className="bg-gray-900 border border-purple-800/30 rounded-xl p-5">
        <h3 className="text-purple-400 font-semibold mb-3">🔗 OnchainOS Integration Details</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-white font-medium mb-1">Market API</div>
            <ul className="text-gray-400 space-y-1 text-xs">
              <li>• Real-time ETH price on X Layer (chainIndex: 196)</li>
              <li>• 24h price change for agent reflection loop</li>
              <li>• K-line data for temporal analysis</li>
              <li>• Endpoint: /api/v5/dex/market/price</li>
            </ul>
          </div>
          <div>
            <div className="text-white font-medium mb-1">Wallet API</div>
            <ul className="text-gray-400 space-y-1 text-xs">
              <li>• Portfolio balance queries on X Layer</li>
              <li>• Voting power estimation from token holdings</li>
              <li>• Vote delegation mechanics</li>
              <li>• Endpoint: /api/v5/dex/balance/...</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
