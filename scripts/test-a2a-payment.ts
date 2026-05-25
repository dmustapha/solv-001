/**
 * Test B — A2A x402 payment path
 *
 * Signs an EIP-3009 authorization against the Circle GatewayWalletBatched domain,
 * posts to /api/tasks with client_type:"agent", streams the SSE response,
 * and reports the final task result + treasury delta.
 */

import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, parseUnits } from "viem";
import { randomBytes } from "crypto";

const BASE_URL       = process.env.BASE_URL ?? "http://localhost:3000";
const PRIVATE_KEY    = "0x3661767a8f1298138129e305cc3178e086b459cb090a117cf014aa59884ae0be" as `0x${string}`;
const AGENT_WALLET   = "0x927c1d756d12879aebea0772f3ee220f21f4841a" as `0x${string}`;
const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as `0x${string}`;
const ARC_CHAIN_ID   = 5042002;
const ARC_RPC        = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc-node.thecanteenapp.com/v1/swrm_d4643bb9d2ec62adf991e2b84a5968aca7bf48995bdb1f01b22e7f903da00f2c";

async function getTreasury() {
  const res = await fetch(`${BASE_URL}/api/treasury`);
  return res.json() as Promise<{ usdc_balance: number; today_income_usdc: number; total_income_all_time_usdc: number }>;
}

async function main() {
  const account      = privateKeyToAccount(PRIVATE_KEY);
  const walletClient = createWalletClient({ account, transport: http(ARC_RPC) });

  const price       = parseUnits("0.30", 6); // $0.30 — general task price
  const now         = BigInt(Math.floor(Date.now() / 1000));
  const validAfter  = now - 60n;
  const validBefore = now + 604900n;
  const nonce       = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;

  console.log("=== Test B — A2A x402 Payment Path ===");
  console.log("Payer:", account.address);
  console.log("Recipient (agent wallet):", AGENT_WALLET);
  console.log("Amount:", price.toString(), "units ($0.30 USDC)");

  // Sign EIP-3009 auth against Circle GatewayWalletBatched domain
  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name:              "GatewayWalletBatched",
      version:           "1",
      chainId:           ARC_CHAIN_ID,
      verifyingContract: GATEWAY_WALLET,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from",        type: "address" },
        { name: "to",          type: "address" },
        { name: "value",       type: "uint256" },
        { name: "validAfter",  type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce",       type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from:        account.address,
      to:          AGENT_WALLET,
      value:       price,
      validAfter,
      validBefore,
      nonce,
    },
  });

  console.log("\nSigned. Posting to /api/tasks...");

  // Record treasury baseline
  const before = await getTreasury();
  console.log(`\nTreasury before: $${before.usdc_balance.toFixed(4)} USDC balance | today income: $${before.today_income_usdc}`);

  // Post to /api/tasks with client_type:"agent"
  const res = await fetch(`${BASE_URL}/api/tasks`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      task:         "What is the current Arc testnet block number? Answer concisely.",
      task_type:    "general",
      payer_wallet: account.address,
      client_type:  "agent",
      payment_authorization: {
        from:        account.address,
        to:          AGENT_WALLET,
        value:       price.toString(),
        validAfter:  validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
        signature,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error("\n[FAIL] HTTP", res.status, JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log("HTTP 200 — reading SSE stream...\n");

  // Stream SSE events
  const reader  = res.body!.getReader();
  const decoder = new TextDecoder();
  let   finalEvent: Record<string, unknown> | null = null;

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const evt = JSON.parse(line.slice(6)) as { type: string; data: unknown };
        switch (evt.type) {
          case "treasury_snapshot":   console.log("[treasury_snapshot] received"); break;
          case "reasoning_chunk":     process.stdout.write("."); break;
          case "reasoning_complete":  console.log("\n[reasoning_complete]", JSON.stringify(evt.data)); break;
          case "trace":               console.log("[trace]", JSON.stringify(evt.data)); break;
          case "complete":
          case "deferred":
          case "rejected":
          case "error":
            finalEvent = evt as Record<string, unknown>;
            console.log(`\n[${evt.type}]`, JSON.stringify(evt.data, null, 2));
            break outer;
        }
      } catch { /* skip malformed */ }
    }
  }

  if (!finalEvent) {
    console.error("\n[FAIL] Stream ended without final event");
    process.exit(1);
  }

  // Treasury delta check
  await new Promise(r => setTimeout(r, 3000)); // allow Circle API to catch up
  const after = await getTreasury();
  const delta = after.today_income_usdc - before.today_income_usdc;
  console.log(`\n=== Treasury Delta ===`);
  console.log(`  before.today_income_usdc: $${before.today_income_usdc}`);
  console.log(`  after.today_income_usdc:  $${after.today_income_usdc}`);
  console.log(`  delta: $${delta.toFixed(6)}`);
  console.log(`  [${delta >= 0.29 ? "PASS" : "WARN — delta < $0.29"}] treasury income recorded`);

  console.log("\n=== Test B Result ===");
  if ((finalEvent as { type: string }).type === "complete") {
    console.log("[PASS] Task completed successfully via A2A x402 path");
  } else {
    console.log("[INFO] Task ended with:", (finalEvent as { type: string }).type);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
