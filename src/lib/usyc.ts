import { createPublicClient, http, parseUnits, formatUnits, defineChain } from "viem";
import { executeContractCall, getAgentWalletBalance } from "./circle-wallets";
import { insertTreasuryEvent } from "./db";
import type { USYCPosition } from "@/types";
import { OPERATING_RESERVE_USDC, USYC_SWEEP_MULTIPLIER } from "@/types";

// ─── Arc Testnet chain definition ─────────────────────────────────────────────
// [ASSUMED] RPC URL — check arc-canteen config or docs.arc.io for the correct endpoint.

export const arcTestnet = defineChain({
  id:   26,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: [process.env.ARC_RPC_URL ?? "https://rpc.arcnetwork.xyz"] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.arcnetwork.xyz" },
  },
});

export const publicClient = createPublicClient({
  chain:     arcTestnet,
  transport: http(process.env.ARC_RPC_URL ?? "https://rpc.arcnetwork.xyz"),
});

// ─── Contract addresses ───────────────────────────────────────────────────────
// [VERIFIED] Source: docs.arc.io/arc/references/contract-addresses

export const USDC_ADDRESS  = "0x3600000000000000000000000000000000000000" as const;
export const USYC_ADDRESS  = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as const;
export const TELLER_ADDRESS = "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A" as const;

// ─── ABI fragments ────────────────────────────────────────────────────────────
// [ASSUMED] Teller ABI — derived from PRD Section 5 docs + standard Teller pattern.
// MUST retrieve actual ABI from Arc explorer before building. Replace this ABI if
// the explorer shows different function signatures.

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

  // [ASSUMED] USYC has 18 decimals; exchangeRate is scaled 1e18; annualYield is basis points.
  // Verify against Arc explorer. Adjust formatUnits calls if different.
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

export async function sweepIdleUSDCtoUSYC(): Promise<void> {
  const balance  = await getAgentWalletBalance();
  const threshold = OPERATING_RESERVE_USDC * USYC_SWEEP_MULTIPLIER;

  if (balance <= threshold) return;  // nothing to sweep

  const sweepAmount     = balance - OPERATING_RESERVE_USDC;
  const sweepAmountUnits = parseUnits(sweepAmount.toFixed(6), 6).toString();

  // Step 1: approve Teller to spend USDC
  await executeContractCall({
    contractAddress:      USDC_ADDRESS,
    abiFunctionSignature: "approve(address,uint256)",
    abiParameters:        [TELLER_ADDRESS, sweepAmountUnits],
  });

  // Brief delay for approval to land
  await new Promise(r => setTimeout(r, 5000));

  // Step 2: deposit USDC into Teller
  const txId = await executeContractCall({
    contractAddress:      TELLER_ADDRESS,
    abiFunctionSignature: "deposit(uint256)",
    abiParameters:        [sweepAmountUnits],
  });

  await insertTreasuryEvent({
    type:       "sweep",
    amount_usdc: sweepAmount,
    tx_hash:    txId,
    arc_link:   `${arcTestnet.blockExplorers.default.url}/tx/${txId}`,
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

  const txId = await executeContractCall({
    contractAddress:      TELLER_ADDRESS,
    abiFunctionSignature: "redeem(uint256)",
    abiParameters:        [redeemUnitsRaw],
  });

  await insertTreasuryEvent({
    type:       "redeem",
    amount_usdc: redeemUsdcTarget,
    tx_hash:    txId,
    arc_link:   `${arcTestnet.blockExplorers.default.url}/tx/${txId}`,
  });
}
