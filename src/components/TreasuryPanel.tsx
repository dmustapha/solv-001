"use client";

import type { TreasuryState } from "@/types";

interface Props { treasury: TreasuryState | null; }

export default function TreasuryPanel({ treasury }: Props) {
  const fmt = (n: number) => n.toFixed(4);
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">Treasury</h2>
        {treasury && (
          <span className="text-xs text-gray-500">
            {new Date(treasury.last_updated).toLocaleTimeString()}
          </span>
        )}
      </div>

      {!treasury && (
        <div className="text-xs text-gray-500 animate-pulse">Loading treasury state...</div>
      )}

      {treasury && (
        <>
          <StatRow
            label="USDC Balance"
            value={`$${fmt(treasury.usdc_balance)}`}
            color="text-green-400"
          />
          <StatRow
            label="USYC Position"
            value={`$${fmt(treasury.usyc_usdc_value)}`}
            sub={`${pct(treasury.usyc_apy)} APY`}
            color="text-yellow-400"
          />
          <StatRow
            label="Pending Income"
            value={`$${fmt(treasury.pending_income_usdc)}`}
            color="text-blue-400"
          />

          <div className="border-t border-gray-800 pt-2 mt-1">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Today</div>
            <StatRow label="Income"  value={`+$${fmt(treasury.today_income_usdc)}`}  color="text-green-400" />
            <StatRow label="Expense" value={`-$${fmt(treasury.today_expense_usdc)}`} color="text-red-400" />
            <StatRow
              label="Net"
              value={`${treasury.today_net_usdc >= 0 ? "+" : ""}$${fmt(treasury.today_net_usdc)}`}
              color={treasury.today_net_usdc >= 0 ? "text-green-400" : "text-red-400"}
            />
          </div>

          <div className="border-t border-gray-800 pt-2 mt-1">
            <StatRow
              label="Tasks completed"
              value={String(treasury.total_tasks_completed)}
              color="text-gray-300"
            />
            <StatRow
              label="All-time income"
              value={`$${fmt(treasury.total_income_all_time_usdc)}`}
              color="text-gray-300"
            />
          </div>

          <a
            href={`${process.env.NEXT_PUBLIC_ARC_EXPLORER_URL}/address/${process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 underline mt-1"
          >
            View on Arc Explorer ↗
          </a>
        </>
      )}
    </div>
  );
}

function StatRow({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?:  string;
  color: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-mono font-medium ${color}`}>{value}</span>
        {sub && <div className="text-xs text-gray-500">{sub}</div>}
      </div>
    </div>
  );
}
