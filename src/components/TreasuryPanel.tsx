"use client";

import type { TreasuryState } from "@/types";

interface Props { treasury: TreasuryState | null; }

export default function TreasuryPanel({ treasury }: Props) {
  const fmt = (n: number) => n.toFixed(4);
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

  return (
    <div className="bg-[#0D1016] border border-[#18202E] rounded-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#18202E] flex items-center justify-between shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-[#60788A]">Treasury</span>
        {treasury && (
          <span className="text-[10px] font-mono text-[#283040]">
            {new Date(treasury.last_updated).toLocaleTimeString()}
          </span>
        )}
      </div>

      {!treasury && (
        <div className="px-4 py-6 text-[11px] text-[#283040] animate-pulse">Loading...</div>
      )}

      {treasury && (
        <div className="px-4 py-3 flex flex-col overflow-y-auto scrollbar-thin">
          {/* USDC — hero metric */}
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest text-[#60788A] mb-1.5">USDC Balance</div>
            <div className="text-[22px] leading-none font-mono text-[#00C8FF]">
              ${fmt(treasury.usdc_balance)}
            </div>
          </div>

          {/* USYC */}
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest text-[#60788A] mb-1.5">USYC Position</div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[18px] leading-none font-mono text-[#E09820]">
                ${fmt(treasury.usyc_usdc_value)}
              </span>
              <span className="text-[10px] font-mono text-[#E09820]/60 border border-[#E09820]/25 px-1.5 py-0.5 rounded-sm">
                {pct(treasury.usyc_apy)} APY
              </span>
            </div>
          </div>

          {/* Pending */}
          <div className="flex items-center justify-between py-2 border-t border-[#18202E]">
            <span className="text-[11px] text-[#60788A]">Pending income</span>
            <span className="text-[13px] font-mono text-[#4B8BF0]">
              ${fmt(treasury.pending_income_usdc)}
            </span>
          </div>

          {/* Today */}
          <div className="mt-3 pt-3 border-t border-[#18202E]">
            <div className="text-[10px] uppercase tracking-widest text-[#283040] mb-2">Today</div>
            <div className="flex flex-col gap-1.5">
              <Row label="Income"  value={`+$${fmt(treasury.today_income_usdc)}`}  color="#16C97A" />
              <Row label="Expense" value={`-$${fmt(treasury.today_expense_usdc)}`} color="#F04858" />
              <Row
                label="Net"
                value={`${treasury.today_net_usdc >= 0 ? "+" : ""}$${fmt(treasury.today_net_usdc)}`}
                color={treasury.today_net_usdc >= 0 ? "#16C97A" : "#F04858"}
                bold
              />
            </div>
          </div>

          {/* All-time */}
          <div className="mt-3 pt-3 border-t border-[#18202E]">
            <div className="flex flex-col gap-1.5">
              <Row label="Tasks completed" value={String(treasury.total_tasks_completed)}          color="#D6E0EC" />
              <Row label="All-time income"  value={`$${fmt(treasury.total_income_all_time_usdc)}`} color="#D6E0EC" />
            </div>
          </div>

          {/* Arc link */}
          <a
            href={`${process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://explorer.arcnetwork.xyz"}/address/${process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS ?? "0x927c1d756d12879aebea0772f3ee220f21f4841a"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 pt-3 border-t border-[#18202E] text-[10px] text-[#283040] hover:text-[#4B8BF0] transition-colors flex items-center gap-1"
          >
            View on Arc Explorer ↗
          </a>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: string;
  color: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-[#60788A]">{label}</span>
      <span
        className={`text-[12px] font-mono ${bold ? "font-semibold" : ""}`}
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}
