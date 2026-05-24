/**
 * Single source of truth for shared constants.
 * Import from here — do not re-declare in individual components.
 */

export const ARC_CHAIN_ID  = 5042002;
export const ARC_CHAIN_HEX = "0x4cef52" as const;

export const ARC_EXPLORER_URL =
  process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://explorer.arcnetwork.xyz";

export const TASK_LABELS: Record<string, string> = {
  wallet_intelligence:    "Wallet Intelligence",
  counterparty_vet:       "Counterparty Vetting",
  contract_summary:       "Contract Summary",
  conditional_payment:    "Conditional Payment",
  scheduled_disbursement: "Scheduled Disbursement",
  wallet_watch:           "Wallet Watch",
  contract_watch:         "Contract Watch",
  general:                "General Analysis",
};
