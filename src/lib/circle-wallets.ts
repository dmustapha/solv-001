import {
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";
import type { WalletInfo } from "@/types";

// ─── Client singleton ─────────────────────────────────────────────────────────
let _client: ReturnType<typeof initiateDeveloperControlledWalletsClient> | null = null;

function getClient() {
  if (!_client) {
    _client = initiateDeveloperControlledWalletsClient({
      apiKey:       process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    });
  }
  return _client;
}

// ─── Wallet operations ────────────────────────────────────────────────────────

export async function getAgentWallet(): Promise<WalletInfo> {
  const client = getClient();
  const walletId = process.env.CIRCLE_WALLET_ID!;

  const response  = await client.getWallet({ id: walletId });
  const wallet    = response.data!.wallet;
  const balances  = await client.getWalletTokenBalance({ id: walletId });
  const usdcEntry = balances.data?.tokenBalances?.find(
    (b: { token?: { symbol?: string }; amount?: string }) => b.token?.symbol === "USDC"
  );

  return {
    wallet_id:    wallet.id!,
    address:      wallet.address as `0x${string}`,
    usdc_balance: usdcEntry ? parseFloat(usdcEntry.amount!) : 0,
    blockchain:   "ARC-TESTNET",
  };
}

export async function getAgentWalletBalance(): Promise<number> {
  const info = await getAgentWallet();
  return info.usdc_balance;
}

// ─── Contract execution (used for USYC operations) ───────────────────────────
// POST /transactions/contractExecution
// Source: developers.circle.com/wallets/dev-controlled

export interface ContractCallParams {
  contractAddress: string;
  abiFunctionSignature: string;
  abiParameters: string[];
  maxFeeInUSDC?: string;
}

export async function executeContractCall(params: ContractCallParams): Promise<string> {
  const client   = getClient();
  const walletId = process.env.CIRCLE_WALLET_ID!;

  const response = await client.createContractExecutionTransaction({
    walletId,
    contractAddress:      params.contractAddress,
    abiFunctionSignature: params.abiFunctionSignature,
    abiParameters:        params.abiParameters,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  return response.data!.id!;  // Circle transaction ID (not Arc tx hash)
}

// ─── USDC transfer (disbursements) ───────────────────────────────────────────

export async function transferUSDC(params: {
  toAddress: string;
  amountUsdc: number;
}): Promise<string> {
  const client      = getClient();
  const walletId    = process.env.CIRCLE_WALLET_ID!;
  const amountUnits = (params.amountUsdc * 1_000_000).toFixed(0);  // 6 decimals

  const response = await client.createTransaction({
    walletId,
    tokenId:            process.env.CIRCLE_USDC_TOKEN_ID ?? "",  // set CIRCLE_USDC_TOKEN_ID in env
    destinationAddress: params.toAddress,
    amount:             [amountUnits],
    fee: { type: "level" as const, config: { feeLevel: "MEDIUM" as const } },
  });

  return response.data!.id!;
}

// ─── Wait for transaction confirmation ───────────────────────────────────────

export async function waitForTransactionHash(txId: string): Promise<`0x${string}` | null> {
  const client = getClient();
  const maxAttempts = 8;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const response = await client.getTransaction({ id: txId });
    const tx       = response.data!.transaction;

    if (tx?.state === "COMPLETE" && tx.txHash) {
      return tx.txHash as `0x${string}`;
    }
    if (tx?.state === "FAILED" || tx?.state === "CANCELLED") {
      return null;
    }
  }
  return null;
}
