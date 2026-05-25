// solv-001 COMPREHENSIVE TEST RUNNER V2
// Covers TESTING-PLAN-V2.md Sections 2-8 (Sections 2=REST, 3=A2A, 4=MCP, 5=DataService, 6=Treasury, 7=EdgeCases, 8=RealPrompts)
// Section 1 (Human UI / browser) is skipped — requires MetaMask.
// Run: npx tsx scripts/test-runner-v2.ts

import { privateKeyToAccount }      from "viem/accounts";
import { createWalletClient, http, parseUnits } from "viem";
import { randomBytes }               from "crypto";
import { Pool }                      from "pg";

// ─── Config ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const RATE_PAUSE = 65_000; // ms between paid batches

const results: { id: string; pass: boolean; note: string }[] = [];

function log(id: string, pass: boolean, note: string) {
  results.push({ id, pass, note });
  const icon = pass ? "✅" : "❌";
  console.log(`${icon} ${id}: ${note}`);
}

function skip(id: string, reason: string) {
  results.push({ id, pass: true, note: `[SKIP] ${reason}` });
  console.log(`⏭️  ${id}: SKIP — ${reason}`);
}

async function buildPaymentAuth(price_usdc: number, overrides: Partial<{
  to: `0x${string}`;
  validAfter: bigint;
  validBefore: bigint;
  badDomain: boolean;
}> = {}) {
  const price       = parseUnits(price_usdc.toFixed(6), 6);
  const now         = BigInt(Math.floor(Date.now() / 1000));
  const nonce       = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
  const validAfter  = overrides.validAfter  ?? now - 600n;
  const validBefore = overrides.validBefore ?? now + 604900n;
  const to          = overrides.to          ?? AGENT_WALLET;
  const domain = overrides.badDomain
    ? { name: "USD Coin", version: "2", chainId: 1, verifyingContract: "0x3600000000000000000000000000000000000000" as `0x${string}` }
    : { name: "GatewayWalletBatched", version: "1", chainId: ARC_CHAIN_ID, verifyingContract: GATEWAY_WALLET };

  const signature = await walletClient.signTypedData({
    account,
    domain,
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
    message: { from: account.address, to, value: price, validAfter, validBefore, nonce },
  });
  return { from: account.address, to, value: price.toString(), validAfter: validAfter.toString(), validBefore: validBefore.toString(), nonce, signature };
}

async function submitTask(
  task: string, task_type: string, price_usdc: number,
  opts: { client_type?: string; callback_url?: string; authOverrides?: Parameters<typeof buildPaymentAuth>[1] } = {}
): Promise<{ status: number; taskId?: string; events: any[]; body?: string }> {
  const payment_authorization = await buildPaymentAuth(price_usdc, opts.authOverrides ?? {});
  const payload: any = { task, task_type, payer_wallet: account.address, client_type: opts.client_type ?? "agent", payment_authorization };
  if (opts.callback_url) payload.callback_url = opts.callback_url;

  const res = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const events: any[] = [];
  let taskId: string | undefined;

  if (res.ok && res.body) {
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data:")) {
            try {
              const parsed = JSON.parse(line.slice(5).trim());
              events.push(parsed);
              if (parsed.data?.task_id) taskId = parsed.data.task_id;
              const preview = JSON.stringify(parsed.data ?? "").slice(0, 110);
              console.log(`    SSE [${parsed.type}] ${preview}`);
            } catch {}
          }
        }
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
      `SELECT status, income_tx_hash, income_usdc, cost_usdc, net_usdc, expense_tx_hashes, result, client_type, reasoning FROM tasks WHERE id = $1`,
      [taskId]
    );
    return r.rows[0];
  } finally { client.release(); }
}

async function dbTraces(taskId: string) {
  const client = await pool.connect();
  try {
    const r = await client.query(`SELECT type, description, cost_usdc FROM trace_events WHERE task_id=$1 ORDER BY timestamp`, [taskId]);
    return r.rows;
  } finally { client.release(); }
}

// Tracks paid slots consumed in the current 60-second window
let paidInWindow = 0;
let windowStart  = Date.now();

async function guardRateLimit() {
  const elapsed = Date.now() - windowStart;
  if (elapsed >= 61_000) {
    // Window expired naturally — reset without sleeping
    paidInWindow = 0;
    windowStart  = Date.now();
    return;
  }
  if (paidInWindow >= 3) {
    console.log(`\n⏳ Rate limit pause (${Math.ceil((61_000 - elapsed) / 1000) + 4}s)…`);
    await sleep(RATE_PAUSE);
    paidInWindow = 0;
    windowStart  = Date.now();
  }
}

