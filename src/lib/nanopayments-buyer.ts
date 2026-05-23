import { GatewayClient } from "@circle-fin/x402-batching/client";
import type { NanopaymentExpense } from "@/types";

// ─── GatewayClient singleton ──────────────────────────────────────────────────
// Uses a separate EOA — Circle Dev-Controlled Wallets cannot be used here
// because GatewayClient requires a raw private key for signature generation.
// EOA requirement verified: developers.circle.com/gateway/nanopayments/quickstarts/buyer

let _gatewayClient: GatewayClient | null = null;

function getGatewayClient(): GatewayClient {
  if (!_gatewayClient) {
    const privateKey = (process.env.EXPENSE_WALLET_PRIVATE_KEY ?? "").trim();
    if (!privateKey) throw new Error("EXPENSE_WALLET_PRIVATE_KEY not set");

    _gatewayClient = new GatewayClient({
      chain:      "arcTestnet",
      privateKey: privateKey as `0x${string}`,
    });
  }
  return _gatewayClient;
}

// ─── One-time setup (call from seed-demo.ts) ──────────────────────────────────

export async function depositExpenseFunds(amountUsdc: string): Promise<void> {
  const client = getGatewayClient();
  await client.deposit(amountUsdc);
}

export async function getExpenseBalance(): Promise<{ usdc: number }> {
  const client   = getGatewayClient();
  const balances = await client.getBalances() as { wallet: { formatted: string } };
  return { usdc: parseFloat(balances.wallet.formatted) };
}

// ─── Pay for a resource via x402 ─────────────────────────────────────────────
// GatewayClient signs EIP-3009 with EXPENSE_WALLET_PRIVATE_KEY and retries.
// Any failure throws — callers must handle and surface errors explicitly.

export async function payForResource(params: {
  url:         string;
  method?:     string;
  body?:       unknown;
  description: string;
  max_usdc?:   number;
}): Promise<{ data: unknown; expense: NanopaymentExpense }> {
  const client = getGatewayClient();
  const response = await client.pay<unknown>(params.url, {
    method: (params.method ?? "GET") as "GET" | "POST" | "PUT" | "DELETE",
    body:   params.body,
  });

  return {
    data:    response.data,
    expense: {
      description: params.description,
      amount_usdc: parseFloat(response.formattedAmount ?? "0.005"),
      arc_tx_hash: (response.transaction ?? "0x0") as `0x${string}`,
      timestamp:   new Date(),
    },
  };
}
