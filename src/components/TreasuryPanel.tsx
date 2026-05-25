"use client";

import { ARC_EXPLORER_URL } from "@/lib/constants";
import type { TreasuryState } from "@/types";

interface Props { treasury: TreasuryState | null; }

export default function TreasuryPanel({ treasury }: Props) {
  const fmt = (n: number) => n.toFixed(4);
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

  return (
    <div className="panel flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <span className="label">Treasury</span>
        {treasury && (
          <span className="text-[10px] font-mono" style={{ color: "var(--text-3)" }}>
            {new Date(treasury.last_updated).toLocaleTimeString()}
          </span>
        )}
      </div>

      {!treasury && (
        <div className="px-4 py-4 flex flex-col gap-4">
          <div>
            <div className="skeleton h-2 w-16 mb-2 rounded" />
            <div className="skeleton h-7 w-28" />
          </div>
          <div className="pt-3 border-t" style={{ borderColor: "var(--wire)" }}>
            <div className="skeleton h-2 w-20 mb-2 rounded" />
            <div className="skeleton h-6 w-24" />
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-4/5" />
            <div className="skeleton h-3.5 w-3/5" />
          </div>
          <div className="pt-3 border-t flex flex-col gap-2" style={{ borderColor: "var(--wire)" }}>
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-4/5" />
          </div>
        </div>
      )}

      {treasury && (
        <div className="px-4 py-3 flex flex-col overflow-y-auto scrollbar-thin gap-0">

          {/* USDC — hero metric */}
          <div className="mb-4">
            <div className="label mb-1.5">USDC Balance</div>
            <div
              className="text-[24px] leading-none font-mono font-semibold"
              style={{ color: "var(--amber)" }}
            >
              ${fmt(treasury.usdc_balance)}
            </div>
          </div>

          {/* USYC */}
          <div className="mb-4 pt-3 border-t" style={{ borderColor: "var(--wire)" }}>
            <div className="label mb-1.5">USYC Position</div>
            <div className="flex items-baseline gap-2.5">
              <span
                className="text-[20px] leading-none font-mono font-semibold"
                style={{ color: "var(--green)" }}
              >
                ${fmt(treasury.usyc_usdc_value)}
              </span>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 border"
                style={{
                  color:        "var(--green)",
                  borderColor:  "rgba(0,200,128,0.25)",
                  background:   "rgba(0,200,128,0.06)",
                }}
              >
                {pct(treasury.usyc_apy)} APY
              </span>
            </div>
            {treasury.usyc_status === "pending" && (
              <div className="text-[10px] mt-1" style={{ color: "var(--text-3)" }}>
                Pending Circle approval
              </div>
            )}
          </div>

          {/* Ops wallet */}
          {treasury.expense_wallet_address && (
            <div className="mb-4 pt-3 border-t" style={{ borderColor: "var(--wire)" }}>
              <div className="label mb-1.5">Ops Wallet</div>
              <div
                className="text-[18px] leading-none font-mono font-semibold"
                style={{ color: "var(--blue)" }}
              >
                ${fmt(treasury.expense_wallet_usdc)}
              </div>
              <a
                href={`${ARC_EXPLORER_URL}/address/${treasury.expense_wallet_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono mt-1 block link-hover link-hover-blue"
                style={{ color: "var(--text-3)" }}
              >
                {treasury.expense_wallet_address.slice(0, 10)}…{treasury.expense_wallet_address.slice(-6)} ↗
              </a>
            </div>
          )}

          {/* Pending income */}
          <div
            className="flex items-center justify-between py-2.5 border-t border-b"
            style={{ borderColor: "var(--wire)" }}
          >
            <span className="text-[11px]" style={{ color: "var(--text-2)" }}>
              Pending income
            </span>
            <span className="text-[13px] font-mono" style={{ color: "var(--blue)" }}>
              ${fmt(treasury.pending_income_usdc)}
            </span>
          </div>

          {/* Today */}
          <div className="mt-3">
            <div className="label mb-2">Today</div>
            <div className="flex flex-col gap-1.5">
              <Row label="Income"  value={`+$${fmt(treasury.today_income_usdc)}`}  color="var(--green)" />
              <Row label="Expense" value={`-$${fmt(treasury.today_expense_usdc)}`} color="var(--red)" />
              <Row
                label="Net"
                value={`${treasury.today_net_usdc >= 0 ? "+" : ""}$${fmt(treasury.today_net_usdc)}`}
                color={treasury.today_net_usdc >= 0 ? "var(--green)" : "var(--red)"}
                bold
              />
            </div>
          </div>

          {/* All-time */}
          <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--wire)" }}>
            <div className="flex flex-col gap-1.5">
              <Row label="Tasks completed"         value={String(treasury.total_tasks_completed)}          color="var(--text-1)" />
              <Row label="All-time income"          value={`$${fmt(treasury.total_income_all_time_usdc)}`} color="var(--text-1)" />
              {treasury.total_contributions_usdc > 0 && (
                <Row label="Ecosystem contributions" value={`$${fmt(treasury.total_contributions_usdc)}`} color="var(--green)" />
              )}
            </div>
          </div>

          {/* Arc Explorer link */}
          <a
            href={`${ARC_EXPLORER_URL}/address/${process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS ?? "0x927c1d756d12879aebea0772f3ee220f21f4841a"}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 pt-3 border-t text-[10px] font-mono flex items-center gap-1 link-hover link-hover-blue"
            style={{ borderColor: "var(--wire)", color: "var(--text-3)" }}
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
      <span className="text-[11px]" style={{ color: "var(--text-2)" }}>{label}</span>
      <span
        className={`text-[12px] font-mono ${bold ? "font-semibold" : ""}`}
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}
