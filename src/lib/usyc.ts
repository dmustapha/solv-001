import { createPublicClient, http, parseUnits, formatUnits } from "viem";
import { executeContractCall, getAgentWalletBalance, waitForTransactionHash } from "./circle-wallets";
import { insertTreasuryEvent } from "./db";
import { arcTestnet, ARC_USDC_ADDRESS, ARC_USYC_ADDRESS, ARC_TELLER_ADDRESS } from "./chains";
import type { USYCPosition } from "@/types";
import { OPERATING_RESERVE_USDC, USYC_SWEEP_MULTIPLIER } from "@/types";

export { arcTestnet };  // re-export for callers that imported from here

// Module-level USYC allowlist status — updated on each sweep attempt
let _usycAllowlistStatus: "active" | "pending" = "active";
export function getUsycStatus(): "active" | "pending" { return _usycAllowlistStatus; }

export const publicClient = createPublicClient({
  chain:     arcTestnet,
  transport: http(process.env.ARC_RPC_URL ?? "https://rpc.arcnetwork.xyz"),
});

// ─── Contract addresses (re-exported from chains.ts) ─────────────────────────

export const USDC_ADDRESS   = ARC_USDC_ADDRESS;
export const USYC_ADDRESS   = ARC_USYC_ADDRESS;
export const TELLER_ADDRESS = ARC_TELLER_ADDRESS;

// ─── ABI fragments ────────────────────────────────────────────────────────────

const TELLER_ABI = [
  {
    name:    "deposit",
    type:    "function",
    inputs:  [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name:    "redeem",
    type:    "function",
    inputs:  [{ name: "usycAmount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name:    "exchangeRate",
    type:    "function",
    inputs:  [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name:    "annualYield",
    type:    "function",
    inputs:  [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const ERC20_BALANCE_ABI = [
  {
    name:    "balanceOf",
    type:    "function",
    inputs:  [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// ─── Read USYC position ───────────────────────────────────────────────────────

export async function getUSYCPosition(walletAddress: `0x${string}`): Promise<USYCPosition> {
  const [rawBalance, rawRate, rawYield] = await Promise.all([
    publicClient.readContract({
      address: USYC_ADDRESS,
      abi:     ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args:    [walletAddress],
    }),
    publicClient.readContract({
      address: TELLER_ADDRESS,
      abi:     TELLER_ABI,
      functionName: "exchangeRate",
    }),
    publicClient.readContract({
      address: TELLER_ADDRESS,
      abi:     TELLER_ABI,
      functionName: "annualYield",
    }),
  ]);

  // USYC has 18 decimals; exchangeRate is scaled 1e18; annualYield is basis points.
  const usycBalance   = rawBalance as bigint;
  const exchangeRate  = parseFloat(formatUnits(rawRate as bigint, 18));
  const annualYieldBp = Number(rawYield as bigint);
  const apy           = annualYieldBp / 10_000;
  const usdcValue     = exchangeRate > 0
    ? parseFloat(formatUnits(usycBalance, 18)) * exchangeRate
    : 0;

  return {
    usyc_balance:  usycBalance,
    exchange_rate: exchangeRate,
    usdc_value:    usdcValue,
    apy,
  };
}

// ─── Sweep idle USDC into USYC ────────────────────────────────────────────────
// Requires Circle Support allowlisting. Will fail until approved.
// Step 1: USDC.approve(teller, amount) via Circle Wallets API
// Step 2: Teller.deposit(amount) via Circle Wallets API

export async function sweepIdleUSDCtoUSYC(overrideAmountUsdc?: number): Promise<void> {
  try {
    await _sweepIdleUSDCtoUSYC(overrideAmountUsdc);
    _usycAllowlistStatus = "active";
  } catch (err) {
    const msg = String(err).toLowerCase();
    // Mark as pending allowlist if the error is an allowlist/permission rejection
    if (msg.includes("allowlist") || msg.includes("not authorized") || msg.includes("revert")) {
      _usycAllowlistStatus = "pending";
    }
    throw err; // re-throw so callers can suppress non-critical failures
  }
}

async function _sweepIdleUSDCtoUSYC(overrideAmountUsdc?: number): Promise<void> {
  const balance  = await getAgentWalletBalance();

  let sweepAmount: number;
  if (overrideAmountUsdc !== undefined && overrideAmountUsdc > 0) {
    // Reasoning-driven: use the specified amount, capped to available above reserve
    sweepAmount = Math.min(overrideAmountUsdc, Math.max(0, balance - OPERATING_RESERVE_USDC));
    if (sweepAmount <= 0) return;
  } else {
    // Mechanical threshold fallback
    const threshold = OPERATING_RESERVE_USDC * USYC_SWEEP_MULTIPLIER;
    if (balance <= threshold) return;
    sweepAmount = balance - OPERATING_RESERVE_USDC;
  }
  const sweepAmountUnits = parseUnits(sweepAmount.toFixed(6), 6).toString();

  // Step 1: approve Teller to spend USDC — wait for confirmation before depositing
  const approveTxId = await executeContractCall({
    contractAddress:      USDC_ADDRESS,
    abiFunctionSignature: "approve(address,uint256)",
    abiParameters:        [TELLER_ADDRESS, sweepAmountUnits],
  });
  await waitForTransactionHash(approveTxId);  // deterministic wait vs 5s sleep

  // Step 2: deposit USDC into Teller
  const depositTxId   = await executeContractCall({
    contractAddress:      TELLER_ADDRESS,
    abiFunctionSignature: "deposit(uint256)",
    abiParameters:        [sweepAmountUnits],
  });
  const depositTxHash = await waitForTransactionHash(depositTxId);

  await insertTreasuryEvent({
    type:       "sweep",
    amount_usdc: sweepAmount,
    tx_hash:    depositTxHash ?? depositTxId,
    arc_link:   depositTxHash
      ? `${arcTestnet.blockExplorers.default.url}/tx/${depositTxHash}`
      : undefined,
  });
}

// ─── Redeem USYC back to USDC when balance is low ────────────────────────────

export async function redeemUSYCIfNeeded(walletAddress: `0x${string}`): Promise<void> {
  const [usdcBalance, position] = await Promise.all([
    getAgentWalletBalance(),
    getUSYCPosition(walletAddress),
  ]);

  if (usdcBalance >= OPERATING_RESERVE_USDC) return;
  if (position.usyc_balance === 0n) return;

  const redeemUsdcTarget = OPERATING_RESERVE_USDC - usdcBalance;
  const redeemUsycUnits  = redeemUsdcTarget / position.exchange_rate;
  const redeemUnitsRaw   = parseUnits(redeemUsycUnits.toFixed(18), 18).toString();

  const txId   = await executeContractCall({
    contractAddress:      TELLER_ADDRESS,
    abiFunctionSignature: "redeem(uint256)",
    abiParameters:        [redeemUnitsRaw],
  });
  const txHash = await waitForTransactionHash(txId);

  await insertTreasuryEvent({
    type:        "redeem",
    amount_usdc: redeemUsdcTarget,
    tx_hash:     txHash ?? txId,
    arc_link:    txHash
      ? `${arcTestnet.blockExplorers.default.url}/tx/${txHash}`
      : undefined,
  });
}