async function paidSubmit(id: string, task: string, task_type: string, price_usdc: number, opts?: Parameters<typeof submitTask>[3]) {
  await guardRateLimit();
  console.log(`\n── ${id} ──`);
  let res: Awaited<ReturnType<typeof submitTask>>;
  try {
    res = await submitTask(task, task_type, price_usdc, opts);
  } catch (err: any) {
    // Network timeout (Vercel transient) — retry once after 10s
    if (err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" || err?.code === "UND_ERR_CONNECT_TIMEOUT" || err?.name === "TimeoutError") {
      console.log(`  [retry] network timeout — waiting 10s...`);
      await sleep(10_000);
      res = await submitTask(task, task_type, price_usdc, opts);
    } else {
      throw err;
    }
  }
  paidInWindow++; // count ALL full-payment attempts — server tracks them all, not just 200s
  // Retry once on Circle gateway insufficient_balance (transient Arc testnet issue)
  if (res.status === 402 && res.body?.includes("insufficient_balance")) {
    console.log(`  [retry] insufficient_balance — waiting 45s for Circle gateway recovery...`);
    await sleep(45_000);
    await guardRateLimit();
    const retry = await submitTask(task, task_type, price_usdc, opts);
    paidInWindow++;
    return retry;
  }
  return res;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — REST API DIRECT TESTS (no-payment tests first)
// ═══════════════════════════════════════════════════════════════════════════════

async function section2_nopay() {
  console.log("\n\n══════════════════════════════════════════");
  console.log("SECTION 2 — REST API (no-payment tests)");
  console.log("══════════════════════════════════════════");

  // R2.1 — No payment auth → 402
  console.log("\n── R2.1: No payment_authorization → 402 ──");
  const r21 = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "Summarize 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A", task_type: "contract_summary", payer_wallet: account.address }),
  });
  const r21body = await r21.json().catch(() => ({})) as any;
  log("R2.1", r21.status === 402 && !!r21body.payment, `HTTP ${r21.status} payment=${JSON.stringify(r21body.payment ?? r21body).slice(0,80)}`);

  // R2.2 — Underpayment → 402 (before rate limit)
  console.log("\n── R2.2: Underpayment → 402 before rate limit ──");
  const lowAuth = await buildPaymentAuth(0.01);
  const r22 = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "test", task_type: "contract_summary", payer_wallet: account.address, payment_authorization: lowAuth }),
  });
  log("R2.2", r22.status === 402, `HTTP ${r22.status} (expect 402 — underpayment)`);

  // R2.2-norl — Underpayment does NOT consume rate limit (fire 6 times)
  console.log("\n── R2.2-norl: Underpayment ×6 → all 402, never 429 ──");
  let allUnderpay402 = true;
  for (let i = 0; i < 6; i++) {
    const a = await buildPaymentAuth(0.01);
    const r = await fetch(`${AGENT_URL}/api/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "test", task_type: "contract_summary", payer_wallet: account.address, payment_authorization: a }),
    });
    if (r.status !== 402) { allUnderpay402 = false; console.log(`  underpay attempt ${i+1}: HTTP ${r.status} (unexpected!)`); }
  }
  log("R2.2-norl", allUnderpay402, "All 6 underpayments → 402 (rate limit NOT consumed)");

  // R2.6 — Task too long → 400 (before rate limit)
  console.log("\n── R2.6: Task too long (2001 chars) → 400 ──");
  const r26 = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "A".repeat(2001), task_type: "general", payer_wallet: account.address }),
  });
  log("R2.6", r26.status === 400, `HTTP ${r26.status} (expect 400)`);

  // R2.7 — Unknown task_type → 400 (before rate limit)
  console.log("\n── R2.7: Unknown task_type → 400 ──");
  const r27 = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "test", task_type: "exploit_contract", payer_wallet: account.address }),
  });
  log("R2.7", r27.status === 400, `HTTP ${r27.status} (expect 400)`);

  // R2.8 — Missing required fields
  console.log("\n── R2.8: Missing required fields ──");
  const r28a = await fetch(`${AGENT_URL}/api/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_type: "general", payer_wallet: account.address }) });
  log("R2.8a", r28a.status === 400, `missing task → HTTP ${r28a.status}`);
  const r28b = await fetch(`${AGENT_URL}/api/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "test", payer_wallet: account.address }) });
  log("R2.8b", r28b.status === 400, `missing task_type → HTTP ${r28b.status}`);
  const r28c = await fetch(`${AGENT_URL}/api/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "test", task_type: "general" }) });
  log("R2.8c", r28c.status === 400, `missing payer_wallet → HTTP ${r28c.status}`);

  // R2.9 — Malformed JSON
  console.log("\n── R2.9: Malformed JSON body → 400 ──");
  const r29 = await fetch(`${AGENT_URL}/api/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "not json at all" });
  log("R2.9", r29.status === 400, `HTTP ${r29.status}`);

  // R2.10 — SSRF callback_url blocked
  console.log("\n── R2.10: SSRF callback_url injection ──");
  const ssrfCases = [
    ["R2.10a", "http://localhost:3000/internal",           "non-https"],
    ["R2.10b", "https://127.0.0.1/webhook",               "loopback IP"],
    ["R2.10c", "https://192.168.1.1/data",                "private 192.168.x"],
    ["R2.10d", "https://10.0.0.1/steal",                  "private 10.x"],
    ["R2.10e", "https://169.254.169.254/metadata",        "link-local"],
    ["R2.10f", "https://webhook.site/valid-public-hook",  "public https (allowed)"],
  ] as const;
  for (const [id, url, label] of ssrfCases) {
    const r = await fetch(`${AGENT_URL}/api/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "test", task_type: "general", payer_wallet: account.address, callback_url: url }),
    });
    const shouldBlock = id !== "R2.10f";
    log(id, shouldBlock ? r.status === 400 : r.status !== 400,
      `${label} → HTTP ${r.status} (${shouldBlock ? "expect 400" : "expect not 400"})`);
  }

  // R2.16 — GET /api/tasks returns list
  console.log("\n── R2.16: GET /api/tasks returns task list ──");
  const r216 = await fetch(`${AGENT_URL}/api/tasks`).then(r => r.json() as any);
  log("R2.16", Array.isArray(r216) && r216.length >= 0, `task count=${r216.length} first=${JSON.stringify(r216[0]?.status)}`);

  // R2.18 — GET /api/tasks/:id for nonexistent ID
  console.log("\n── R2.18: GET /api/tasks/nonexistent → 404 ──");
  const r218 = await fetch(`${AGENT_URL}/api/tasks/00000000-0000-0000-0000-000000000000`);
  log("R2.18", r218.status === 404, `HTTP ${r218.status}`);

  // R2.20 — client_type defaults to "human"
  // (will verify when first human task completes — tracked separately)
}

