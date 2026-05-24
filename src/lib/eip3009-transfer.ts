/**
 * Direct EIP-3009 transfer for human-submitted tasks.
 *
 * Instead of using Circle Gateway (which requires an ERC-20 allowance from the
 * user, which requires an eth_sendTransaction, which requires MetaMask's RPC
 * to work), we use USDC's native transferWithAuthorization:
 *
 * 1. User signs a typed-data message with the USDC contract as verifyingContract
 *    (no network call — purely local signing in MetaMask).
 * 2. Our expense wallet calls transferWithAuthorization on the USDC contract using
 *    the authenticated server-side RPC. USDC verifies the signature and moves funds.
 *
 * No allowance needed. No user transaction. No MetaMask RPC dependency.
 */

import { createWalletClient, createPublicClient, http, parseSignature } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { EIP3009Auth } from "@/types";

const USDC = "0x3600000000000000000000000000000000000000" as const;

const TRANSFER_WITH_AUTH_ABI = [{
  name:             "transferWithAuthorization",
  type:             "function" as const,
  stateMutability:  "nonpayable" as const,
  inputs: [
    { name: "from",        type: "address" },
    { name: "to",          type: "address" },
    { name: "value",       type: "uint256" },
    { name: "validAfter",  type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce",       type: "bytes32" },
    { name: "v",           type: "uint8"   },
    { name: "r",           type: "bytes32" },
    { name: "s",           type: "bytes32" },
  ],
  outputs: [],
}] as const;

export interface TransferResult {
  verified: boolean;
  tx_hash?: `0x${string}`;
  error?: string;
}

export async function settleViaEIP3009(auth: EIP3009Auth): Promise<TransferResult> {
  const rpcUrl    = process.env.ARC_RPC_URL!;
  const pk        = process.env.EXPENSE_WALLET_PRIVATE_KEY as `0x${string}`;
  const sellerAddr = process.env.CIRCLE_WALLET_ADDRESS!;

  // Sanity checks
  if (auth.to.toLowerCase() !== sellerAddr.toLowerCase()) {
    return { verified: false, error: "Payment recipient mismatch" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (now < parseInt(auth.validAfter, 10) || now > parseInt(auth.validBefore, 10)) {
    return { verified: false, error: "Payment authorization expired or not yet valid" };
  }

  const arcChain = {
    id:             5042002,
    name:           "Arc Testnet",
    nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
    rpcUrls:        { default: { http: [rpcUrl] } },
    testnet:        true,
  } as const;

  const account      = privateKeyToAccount(pk);
  const walletClient = createWalletClient({ account, chain: arcChain, transport: http(rpcUrl) });
  const publicClient = createPublicClient({ chain: arcChain,           transport: http(rpcUrl) });

  const { v, r, s } = parseSignature(auth.signature);

  try {
    const hash = await walletClient.writeContract({
      address:      USDC,
      abi:          TRANSFER_WITH_AUTH_ABI,
      functionName: "transferWithAuthorization",
      args: [
        auth.from,
        auth.to,
        BigInt(auth.value),
        BigInt(auth.validAfter),
        BigInt(auth.validBefore),
        auth.nonce,
        Number(v),   // uint8: 27 or 28
        r,
        s,
      ],
    });

    // Arc Testnet confirms in 2-10 seconds; 30s is a safe ceiling.
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });

    if (receipt.status !== "success") {
      return { verified: false, error: "transferWithAuthorization reverted on-chain" };
    }

    return { verified: true, tx_hash: hash };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { verified: false, error: `EIP-3009 transfer failed: ${msg}` };
  }
}
