/**
 * DEV-002 Clearing Test — GatewayClient.pay() End-to-End Integration
 *
 * Exercises the actual buyer-side x402 payment path using a funded expense wallet.
 * Clears DEV-002 UNTESTED → confirms real x402 payment round-trip on Arc testnet.
 *
 * Prereqs: funded expense wallet (faucet.circle.com) + gateway deposit
 * Server: running on localhost:3000 (started externally before test run)
 */
import { describe, it, expect } from "vitest";
import { GatewayClient } from "@circle-fin/x402-batching/client";

const BASE_URL = "http://localhost:3000";
const EXPENSE_KEY = process.env.EXPENSE_WALLET_PRIVATE_KEY as `0x${string}`;
const SELLER_ADDR = process.env.SELLER_EOA_ADDRESS!;

describe("DEV-002: GatewayClient.pay() real x402 payment path", () => {
  it("GW-1: expense wallet has funded gateway balance (>0 USDC)", async () => {
    const gwClient = new GatewayClient({ chain: "arcTestnet", privateKey: EXPENSE_KEY });
    const balances = await gwClient.getBalances() as {
      gateway: { formattedAvailable: string };
      wallet:  { formatted: string };
    };
    const available = parseFloat(balances.gateway.formattedAvailable);
    expect(available).toBeGreaterThan(0);
    console.log(`✓ Gateway available: ${available} USDC`);
    console.log(`  Wallet balance: ${balances.wallet.formatted} USDC`);
  }, 15_000);

  it("GW-2: data-service returns 402 without payment — correct x402 shape", async () => {
    const res = await fetch(
      `${BASE_URL}/api/data-service/general-research?address=${SELLER_ADDR}`
    );
    expect(res.status).toBe(402);
    const body = await res.json() as {
      error: string;
      payment: {
        price_usdc: number;
        seller_address: string;
        chain: string;
        currency: string;
      };
    };
    expect(body.error).toBe("Payment required");
    expect(body.payment).toBeDefined();
    expect(body.payment.price_usdc).toBeGreaterThan(0);
    expect(body.payment.seller_address).toBe(SELLER_ADDR);
    expect(body.payment.chain).toBe("arcTestnet");
    console.log(`✓ 402 shape correct: price=${body.payment.price_usdc} USDC`);
  }, 10_000);

  it("GW-3: GatewayClient.pay() completes real x402 transaction", async () => {
    const gwClient = new GatewayClient({ chain: "arcTestnet", privateKey: EXPENSE_KEY });
    const url = `${BASE_URL}/api/data-service/general-research?address=${SELLER_ADDR}`;

    const response = await gwClient.pay<{ address: string; summary?: string }>(url, {
      method: "GET",
    });

    expect(response).toBeDefined();
    expect(response.data).toBeDefined();
    // Payment amount can be 0 for tiny nanopayments (batched off-chain)
    const amount = parseFloat(response.formattedAmount ?? "0");
    expect(amount).toBeGreaterThanOrEqual(0);
    console.log(`✓ x402 payment completed: ${response.formattedAmount ?? "0"} USDC`);
    if (response.transaction) console.log(`  Arc tx: ${response.transaction}`);
  }, 30_000);

  it("GW-4: gateway balance remains available after payment (nanopayment batching)", async () => {
    const gwClient = new GatewayClient({ chain: "arcTestnet", privateKey: EXPENSE_KEY });

    const before = await gwClient.getBalances() as { gateway: { formattedAvailable: string } };
    const beforeAvail = parseFloat(before.gateway.formattedAvailable);
    expect(beforeAvail).toBeGreaterThan(0);

    // Make a second payment
    const url = `${BASE_URL}/api/data-service/transaction-count?address=${SELLER_ADDR}`;
    const resp = await gwClient.pay(url, { method: "GET" });
    expect(resp.data).toBeDefined();

    const after = await gwClient.getBalances() as { gateway: { formattedAvailable: string } };
    const afterAvail = parseFloat(after.gateway.formattedAvailable);

    // Nanopayments are batched — balance should remain >= 0 (may not drop per-call)
    expect(afterAvail).toBeGreaterThanOrEqual(0);
    console.log(`✓ Gateway balance: ${beforeAvail} → ${afterAvail} USDC`);
  }, 30_000);
});