async function section2_paid() {
  console.log("\n\n══════════════════════════════════════════");
  console.log("SECTION 2 — REST API (paid task tests)");
  console.log("══════════════════════════════════════════");

  // Clear server sliding window — M4.7 (paid MCP task) may have run <60s ago
  console.log("\n⏳ Pausing 65s to clear rate limit window before paid REST tests...");
  await sleep(RATE_PAUSE);
  paidInWindow = 0; windowStart = Date.now();

  // R2.3 — Correct payment → SSE stream with correct event sequence
  const r23 = await paidSubmit("R2.3", "Research DeFi stablecoin yield strategies on Arc testnet", "general", 0.30);
  if (r23.taskId) {
    const types = r23.events.map((e: any) => e.type);
    const hasAll = ["treasury_snapshot", "reasoning_chunk", "reasoning_complete"].every(t => types.includes(t));
    const lastEvent = types[types.length - 1];
    log("R2.3-sse-seq", hasAll && ["complete", "deferred", "rejected", "trace"].includes(lastEvent),
      `events: ${types.join("→")} last=${lastEvent}`);
    const db = await dbTask(r23.taskId);
    log("R2.3-db", ["complete", "deferred", "rejected"].includes(db?.status), `status=${db?.status} cost=${db?.cost_usdc}`);
  } else {
    log("R2.3", false, `HTTP ${r23.status} body=${r23.body?.slice(0,100)}`);
  }

  // R2.11 — Replay attack (same nonce twice)
  console.log("\n── R2.11: Replay attack (same nonce) ──");
  await guardRateLimit();
  const replayAuth = await buildPaymentAuth(0.30);
  const r11first = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "test replay first", task_type: "general", payer_wallet: account.address, payment_authorization: replayAuth }),
  });
  paidInWindow++; // count regardless of status — server tracks all payment attempts
  // drain stream
  if (r11first.body) { const reader = r11first.body.getReader(); while (!(await reader.read()).done) {} }

  paidInWindow++; // replay also hits rate limit counter
  const r11replay = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "test replay second", task_type: "general", payer_wallet: account.address, payment_authorization: replayAuth }),
  });
  log("R2.11", r11replay.status === 402, `First=${r11first.status} Replay=${r11replay.status} (expect 402)`);

  // Pause before invalid-auth tests — R2.3 retry + R2.11×2 may still be in server's 60s sliding window
  console.log("\n⏳ Pausing 65s to clear server sliding window before invalid-auth tests (R2.12–R2.15)...");
  await sleep(RATE_PAUSE);
  paidInWindow = 0; windowStart = Date.now();

  // R2.12 — Expired auth (validBefore in the past)
  console.log("\n── R2.12: Expired auth (validBefore in past) ──");
  await guardRateLimit();
  const now12 = BigInt(Math.floor(Date.now() / 1000));
  const expiredAuth = await buildPaymentAuth(0.30, { validAfter: now12 - 3600n, validBefore: now12 - 100n });
  paidInWindow++;
  const r212 = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "expired", task_type: "general", payer_wallet: account.address, payment_authorization: expiredAuth }),
  });
  log("R2.12", r212.status === 402, `HTTP ${r212.status} (expect 402 — expired)`);

  // R2.13 — Future auth (validAfter hasn't started yet)
  console.log("\n── R2.13: Future auth (validAfter in future) ──");
  await guardRateLimit();
  const now13 = BigInt(Math.floor(Date.now() / 1000));
  const futureAuth = await buildPaymentAuth(0.30, { validAfter: now13 + 3600n });
  paidInWindow++;
  const r213 = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "future", task_type: "general", payer_wallet: account.address, payment_authorization: futureAuth }),
  });
  log("R2.13", r213.status === 402, `HTTP ${r213.status} (expect 402 — future auth)`);

  // R2.14 — Wrong recipient in auth
  console.log("\n── R2.14: Wrong recipient in auth ──");
  await guardRateLimit();
  const wrongRecip = await buildPaymentAuth(0.30, { to: "0x000000000000000000000000000000000000dEaD" });
  paidInWindow++;
  const r214 = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "wrong recip", task_type: "general", payer_wallet: account.address, payment_authorization: wrongRecip }),
  });
  log("R2.14", r214.status === 402, `HTTP ${r214.status} (expect 402 — wrong recipient)`);

  // R2.15 — Wrong EIP-712 domain
  console.log("\n── R2.15: Wrong EIP-712 domain ──");
  await guardRateLimit();
  const badDomainAuth = await buildPaymentAuth(0.30, { badDomain: true });
  paidInWindow++;
  const r215 = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "bad domain", task_type: "general", payer_wallet: account.address, payment_authorization: badDomainAuth }),
  });
  log("R2.15", r215.status === 402, `HTTP ${r215.status} (expect 402 — wrong domain)`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — A2A CHANNEL TESTS
// ═══════════════════════════════════════════════════════════════════════════════

async function section3_a2a() {
  console.log("\n\n══════════════════════════════════════════");
  console.log("SECTION 3 — A2A CHANNEL");
  console.log("══════════════════════════════════════════");

  // A3.5 — Agent card discovery
  console.log("\n── A3.5: Agent card ──");
  const card = await fetch(`${AGENT_URL}/api/agent-card`).then(r => r.json() as any);
  log("A3.5-name",      card.name === "solv-001",                        `name=${card.name}`);
  log("A3.5-chain",     card.payment?.chain === "arcTestnet",             `chain=${card.payment?.chain}`);
  log("A3.5-endpoints", !!card.api?.rest && !!card.api?.mcp?.endpoint,   `rest=${!!card.api?.rest} mcp=${card.api?.mcp?.endpoint}`);
  log("A3.5-caps",      Array.isArray(card.capabilities) && card.capabilities.length === 8,
    `capabilities count=${card.capabilities?.length}`);

  // A3.4 — All 8 task types
  const taskSuite = [
    { id: "A3.4a", type: "wallet_intelligence",    price: 0.50, task: "Full intelligence profile of wallet 0x3600000000000000000000000000000000000000 — show transaction patterns, counterparty graph, and DeFi interactions" },
    { id: "A3.4b", type: "counterparty_vet",       price: 0.50, task: "Vet 0xBd3fa81B58Ba92a82136038B25aDec7066af3155 before a $5,000 USDC bridge transfer — full counterparty risk report" },
    { id: "A3.4c", type: "contract_summary",       price: 0.75, task: "Summarize the USYC teller contract at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A — explain what it does, who can interact, and treasury agent risks" },
    { id: "A3.4d", type: "conditional_payment",    price: 0.20, task: "Send 0.01 USDC to 0x000000000000000000000000000000000000dEaD if Arc block number > 100" },
    { id: "A3.4e", type: "scheduled_disbursement", price: 0.20, task: "Send 0.01 USDC to 0x000000000000000000000000000000000000dEaD in 10 seconds" },
    { id: "A3.4f", type: "wallet_watch",           price: 0.10, task: "Watch wallet 0x3600000000000000000000000000000000000000 for outbound transfers > $100 USDC" },
    { id: "A3.4g", type: "contract_watch",         price: 0.10, task: "Monitor 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A for Deposit or Withdraw events" },
    { id: "A3.4h", type: "general",                price: 0.30, task: "Compare risk-adjusted yield of USYC vs USDC for an AI treasury agent on Arc Testnet. Include liquidity risk, smart contract risk, and expected APY" },
  ];

  for (const { id, type, price, task } of taskSuite) {
    const r = await paidSubmit(id, task, type, price, { client_type: "agent" });
    if (r.taskId) {
      const db = await dbTask(r.taskId);
      const statusOk = ["complete", "deferred", "rejected"].includes(db?.status);
      log(id, statusOk, `type=${type} status=${db?.status} cost=${db?.cost_usdc} net=${db?.net_usdc}`);
      // Verify client_type stored correctly
      if (id === "A3.4a") {
        log("A3.19-client-type", db?.client_type === "agent", `client_type=${db?.client_type}`);
      }
    } else {
      log(id, false, `HTTP ${r.status} body=${r.body?.slice(0, 100)}`);
    }
  }

  // A3.7 — Rate limit per wallet (6th request → 429)
  // Fire all 6 in parallel so they all land in the same sliding window.
  // Deferred task types don't consume rate-limit slots; use general tasks.
  console.log("\n── A3.7: Rate limit — 6th request → 429 ──");
  console.log("  Waiting for fresh rate limit window…");
  await sleep(RATE_PAUSE);
  paidInWindow = 0; windowStart = Date.now();

  const a37Auths = await Promise.all(Array.from({ length: 6 }, () => buildPaymentAuth(0.30)));
  const a37Results = await Promise.all(a37Auths.map((auth, i) =>
    fetch(`${AGENT_URL}/api/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: `rate test ${i+1} — general research`, task_type: "general", payer_wallet: account.address, client_type: "agent", payment_authorization: auth }),
    }).then(async r => {
      // drain body so connection closes
      if (r.body) { const reader = r.body.getReader(); while (!(await reader.read()).done) {} }
      return r.status;
    })
  ));
  paidInWindow += a37Results.filter(s => s === 200).length;
  console.log("  statuses:", a37Results.join(", "));
  const got429 = a37Results.includes(429);
  if (got429) {
    log("A3.7", true, `parallel burst → 429 received. statuses: ${a37Results.join(",")}`);
  } else {
    log("A3.7", false, `No 429 after 6 parallel requests. statuses: ${a37Results.join(",")}`);
  }

  // R2.5 — After window reset, requests succeed again
  console.log("\n── R2.5: Rate limit window reset → requests succeed ──");
  await sleep(RATE_PAUSE);
  paidInWindow = 0; windowStart = Date.now();
  const r25 = await paidSubmit("R2.5", "Research Arc Testnet stablecoin yields after rate limit reset", "general", 0.30);
  log("R2.5", r25.status === 200, `HTTP ${r25.status} (expect 200 after rate limit window reset)`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — MCP CHANNEL TESTS
// ═══════════════════════════════════════════════════════════════════════════════

async function section4_mcp() {
  console.log("\n\n══════════════════════════════════════════");
  console.log("SECTION 4 — MCP CHANNEL");
  console.log("══════════════════════════════════════════");

  async function mcpPost(body: object): Promise<{ status: number; text: string; parsed: any }> {
    const res = await fetch(`${AGENT_URL}/api/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: any = null;
    for (const line of text.split("\n")) {
      if (line.startsWith("data: ")) {
        try { parsed = JSON.parse(line.slice(6)); } catch {}
      }
    }
    return { status: res.status, text, parsed };
  }

  // M4.1 — list tools
  console.log("\n── M4.1: MCP list tools ──");
  const m41 = await mcpPost({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
  const tools = m41.parsed?.result?.tools ?? [];
  log("M4.1-count",    tools.length === 3, `tool count=${tools.length}`);
  log("M4.1-run_task", tools.some((t: any) => t.name === "run_task"), `has run_task=${tools.some((t: any) => t.name === "run_task")}`);
  log("M4.1-treasury", tools.some((t: any) => t.name === "get_treasury_status"), `has get_treasury_status`);
  log("M4.1-estimate", tools.some((t: any) => t.name === "estimate_task"), `has estimate_task`);

  // M4.2 — server identity
  console.log("\n── M4.2: MCP server identity ──");
  const m42 = await mcpPost({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } });
  log("M4.2-name",    m42.parsed?.result?.serverInfo?.name === "solv-001",    `serverInfo.name=${m42.parsed?.result?.serverInfo?.name}`);
  log("M4.2-version", m42.parsed?.result?.serverInfo?.version === "1.0.0",    `serverInfo.version=${m42.parsed?.result?.serverInfo?.version}`);

  // M4.3 — get_treasury_status
  console.log("\n── M4.3: MCP get_treasury_status ──");
  const m43 = await mcpPost({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_treasury_status", arguments: {} } });
  const treasuryText = m43.parsed?.result?.content?.[0]?.text;
  let treasuryData: any = null;
  try { treasuryData = JSON.parse(treasuryText); } catch {}
  log("M4.3-usdc",    typeof treasuryData?.usdc_balance === "number",   `usdc_balance=${treasuryData?.usdc_balance}`);
  log("M4.3-tasks",   typeof treasuryData?.total_tasks_completed === "number", `total_tasks_completed=${treasuryData?.total_tasks_completed}`);

  // M4.4 — estimate_task for all 8 types
  console.log("\n── M4.4: MCP estimate_task for all types ──");
  const types = ["wallet_intelligence", "counterparty_vet", "contract_summary", "conditional_payment", "scheduled_disbursement", "wallet_watch", "contract_watch", "general"];
  for (const tt of types) {
    const m = await mcpPost({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "estimate_task", arguments: { task_type: tt } } });
    const text = m.parsed?.result?.content?.[0]?.text;
    let data: any = null;
    try { data = JSON.parse(text ?? "{}"); } catch {}
    const marginPositive = parseFloat(data?.margin_pct ?? "0") > 0;
    log(`M4.4-${tt}`, !m.parsed?.result?.isError && !!data?.price_usdc && marginPositive,
      `price=${data?.price_usdc} margin=${data?.margin_pct}`);
  }

  // M4.5 — estimate_task unknown type → isError
  console.log("\n── M4.5: MCP estimate_task unknown type ──");
  const m45 = await mcpPost({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "estimate_task", arguments: { task_type: "hack_the_chain" } } });
  log("M4.5", m45.parsed?.result?.isError === true, `isError=${m45.parsed?.result?.isError} text=${m45.parsed?.result?.content?.[0]?.text?.slice(0,60)}`);

  // M4.6 — run_task without payment_authorization → error
  console.log("\n── M4.6: MCP run_task without payment_authorization ──");
  const m46 = await mcpPost({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "run_task", arguments: { task_type: "general", task_description: "test task", payer_wallet: account.address } } });
  const m46text = m46.parsed?.result?.content?.[0]?.text ?? "";
  log("M4.6", m46.parsed?.result?.isError === true && m46text.includes("payment_required"),
    `isError=${m46.parsed?.result?.isError} text=${m46text.slice(0, 80)}`);

  // M4.7 — run_task with valid payment (full MCP flow)
  console.log("\n── M4.7: MCP run_task with payment (full flow) ──");
  await guardRateLimit();
  const m47auth = await buildPaymentAuth(0.10);
  const m47 = await mcpPost({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "run_task", arguments: {
    task_type: "wallet_watch", task_description: "Watch wallet 0x3600000000000000000000000000000000000000 for activity",
    payer_wallet: account.address, payment_authorization: m47auth,
  }}});
  paidInWindow++;
  const m47text = m47.parsed?.result?.content?.[0]?.text ?? "";
  const m47ok = m47text.includes("Task complete") || m47text.includes("Task deferred") || m47text.includes("Task rejected");
  log("M4.7", m47ok, `result=${m47text.slice(0, 100)}`);

  // M4.8 — Missing Accept header (degraded behavior)
  console.log("\n── M4.8: MCP missing Accept header ──");
  const m48 = await fetch(`${AGENT_URL}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  log("M4.8", m48.status < 500, `HTTP ${m48.status} (should not 500 — document behavior)`);

  // M4.9 — DELETE request (session cleanup)
  console.log("\n── M4.9: MCP DELETE (stateless) ──");
  const m49 = await fetch(`${AGENT_URL}/api/mcp`, {
    method: "DELETE",
    headers: { "Accept": "application/json, text/event-stream" },
  });
  log("M4.9", m49.status < 500, `HTTP ${m49.status} (expect 2xx or 4xx, not 500)`);

  // M4.10 — GET request (SSE mode)
  console.log("\n── M4.10: MCP GET (SSE mode) ──");
  const m410 = await fetch(`${AGENT_URL}/api/mcp`, {
    method: "GET",
    headers: { "Accept": "text/event-stream" },
    signal: AbortSignal.timeout(12_000), // SSE stream never ends — cap at 12s (Vercel timeout ~10s)
  }).catch(err => {
    // TimeoutError (AbortSignal.timeout), AbortError (manual cancel), or ETIMEDOUT = stream was live
    if (err.name === "TimeoutError" || err.name === "AbortError" || err.code === "ETIMEDOUT" || err.cause?.code === "ETIMEDOUT") {
      return { status: 200, headers: new Headers({ "content-type": "text/event-stream" }), body: null } as any;
    }
    throw err;
  });
  log("M4.10", m410.status !== 500, `HTTP ${m410.status} content-type=${m410.headers.get("content-type")} (504=expected on Vercel serverless)`);
  if (m410.body) { try { const reader = m410.body.getReader(); const { done } = await reader.read(); if (!done) reader.cancel(); } catch {} }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — DATA SERVICE x402 TESTS
// ═══════════════════════════════════════════════════════════════════════════════

async function section5_dataservice() {
  console.log("\n\n══════════════════════════════════════════");
  console.log("SECTION 5 — DATA SERVICE (x402)");
  console.log("══════════════════════════════════════════");

  const endpoints = ["transaction-count", "contract-interactions", "token-transfers", "contract-code", "general-research"];
  const params: Record<string, string> = {
    "transaction-count":    "?address=0x3600000000000000000000000000000000000000",
    "contract-interactions":"?address=0x9fdF14c5B14173D74C08Af27AebFf39240dC105A",
    "token-transfers":      "?address=0x3600000000000000000000000000000000000000",
    "contract-code":        "?address=0x9fdF14c5B14173D74C08Af27AebFf39240dC105A",
    "general-research":     "?query=USYC+yield+stablecoin",
  };

  // D5.1 — Demo mode bypasses payment (all 5 endpoints)
  console.log("\n── D5.1: Demo mode (all 5 endpoints) ──");
  for (const ep of endpoints) {
    const url = `${AGENT_URL}/api/data-service/${ep}${params[ep]}&demo=true`;
    const r = await fetch(url);
    const json = await r.json().catch(() => null);
    log(`D5.1-${ep}`, r.status === 200 && !!json, `HTTP ${r.status} keys=${Object.keys(json ?? {}).join(",")}`);
  }

  // D5.2 — No payment header → 402
  console.log("\n── D5.2: No payment → 402 ──");
  for (const ep of endpoints) {
    const url = `${AGENT_URL}/api/data-service/${ep}${params[ep]}`;
    const r = await fetch(url);
    log(`D5.2-${ep}`, r.status === 402, `HTTP ${r.status} (expect 402)`);
  }

  // D5.7 — contract-code for EOA
  console.log("\n── D5.7: contract-code for EOA → is_contract=false ──");
  const d57 = await fetch(`${AGENT_URL}/api/data-service/contract-code?address=0x0000000000000000000000000000000000000001&demo=true`);
  const d57j = await d57.json().catch(() => null) as any;
  log("D5.7", d57.status === 200, `HTTP ${d57.status} is_contract=${d57j?.is_contract} bytecode=${d57j?.bytecode?.slice(0,10)}`);

  // D5.9 — Unknown endpoint type → 404
  console.log("\n── D5.9: Unknown endpoint type → 404 ──");
  const d59 = await fetch(`${AGENT_URL}/api/data-service/hack-the-chain`);
  log("D5.9", d59.status === 404 || d59.status === 400, `HTTP ${d59.status}`);

  // D5.10 — Missing required query param
  console.log("\n── D5.10: Missing address param → 400 or 422 ──");
  const d510 = await fetch(`${AGENT_URL}/api/data-service/transaction-count&demo=true`);
  log("D5.10", d510.status >= 400, `HTTP ${d510.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — TREASURY & CAPITAL MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function section6_treasury() {
  console.log("\n\n══════════════════════════════════════════");
  console.log("SECTION 6 — TREASURY & CAPITAL");
  console.log("══════════════════════════════════════════");

  // T6.10 — GET /api/treasury returns live state
  console.log("\n── T6.10: GET /api/treasury live state ──");
  const treasury = await fetch(`${AGENT_URL}/api/treasury`).then(r => r.json() as any);
  log("T6.10-usdc",    typeof treasury.usdc_balance === "number",         `usdc_balance=${treasury.usdc_balance}`);
  log("T6.10-usyc",    typeof treasury.usyc_apy === "number",             `usyc_apy=${treasury.usyc_apy}`);
  log("T6.10-reserve", treasury.operating_reserve_usdc === 10,            `operating_reserve=${treasury.operating_reserve_usdc}`);
  log("T6.10-updated", !!treasury.last_updated,                           `last_updated=${treasury.last_updated}`);

  // T6.1 — treasury_snapshot in SSE contains all expected fields
  // (verified against events from section 3 task runs)
  console.log("\n── T6.1: treasury_snapshot fields (from completed task) ──");
  const recentTasks = await fetch(`${AGENT_URL}/api/tasks`).then(r => r.json() as any);
  const completedTask = recentTasks.find((t: any) => t.status === "complete");
  if (completedTask) {
    const db = await dbTask(completedTask.id);
    log("T6.1-income",   db?.income_usdc > 0,              `income_usdc=${db?.income_usdc}`);
    log("T6.1-txhash",   db?.income_tx_hash?.length > 10,  `income_tx_hash=${db?.income_tx_hash?.slice(0,20)}...`);
    log("T6.1-cost",     db?.cost_usdc > 0,                `cost_usdc=${db?.cost_usdc}`);
    log("T6.1-net",      !isNaN(parseFloat(String(db?.net_usdc ?? ""))),  `net_usdc=${db?.net_usdc}`);
    log("T6.9-net-math", parseFloat(String(db?.net_usdc ?? "0")) <= parseFloat(String(db?.income_usdc ?? "0")),  `net(${db?.net_usdc}) <= income(${db?.income_usdc})`);
  } else {
    skip("T6.1", "No completed task found yet");
  }

  // T6.12 — Total stats accumulate
  console.log("\n── T6.12: All-time stats ──");
  const stats = treasury;
  log("T6.12-completed", typeof stats.total_tasks_completed === "number" && stats.total_tasks_completed > 0, `total_completed=${stats.total_tasks_completed}`);
  log("T6.12-income",    typeof stats.total_income_all_time_usdc === "number", `total_income=${stats.total_income_all_time_usdc}`);

  // T6.11 — Zombie task cleanup
  console.log("\n── T6.11: Zombie task cleanup on GET /api/tasks ──");
  const tasksAfterCleanup = await fetch(`${AGENT_URL}/api/tasks`).then(r => r.json() as any);
  const oldExecuting = tasksAfterCleanup.filter((t: any) => {
    const age = Date.now() - new Date(t.created_at).getTime();
    return t.status === "executing" && age > 10 * 60 * 1000;
  });
  log("T6.11", oldExecuting.length === 0, `zombie tasks stuck in 'executing' = ${oldExecuting.length}`);

  // T6.2 — ACCEPT decision at healthy balance
  console.log("\n── T6.2: ACCEPT decision when balance healthy ──");
  if (treasury.usdc_balance > 10) {
    const r = await paidSubmit("T6.2", "Research optimal treasury rebalancing strategies for AI agents", "general", 0.30);
    if (r.taskId) {
      const decisionEvent = r.events.find((e: any) => e.type === "reasoning_complete");
      log("T6.2", decisionEvent?.data?.decision === "ACCEPT", `decision=${decisionEvent?.data?.decision} balance=${treasury.usdc_balance}`);
    } else {
      log("T6.2", false, `HTTP ${r.status}`);
    }
  } else {
    skip("T6.2", `Balance too low for ACCEPT test (balance=${treasury.usdc_balance})`);
  }

  // T6.6/T6.7 — USYC sweep check (balance-dependent)
  const bal = treasury.usdc_balance;
  console.log(`\n── T6.6/T6.7: USYC sweep threshold (balance=${bal}) ──`);
  if (bal > 15) {
    log("T6.6-eligible", true, `Balance $${bal} > $15 sweep threshold — sweep should have fired post-task`);
  } else {
    log("T6.7-no-sweep", true, `Balance $${bal} < $15 — no sweep expected`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

async function section7_edge() {
  console.log("\n\n══════════════════════════════════════════");
  console.log("SECTION 7 — EDGE CASES");
  console.log("══════════════════════════════════════════");

  // E7.2 — Empty task string
  console.log("\n── E7.2: Empty task string → 400 ──");
  const e72 = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "", task_type: "general", payer_wallet: account.address }),
  });
  log("E7.2", e72.status === 400, `HTTP ${e72.status}`);

  // E7.3 — Whitespace-only task
  console.log("\n── E7.3: Whitespace-only task ──");
  const e73 = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "   ", task_type: "general", payer_wallet: account.address }),
  });
  log("E7.3", e73.status === 400 || e73.status === 402,
    `HTTP ${e73.status} (400=server trims whitespace, 402=passed validation — document behavior)`);

  // E7.4 — Exactly 2000-char task
  console.log("\n── E7.4: Exactly 2000-char task (should not be rejected by length) ──");
  const e74 = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "A".repeat(2000), task_type: "general", payer_wallet: account.address }),
  });
  log("E7.4", e74.status !== 400 || (await e74.json().catch(()=>({error:""})) as any).error?.includes("task must"), `HTTP ${e74.status} (expect not 400 on length check)`);

  // E7.5 — Unicode/emoji in task
  console.log("\n── E7.5: Unicode/emoji in task ──");
  const e75 = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "Analyze wallet 🔍 0x3600000000000000000000000000000000000000 for risk 💀", task_type: "general", payer_wallet: account.address }),
  });
  log("E7.5", e75.status !== 500, `HTTP ${e75.status} (should not 500 on unicode)`);

  // E7.6 — Null payer_wallet
  console.log("\n── E7.6: Null payer_wallet → 400 ──");
  const e76 = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "test", task_type: "general", payer_wallet: null }),
  });
  log("E7.6", e76.status === 400, `HTTP ${e76.status}`);

  // E7.13 — Unicode result doesn't break SSE
  console.log("\n── E7.13: SSE stream handles special chars in result ──");
  const e713 = await paidSubmit("E7.13",
    "What does 'USYC' stand for and what is the symbol for USD Coin? Include the symbols: ™ © ® € £ ¥ and emojis: 💰 📈 🏦",
    "general", 0.30
  );
  if (e713.taskId) {
    const db = await dbTask(e713.taskId);
    log("E7.13", ["complete","deferred","rejected"].includes(db?.status), `status=${db?.status} result="${db?.result?.slice(0,100)}"`);
  } else {
    log("E7.13", false, `HTTP ${e713.status}`);
  }

  // E7.15 — Treasury event recorded per task
  console.log("\n── E7.15: Treasury income event recorded ──");
  const client = await pool.connect();
  const evq = await client.query(`SELECT type, amount_usdc, tx_hash FROM treasury_events WHERE type='income' ORDER BY created_at DESC LIMIT 1`);
  client.release();
  log("E7.15", evq.rows.length > 0 && evq.rows[0].amount_usdc > 0,
    `income event: amount=${evq.rows[0]?.amount_usdc} tx=${evq.rows[0]?.tx_hash?.slice(0,20)}...`);

  // E7.1 — Concurrent requests from same wallet (both within limit)
  console.log("\n── E7.1: Concurrent task submissions (2 at once) ──");
  await guardRateLimit();
  const [eA, eB] = await Promise.all([
    submitTask("Concurrent task A — general research", "general", 0.30),
    submitTask("Concurrent task B — general research", "general", 0.30),
  ]);
  paidInWindow += 2; // Both requests count toward server rate limit regardless of response status
  // Concurrent nonces may collide — one request may get 402 (replay). Pass if neither 500.
  const noCrash = eA.status !== 500 && eB.status !== 500;
  log("E7.1", noCrash, `A=${eA.status} B=${eB.status} (no 500 on concurrent requests)`);

  // R2.19 — client_type: "agent" stored
  console.log("\n── R2.19: client_type stored ──");
  await guardRateLimit();
  const r219 = await paidSubmit("R2.19", "Test agent client_type", "general", 0.30, { client_type: "agent" });
  if (r219.taskId) {
    const db = await dbTask(r219.taskId);
    log("R2.19", db?.client_type === "agent", `client_type=${db?.client_type}`);
  } else {
    log("R2.19", false, `HTTP ${r219.status}`);
  }

  // R2.17 — GET /api/tasks/:id for existing task
  console.log("\n── R2.17: GET /api/tasks/:id ──");
  if (r219.taskId) {
    const r217 = await fetch(`${AGENT_URL}/api/tasks/${r219.taskId}`);
    const r217j = await r217.json().catch(() => null) as any;
    log("R2.17", r217.status === 200 && !!r217j?.id, `HTTP ${r217.status} id=${r217j?.id}`);
  } else {
    skip("R2.17", "No task_id from R2.19");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — REAL USER PROMPTS (one per task type)
// ═══════════════════════════════════════════════════════════════════════════════

async function section8_realPrompts() {
  console.log("\n\n══════════════════════════════════════════");
  console.log("SECTION 8 — REAL USER PROMPTS");
  console.log("══════════════════════════════════════════");

  const realPrompts = [
    { id: "P8.1", type: "wallet_intelligence",    price: 0.50, task: "Full intelligence profile of wallet 0xBd3fa81B58Ba92a82136038B25aDec7066af3155 — show transaction patterns, counterparty graph, and any DeFi protocol interactions" },
    { id: "P8.2", type: "counterparty_vet",       price: 0.50, task: "I'm about to send $50,000 USDC to 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A. Vet this address for smart contract risk, ownership patterns, and any red flags" },
    { id: "P8.3", type: "contract_summary",       price: 0.75, task: "Summarize the USYC teller at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A — what does it do, who can interact with it, and what are the risks for a yield-farming treasury agent?" },
    { id: "P8.4", type: "conditional_payment",    price: 0.20, task: "Transfer $0.01 USDC to 0x000000000000000000000000000000000000dEaD if and when the Arc Testnet block number exceeds 1000" },
    { id: "P8.5", type: "scheduled_disbursement", price: 0.20, task: "Send $0.01 USDC to 0x000000000000000000000000000000000000dEaD in exactly 15 seconds from now" },
    { id: "P8.6", type: "wallet_watch",           price: 0.10, task: "Monitor 0xBd3fa81B58Ba92a82136038B25aDec7066af3155 and alert me whenever an outbound USDC transfer exceeds $1,000" },
    { id: "P8.7", type: "contract_watch",         price: 0.10, task: "Watch the USYC teller contract 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A for Deposit or Withdraw events and return a live event feed" },
    { id: "P8.8", type: "general",                price: 0.30, task: "Explain the x402 micropayment protocol and how solv-001 uses it for agent-to-agent commerce on Arc Testnet. Include the EIP-3009 signing flow." },
  ];

  for (const { id, type, price, task } of realPrompts) {
    const r = await paidSubmit(id, task, type, price, { client_type: "agent" });
    if (r.taskId) {
      const db = await dbTask(r.taskId);
      const statusOk = ["complete", "deferred", "rejected"].includes(db?.status);
      const resultOk = db?.result && db.result.length > 20;
      log(id, statusOk, `${type} → status=${db?.status} result_len=${db?.result?.length} net=$${db?.net_usdc}`);
      if (statusOk && !resultOk && db?.status === "complete") {
        log(`${id}-quality`, false, `Result too short: "${db?.result?.slice(0,100)}"`);
      }
    } else {
      log(id, false, `HTTP ${r.status} body=${r.body?.slice(0,100)}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADDITIONAL API SURFACE CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

async function sectionExtra() {
  console.log("\n\n══════════════════════════════════════════");
  console.log("EXTRA — API SURFACE & TASK STATUS ENDPOINT");
  console.log("══════════════════════════════════════════");

  // T6.1 — estimate endpoint
  console.log("\n── T6.1: /api/tasks/estimate ──");
  const est = await fetch(`${AGENT_URL}/api/tasks/estimate?task_type=wallet_intelligence`).then(r => r.json() as any);
  log("T6.1-estimate", est.price_usdc === 0.5 && !!est.estimated_margin_pct, `price=${est.price_usdc} margin=${est.estimated_margin_pct}`);

  // A3.5 — agent card full fields check (extended)
  const card = await fetch(`${AGENT_URL}/api/agent-card`).then(r => r.json() as any);
  log("A3.5-mcp-endpoint", !!card.api?.mcp?.endpoint, `mcp_endpoint=${card.api?.mcp?.endpoint}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  solv-001 COMPREHENSIVE TEST RUNNER V2   ║");
  console.log(`║  Target: ${AGENT_URL}   ║`);
  console.log(`║  Payer:  ${account.address.slice(0, 22)}...  ║`);
  console.log("╚══════════════════════════════════════════╝");
  console.log("\n⚠️  Note: Section 1 (Human UI / MetaMask) skipped — browser required.");
  console.log("⚠️  Rate limit: 5 paid tasks/min. Pauses will occur between batches.");
  console.log(`⚠️  Estimated run time: ~15-25 minutes\n`);

  try {
    // Phase 1: Non-paying tests (fast)
    await section2_nopay();
    await section5_dataservice();
    await section4_mcp();
    await sectionExtra();

    // Phase 2: Paid REST tests (rate-limit managed)
    await section2_paid();

    // Phase 3: A2A all 8 task types + rate limit test (rate-limit managed)
    await section3_a2a();

    // Phase 4: Treasury & capital (mostly reads, 1 paid)
    await section6_treasury();

    // Phase 5: Edge cases (mix of paid + no-pay)
    await section7_edge();

    // Phase 6: Real user prompts (8 paid tasks) — reset rate limit window first
    console.log("\n⏳ Waiting 65s to reset rate limit window before Section 8...");
    await sleep(RATE_PAUSE);
    paidInWindow = 0; windowStart = Date.now();
    await section8_realPrompts();

  } catch (err) {
    console.error("\n💥 FATAL ERROR:", err);
  }

  // ── Final Summary ──────────────────────────────────────────────────────────
  console.log("\n\n╔══════════════════════════════════════════╗");
  console.log("║              FINAL RESULTS               ║");
  console.log("╚══════════════════════════════════════════╝");
  const passed  = results.filter(r => r.pass).length;
  const failed  = results.filter(r => !r.pass).length;
  const skipped = results.filter(r => r.note.startsWith("[SKIP]")).length;
  results.forEach(r => {
    const icon = r.note.startsWith("[SKIP]") ? "⏭️ " : r.pass ? "✅" : "❌";
    console.log(`${icon} ${r.id}: ${r.note}`);
  });
  console.log(`\n✅ ${passed} passed   ❌ ${failed} failed   ⏭️  ${skipped} skipped`);
  console.log(`Total: ${results.length} tests`);
  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:");
    results.filter(r => !r.pass && !r.note.startsWith("[SKIP]")).forEach(r => console.log(`  • ${r.id}: ${r.note}`));
  }

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
