"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SolvLogo from "@/components/SolvLogo";

const NAV_TABS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Status",    href: "/status" },
  { label: "Proof",     href: "/proof" },
];

interface Props {
  walletAddress?:  `0x${string}` | null;
  usdcBalance?:    number | null;
  isOnArcTestnet?: boolean;
  onConnect?:      () => void;
  onSwitchChain?:  () => void;
  onDisconnect?:   () => void;
}

export default function AppNav({
  walletAddress,
  usdcBalance,
  isOnArcTestnet,
  onConnect,
  onSwitchChain,
  onDisconnect,
}: Props) {
  const pathname = usePathname();

  return (
    <nav
      className="h-12 flex items-center justify-between px-5 border-b shrink-0"
      style={{ background: "var(--surf)", borderColor: "var(--wire)" }}
    >
      {/* Left: logo + page tabs */}
      <div className="flex items-center gap-5">
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0 transition-opacity hover:opacity-70"
        >
          <SolvLogo size={18} />
          <span
            className="font-mono font-semibold text-[13px] tracking-widest"
            style={{ color: "var(--amber)" }}
          >
            SOLV-001
          </span>
        </Link>
        <span className="h-3 w-px shrink-0" style={{ background: "var(--wire-2)" }} />
        <div className="flex items-center">
          {NAV_TABS.map(tab => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="px-3 py-1.5 text-[13px] font-medium transition-colors"
                style={{
                  color:        active ? "var(--amber)"  : "var(--text-2)",
                  borderBottom: active ? "2px solid var(--amber)" : "2px solid transparent",
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text-1)";
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text-2)";
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right: chain indicator + wallet */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
            style={{ background: "var(--green)" }}
          />
          <span className="text-[11px] font-mono" style={{ color: "var(--text-2)" }}>
            Arc Testnet
          </span>
        </div>

        {/* Not connected */}
        {onConnect && !walletAddress && (
          <button
            type="button"
            onClick={onConnect}
            className="px-3 py-1.5 text-[12px] font-medium border transition-all"
            style={{ borderColor: "var(--amber)", color: "var(--amber)", background: "transparent" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,160,16,0.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            Connect Wallet
          </button>
        )}

        {/* Wrong chain */}
        {onSwitchChain && walletAddress && !isOnArcTestnet && (
          <button
            type="button"
            onClick={onSwitchChain}
            className="px-3 py-1.5 text-[12px] font-medium border transition-all"
            style={{ borderColor: "var(--amber)", color: "var(--amber)", background: "transparent" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,160,16,0.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            Switch to Arc Testnet
          </button>
        )}

        {/* Connected + right chain */}
        {walletAddress && isOnArcTestnet && (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-3 py-1.5 border"
              style={{
                background:  "rgba(0,200,128,0.05)",
                borderColor: "rgba(0,200,128,0.2)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--green)" }} />
              <span className="text-[11px] font-mono" style={{ color: "var(--text-2)" }}>
                {walletAddress.slice(0, 6)}&hellip;{walletAddress.slice(-4)}
              </span>
              {usdcBalance != null && (
                <>
                  <span style={{ color: "var(--wire-2)" }}>·</span>
                  <span className="text-[12px] font-mono font-medium" style={{ color: "var(--amber)" }}>
                    ${usdcBalance.toFixed(2)}
                  </span>
                </>
              )}
            </div>
            {onDisconnect && (
              <button
                type="button"
                onClick={onDisconnect}
                className="text-[11px] transition-colors px-1.5"
                style={{ color: "var(--text-3)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--red)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-3)"; }}
                title="Disconnect wallet"
              >
                Disconnect
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
