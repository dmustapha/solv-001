// scripts/a2a-auto-caller.ts
// Calls solv-001 via A2A REST API every 2 hours — generates real payment traction
// Requires: A2A_CALLER_PRIVATE_KEY, CIRCLE_WALLET_ADDRESS, NEXT_PUBLIC_APP_URL
// Run: npx tsx scripts/a2a-auto-caller.ts

import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, parseUnits } from "viem";
import { randomBytes } from "crypto";

const AGENT_URL         = process.env.AGENT_TREASURY_URL  || process.env.NEXT_PUBLIC_APP_URL || "https://solv-001.vercel.app";
const PRIVATE_KEY       = process.env.A2A_CALLER_PRIVATE_KEY;
const AGENT_WALLET      = process.env.CIRCLE_WALLET_ADDRESS;
const ARC_CHAIN_ID      = 5042002;
const GATEWAY_WALLET    = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const;
const ARC_USDC_ADDRESS  = "0x3600000000000000000000000000000000000000" as const;
const ARC_RPC_URL       = process.env.ARC_RPC_URL ?? "https://rpc.arcnetwork.xyz";

if (!PRIVATE_KEY) {
  console.error("A2A_CALLER_PRIVATE_KEY not set — real payments disabled. Exiting.");
  process.exit(1);
}
if (!AGENT_WALLET) {
  console.error("CIRCLE_WALLET_ADDRESS not set — cannot build payment auth. Exiting.");
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  transport: http(ARC_RPC_URL),
});

const TASKS = [
  { task: "Summarize the USYC teller contract at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A", task_type: "contract_summary", price_usdc: 0.75 },
  { task: "Research current DeFi stablecoin yield strategies for idle treasury capital", task_type: "general", price_usdc: 0.30 },
  { task: "Summarize the Circle CCTP v2 bridge contract at 0xBd3fa81B58Ba92a82136038B25aDec7066af3155", task_type: "contract_summary", price_usdc: 0.75 },
  { task: "Research best practices for AI agent treasury management on Arc testnet", task_type: "general", price_usdc: 0.30 },
  { task: "Analyze wallet 0x3600000000000000000000000000000000000000 for counterparty risk", task_type: "counterparty_vet", price_usdc: 0.50 },
];

async function buildPaymentAuth(price_usdc: number) {
  const price       = parseUnits(price_usdc.toFixed(6), 6);
  const now         = BigInt(Math.floor(Date.now() / 1000));
  const validAfter  = now - 600n;
  const validBefore = now + 604900n;
  const nonce       = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;

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
      to:          AGENT_WALLET as `0x${string}`,
      value:       price,
      validAfter,
      validBefore,
      nonce,
    },
  });

  return {
    from:        account.address,
    to:          AGENT_WALLET,
    value:       price.toString(),
    validAfter:  validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
    signature,
  };
}

async function call() {
  const t = TASKS[Math.floor(Math.random() * TASKS.length)];
  try {
    const payment_authorization = await buildPaymentAuth(t.price_usdc);

    const res = await fetch(`${AGENT_URL}/api/tasks`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        ...t,
        price_usdc:            undefined,  // not part of TaskSubmission
        payer_wallet:          account.address,
        client_type:           "agent",
        payment_authorization,
      }),
    });
    console.log(`[${new Date().toISOString()}] A2A call: ${t.task_type} — HTTP ${res.status}`);

    // Drain the SSE stream
    if (res.ok && res.body) {
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   done    = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter(l => l.startsWith("data:"));
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line.slice(5));
              if (parsed.type === "complete") {
                console.log(`[${new Date().toISOString()}] Task complete — task_id: ${parsed.data?.task_id} net: $${parsed.data?.net_usdc}`);
              }
              if (parsed.type === "error") {
                console.error(`[${new Date().toISOString()}] Task error: ${parsed.data}`);
              }
            } catch { /* non-JSON SSE lines */ }
          }
        }
      }
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] A2A call failed:`, err instanceof Error ? err.message : err);
  }
}

console.log(`[${new Date().toISOString()}] A2A auto-caller started — target: ${AGENT_URL}`);
console.log(`[${new Date().toISOString()}] Payer: ${account.address}`);
console.log(`[${new Date().toISOString()}] Agent wallet: ${AGENT_WALLET}`);
console.log(`[${new Date().toISOString()}] Interval: every 2h. Ctrl+C to stop.`);

setInterval(call, 2 * 60 * 60 * 1000); // every 2h
call(); // run immediately
