"use client";

import Link from "next/link";
import Dashboard from "@/components/Dashboard";

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Terminal chrome nav */}
      <header
        className="flex items-center justify-between px-5 py-2.5 border-b shrink-0"
        style={{ borderColor: "var(--wire)", background: "var(--surf)" }}
      >
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="text-[12px] font-mono font-semibold tracking-widest transition-colors"
            style={{ color: "var(--amber)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          >
            ← SOLV-001
          </Link>
          <span className="h-3 w-px" style={{ background: "var(--wire-2)" }} />
          <span
            className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "var(--text-3)" }}
          >
            Agent Dashboard · Arc Testnet · eip155:26
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-mono uppercase tracking-widest hidden sm:block"
            style={{ color: "var(--text-3)" }}
          >
            Circle 4-Tool Stack
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--green)", animation: "pulseDot 2s ease-in-out infinite" }}
            />
            <span
              className="text-[10px] font-mono"
              style={{ color: "var(--green)" }}
            >
              LIVE
            </span>
          </div>
        </div>
      </header>

      {/* Dashboard fills remaining height */}
      <div className="flex-1 min-h-0 px-4 pt-3 pb-3">
        <Dashboard />
      </div>
    </div>
  );
}
