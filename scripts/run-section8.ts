// Section 8 only — real user prompts
// Usage: npx tsx scripts/run-section8.ts
import { privateKeyToAccount }      from "viem/accounts";
import { createWalletClient, http, parseUnits } from "viem";
import { randomBytes }               from "crypto";
import { Pool }                      from "pg";

const AGENT_URL      = "https://solv-001.vercel.app";
const PRIVATE_KEY    = "0x3661767a8f1298138129e305cc3178e086b459cb090a117cf014aa59884ae0be" as `0x${string}`;
const AGENT_WALLET   = "0x927c1d756d12879aebea0772f3ee220f21f4841a" as `0x${string}`;
const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as `0x${string}`;
const ARC_CHAIN_ID   = 5042002;
const ARC_RPC        = "https://rpc.testnet.arc-node.thecanteenapp.com/v1/swrm_d4643bb9d2ec62adf991e2b84a5968aca7bf48995bdb1f01b22e7f903da00f2c";
const PG_URL         = "postgresql://neondb_owner:npg_NSGYnJP4rke5@ep-gentle-scene-aqq1h9rg-pooler.c-8.us-east-1.aws.neon.tech/solv001?sslmode=require";

const account      = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({ account, transport: http(ARC_RPC) });
const pool         = new Pool({ connectionString: PG_URL });
const sleep        = (ms: number) => new Promise(r => setTimeout(r, ms));
const RATE_PAUSE   = 65_000;

const results: { id: string; pass: boolean; note: string }[] = [];
function log(id: string, pass: boolean, note: string) {
  results.push({ id, pass, note });
  console.log(`${pass ? "✅" : "❌"} ${id}: ${note}`);
}

let paidInWindow = 0;
let windowStart  = Date.now();

async function guardRateLimit() {
  const elapsed = Date.now() - windowStart;
  if (elapsed >= 61_000) { paidInWindow = 0; windowStart = Date.now(); return; }
  if (paidInWindow >= 3) {
    console.log(`\n⏳ Rate limit pause (${Math.ceil((61_000 - elapsed) / 1000) + 4}s)…`);
    await sleep(RATE_PAUSE);
    paidInWindow = 0; windowStart = Date.now();
  }
}

async function buildPaymentAuth(price_usdc: number) {
  const price      = parseUnits(price_usdc.toFixed(6), 6);
  const now        = BigInt(Math.floor(Date.now() / 1000));
  const nonce      = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
  const signature  = await walletClient.signTypedData({
    account,
    domain: { name: "GatewayWalletBatched", version: "1", chainId: ARC_CHAIN_ID, verifyingContract: GATEWAY_WALLET },
    types: { TransferWithAuthorization: [
      { name: "from", type: "address" }, { name: "to", type: "address" },
      { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
    ]},
    primaryType: "TransferWithAuthorization",
    message: { from: account.address, to: AGENT_WALLET, value: price, validAfter: now - 600n, validBefore: now + 604900n, nonce },
  });
  return { from: account.address, to: AGENT_WALLET, value: price.toString(), validAfter: (now - 600n).toString(), validBefore: (now + 604900n).toString(), nonce, signature };
}

async function submitTask(task: string, task_type: string, price_usdc: number) {
  const payment_authorization = await buildPaymentAuth(price_usdc);
  const res = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, task_type, payer_wallet: account.address, client_type: "agent", payment_authorization }),
  });
  const events: any[] = [];
  let taskId: string | undefined;
  if (res.ok && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          events.push(ev);
          console.log(`    SSE [${ev.type}] ${JSON.stringify(ev.data ?? "").slice(0, 120)}`);
          if (ev.data?.task_id && !taskId) taskId = ev.data.task_id;
        } catch {}
      }
    }
  }
  const body = res.ok ? undefined : await res.text().catch(() => undefined);
  return { status: res.status, taskId, events, body };
}

async function dbTask(taskId: string) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT status, income_usdc, cost_usdc, net_usdc, result FROM tasks WHERE id = $1`, [taskId]
    );
    return r.rows[0];
  } finally { client.release(); }
}

async function paidSubmit(id: string, task: string, task_type: string, price_usdc: number) {
  await guardRateLimit();
  console.log(`\n── ${id} ──`);
  let res = await submitTask(task, task_type, price_usdc);
  paidInWindow++;
  if (res.status === 402 && res.body?.includes("insufficient_balance")) {
    console.log(`  [retry] insufficient_balance — waiting 45s...`);
    await sleep(45_000);
    await guardRateLimit();
    res = await submitTask(task, task_type, price_usdc);
    paidInWindow++;
  }
  return res;
}

async function main() {
  console.log("\n══════════════════════════════════════════");
  console.log("SECTION 8 — REAL USER PROMPTS (standalone)");
  console.log("══════════════════════════════════════════\n");

  const prompts = [
    { id: "P8.1", type: "wallet_intelligence",    price: 0.50, task: "Full intelligence profile of wallet 0xBd3fa81B58Ba92a82136038B25aDec7066af3155 — show transaction patterns, counterparty graph, and any DeFi protocol interactions" },
    { id: "P8.2", type: "counterparty_vet",       price: 0.50, task: "I'm about to send $50,000 USDC to 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A. Vet this address for smart contract risk, ownership patterns, and any red flags" },
    { id: "P8.3", type: "contract_summary",       price: 0.75, task: "Summarize the USYC teller at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A — what does it do, who can interact with it, and what are the risks for a yield-farming treasury agent?" },
    { id: "P8.4", type: "conditional_payment",    price: 0.20, task: "Transfer $0.01 USDC to 0x000000000000000000000000000000000000dEaD if and when the Arc Testnet block number exceeds 1000" },
    { id: "P8.5", type: "scheduled_disbursement", price: 0.20, task: "Send $0.01 USDC to 0x000000000000000000000000000000000000dEaD in exactly 15 seconds from now" },
    { id: "P8.6", type: "wallet_watch",           price: 0.10, task: "Monitor 0xBd3fa81B58Ba92a82136038B25aDec7066af3155 and alert me whenever an outbound USDC transfer exceeds $1,000" },
    { id: "P8.7", type: "contract_watch",         price: 0.10, task: "Watch the USYC teller contract 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A for Deposit or Withdraw events and return a live event feed" },
    { id: "P8.8", type: "general",                price: 0.30, task: "Explain the x402 micropayment protocol and how solv-001 uses it for agent-to-agent commerce on Arc Testnet. Include the EIP-3009 signing flow." },
  ];

  for (const { id, type, price, task } of prompts) {
    const r = await paidSubmit(id, task, type, price);
    if (r.taskId) {
      const db = await dbTask(r.taskId);
      const statusOk = ["complete", "deferred", "rejected"].includes(db?.status);
      log(id, statusOk, `${type} → status=${db?.status} result_len=${db?.result?.length} net=$${db?.net_usdc}`);
    } else {
      log(id, false, `HTTP ${r.status} body=${r.body?.slice(0, 120)}`);
    }
  }

  await pool.end();

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n══ SECTION 8 RESULTS: ${passed}/${results.length} passed ══`);
  results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.id}: ${r.note}`));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
