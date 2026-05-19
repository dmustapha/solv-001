import { getAgentWallet }          from "@/lib/circle-wallets";
import { getUSYCPosition }         from "@/lib/usyc";
import { getTodayStats, getAllTimeStats } from "@/lib/db";
import type { TreasuryState }      from "@/types";
import { OPERATING_RESERVE_USDC }  from "@/types";

export async function GET(): Promise<Response> {
  let wallet = { address: (process.env.CIRCLE_WALLET_ADDRESS ?? "0x0") as `0x${string}`, usdc_balance: 0 };
  try {
    wallet = await getAgentWallet();
  } catch {
    // Circle API unavailable or wallet unfunded — fall back to zero balance
  }

  let usycPosition = { usyc_balance: 0n, exchange_rate: 1, usdc_value: 0, apy: 0.0485 };
  try {
    usycPosition = await getUSYCPosition(wallet.address);
  } catch {
    // USYC RPC may be unavailable; return zeros
  }

  const [today, allTime] = await Promise.all([
    getTodayStats(),
    getAllTimeStats(),
  ]);

  const state: TreasuryState = {
    usdc_balance:               wallet.usdc_balance,
    usyc_balance:               parseFloat(usycPosition.usyc_balance.toString()) / 1e18,
    usyc_usdc_value:            usycPosition.usdc_value,
    usyc_apy:                   usycPosition.apy,
    pending_income_usdc:        allTime.pending_income,
    today_income_usdc:          today.income,
    today_expense_usdc:         today.expense,
    today_net_usdc:             today.income - today.expense,
    operating_reserve_usdc:     OPERATING_RESERVE_USDC,
    total_tasks_completed:      allTime.total_completed,
    total_income_all_time_usdc: allTime.total_income,
    last_updated:               new Date(),
  };

  return Response.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
