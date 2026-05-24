// TESTING-PLAN-V3 — Phase 2: Paid E2E Tasks
// E2E.1 general, E2E.2 wallet_intelligence, E2E.3 wallet_watch, E2E.4a/b contract_summary
// Run: npx tsx scripts/test-phase2.ts

import { privateKeyToAccount }                from "viem/accounts";
import { createWalletClient, http, parseUnits } from "viem";
import { randomBytes }                         from "crypto";
import { Pool }                                from "pg";

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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const results: { id: string; pass: boolean; note: string }[] = [];
function log(id: string, pass: boolean, note: string) {
  results.push({ id, pass, note });
  console.log(`${pass ? "✅" : "❌"} ${id}: ${note}`);
}

async function buildPaymentAuth(price_usdc: number) {
  const price       = parseUnits(price_usdc.toFixed(6), 6);
  const now         = BigInt(Math.floor(Date.now() / 1000));
  const nonce       = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
  const validAfter  = now - 600n;
  const validBefore = now + 604900n;
  const to          = AGENT_WALLET;
  const domain      = { name: "GatewayWalletBatched", version: "1", chainId: ARC_CHAIN_ID, verifyingContract: GATEWAY_WALLET };
  const signature   = await walletClient.signTypedData({
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

type SSEEvent = { type: string; data?: any };

async function submitTask(
  task: string, task_type: string, price_usdc: number,
): Promise<{ status: number; taskId?: string; events: SSEEvent[]; error?: string }> {
  const payment_authorization = await buildPaymentAuth(price_usdc);
  const payload = { task, task_type, payer_wallet: account.address, client_type: "agent", payment_authorization };

  const res = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const events: SSEEvent[] = [];
  let taskId: string | undefined;

  if (res.ok && res.body) {
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = "";
    while (true) {
      const { value, done: d } = await reader.read();
      if (value) {
        lineBuffer += decoder.decode(value, { stream: !d });
        const lines = lineBuffer.split("\n");
        // Keep last element as partial line buffer (empty string if ended with \n)
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const parsed = JSON.parse(line.slice(5).trim()) as SSEEvent;
            events.push(parsed);
            if (parsed.data?.task_id) taskId = parsed.data.task_id;
            const preview = JSON.stringify(parsed.data ?? "").slice(0, 120);
            console.log(`    SSE [${parsed.type}] ${preview}`);
          } catch {}
        }
      }
      if (d) {
        // Flush remaining buffer
        if (lineBuffer.startsWith("data:")) {
          try {
            const parsed = JSON.parse(lineBuffer.slice(5).trim()) as SSEEvent;
            events.push(parsed);
            if (parsed.data?.task_id) taskId = parsed.data.task_id;
            console.log(`    SSE [${parsed.type}] ${JSON.stringify(parsed.data ?? "").slice(0, 120)}`);
          } catch {}
        }
        break;
      }
    }
  }

  const error = res.ok ? undefined : await res.text().catch(() => "(no body)");
  return { status: res.status, taskId, events, error };
}

async function dbTask(taskId: string) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT status, income_tx_hash, income_usdc, cost_usdc, net_usdc,
              expense_tx_hashes, result, client_type, reasoning
       FROM tasks WHERE id = $1`,
      [taskId]
    );
    return r.rows[0];
  } finally { client.release(); }
}

async function dbTraces(taskId: string) {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT type, description, cost_usdc, arc_tx_hash FROM trace_events WHERE task_id=$1 ORDER BY timestamp`,
      [taskId]
    );
    return r.rows;
  } finally { client.release(); }
}

function sseTypes(events: SSEEvent[]) { return events.map(e => e.type); }

// ─── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log("TESTING-PLAN-V3 — Phase 2: Paid E2E Tasks");
  console.log(`Payer: ${account.address}`);
  console.log(`${"═".repeat(60)}\n`);

  // ── E2E.1: general ($0.30) ──────────────────────────────────────────────
  console.log("\n── E2E.1: general ($0.30) ──────────────────────────────────");
  const r1 = await submitTask(
    "Compare the yield risk of USYC vs USDC for an AI treasury agent. Include liquidity concerns, smart contract risk, and expected APY.",
    "general", 0.30
  );
  if (r1.status !== 200) {
    log("E2E.1.submit", false, `HTTP ${r1.status}: ${r1.error}`);
  } else {
    const types = sseTypes(r1.events);
    log("E2E.1.sse_start",   types[0] === "treasury_snapshot", `first event = ${types[0]}`);
    log("E2E.1.sse_reasoning", types.includes("reasoning_chunk"), `reasoning_chunk present`);
    log("E2E.1.sse_decision", types.includes("reasoning_complete"), `reasoning_complete present`);
    const decision = r1.events.find(e => e.type === "reasoning_complete")?.data;
    log("E2E.1.decision_badge", ["ACCEPT","DEFER","REJECT"].includes(decision?.decision), `decision=${decision?.decision}`);
    const completeEvt = r1.events.find(e => e.type === "complete");
    const deferredEvt = r1.events.find(e => e.type === "deferred");
    log("E2E.1.terminal_event", !!(completeEvt || deferredEvt), `complete=${!!completeEvt} deferred=${!!deferredEvt}`);
    if (r1.taskId) {
      await sleep(1500);
      const db = await dbTask(r1.taskId);
      log("E2E.1.status_complete",  ["complete","deferred"].includes(db?.status), `status=${db?.status}`);
      log("E2E.1.result_stored",    !!db?.result, `result=${db?.result ? db.result.slice(0,80)+"..." : "NULL"}`);
      log("E2E.1.net_usdc",         (db?.net_usdc ?? 0) > 0, `net_usdc=${db?.net_usdc}`);
      log("E2E.1.client_type",      db?.client_type === "agent", `client_type=${db?.client_type}`);
      const traces = await dbTraces(r1.taskId);
      log("E2E.1.trace_events",     traces.length > 0, `${traces.length} trace events`);
      for (const t of traces) console.log(`    trace: [${t.type}] ${t.description?.slice(0,80)} cost=${t.cost_usdc}`);
    }
  }

  await sleep(2000);

  // ── E2E.2: wallet_intelligence ($0.50, multi-chain) ─────────────────────
  console.log("\n── E2E.2: wallet_intelligence ($0.50) ──────────────────────");
  const r2 = await submitTask(
    "Full intelligence profile of 0xBd3fa81B58Ba92a82136038B25aDec7066af3155 — cross-chain activity across Ethereum, Base, Arbitrum, Optimism and Polygon, DeFi exposure, and risk classification.",
    "wallet_intelligence", 0.50
  );
  if (r2.status !== 200) {
    log("E2E.2.submit", false, `HTTP ${r2.status}: ${r2.error}`);
  } else {
    const types = sseTypes(r2.events);
    log("E2E.2.sse_order",    types[0] === "treasury_snapshot", `first=${types[0]}`);
    log("E2E.2.reasoning",    types.includes("reasoning_complete"), `reasoning_complete=${types.includes("reasoning_complete")}`);
    const completeEvt = r2.events.find(e => e.type === "complete");
    const deferredEvt = r2.events.find(e => e.type === "deferred");
    log("E2E.2.terminal",     !!(completeEvt || deferredEvt), `complete=${!!completeEvt} deferred=${!!deferredEvt}`);
    if (r2.taskId) {
      await sleep(1500);
      const db = await dbTask(r2.taskId);
      log("E2E.2.status",     ["complete","deferred"].includes(db?.status), `status=${db?.status}`);
      log("E2E.2.result",     !!db?.result, `result length=${db?.result?.length ?? 0}`);
      if (db?.result) {
        const resultText = db.result.toLowerCase();
        const chainsFound = ["ethereum","base","arbitrum","optimism","polygon"].filter(c => resultText.includes(c));
        log("E2E.2.multichain", chainsFound.length >= 2, `chains mentioned: ${chainsFound.join(", ")}`);
        console.log(`    result preview: ${db.result.slice(0,200)}...`);
      }
      log("E2E.2.net_usdc",   (db?.net_usdc ?? 0) > 0, `net_usdc=${db?.net_usdc}`);
      const traces = await dbTraces(r2.taskId);
      log("E2E.2.trace_count", traces.length >= 2, `${traces.length} trace events (expected ≥2: 1 consolidated query + 1 result)`);
    }
  }

  await sleep(2000);

  // ── E2E.3: wallet_watch ($0.10, deferred persistence) ───────────────────
  console.log("\n── E2E.3: wallet_watch ($0.10) ──────────────────────────────");
  const r3 = await submitTask(
    "Watch wallet 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A for any new transactions on Arc Testnet. Alert on any activity.",
    "wallet_watch", 0.10
  );
  if (r3.status !== 200) {
    log("E2E.3.submit", false, `HTTP ${r3.status}: ${r3.error}`);
  } else {
    const types = sseTypes(r3.events);
    log("E2E.3.sse_start",    types[0] === "treasury_snapshot", `first=${types[0]}`);
    const deferredEvt = r3.events.find(e => e.type === "deferred");
    const completeEvt = r3.events.find(e => e.type === "complete");
    log("E2E.3.deferred_event", !!deferredEvt || !!completeEvt, `deferred=${!!deferredEvt} complete=${!!completeEvt}`);
    if (r3.taskId) {
      await sleep(2000);
      const db = await dbTask(r3.taskId);
      log("E2E.3.status_deferred", db?.status === "deferred", `status=${db?.status} (expected deferred)`);
      log("E2E.3.result_not_null", !!db?.result, `result=${db?.result ? '"'+db.result.slice(0,100)+'"' : "NULL ← FAIL"}`);
      if (db?.result) {
        const isJson = (() => { try { JSON.parse(db.result); return true; } catch { return false; } })();
        log("E2E.3.result_not_json", !isJson, `result is ${isJson ? "JSON blob ← BAD" : "readable text ← GOOD"}`);
        console.log(`    result: ${db.result}`);
      }
      // Check that reasoning IS the json state blob (internal) and result is human-readable
      if (db?.reasoning) {
        const isReasoningJson = (() => { try { JSON.parse(db.reasoning); return true; } catch { return false; } })();
        log("E2E.3.reasoning_is_json", isReasoningJson, `reasoning is JSON state: ${isReasoningJson} (expected for watch tasks)`);
      }
    }
  }

  // ── Rate limit pause before slots 4+5 ────────────────────────────────────
  console.log("\n⏳ Pausing 70s to reset rate limit window...");
  await sleep(70_000);

  // ── E2E.4a: contract_summary — known contract ($0.75) ───────────────────
  console.log("\n── E2E.4a: contract_summary contract ($0.75) ───────────────");
  const r4a = await submitTask(
    "Summarize contract 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A — explain what it does, who can interact with it, and what the risks are for a treasury agent.",
    "contract_summary", 0.75
  );
  if (r4a.status !== 200) {
    log("E2E.4a.submit", false, `HTTP ${r4a.status}: ${r4a.error}`);
  } else {
    const types = sseTypes(r4a.events);
    log("E2E.4a.sse_order",  types[0] === "treasury_snapshot", `first=${types[0]}`);
    log("E2E.4a.reasoning",  types.includes("reasoning_complete"), `decision present`);
    const completeEvt = r4a.events.find(e => e.type === "complete");
    const deferredEvt = r4a.events.find(e => e.type === "deferred");
    log("E2E.4a.terminal",   !!(completeEvt || deferredEvt), `complete=${!!completeEvt} deferred=${!!deferredEvt}`);
    if (r4a.taskId) {
      await sleep(1500);
      const db = await dbTask(r4a.taskId);
      log("E2E.4a.status",     ["complete","deferred"].includes(db?.status), `status=${db?.status}`);
      log("E2E.4a.result",     !!db?.result, `result length=${db?.result?.length ?? 0}`);
      if (db?.result) {
        const eoa = db.result.toLowerCase().includes("eoa");
        log("E2E.4a.is_contract", !eoa, `result says EOA: ${eoa} (should be false for contract address)`);
        console.log(`    result: ${db.result.slice(0,250)}...`);
      }
      log("E2E.4a.net_usdc",   (db?.net_usdc ?? 0) > 0, `net_usdc=${db?.net_usdc}`);
      const traces = await dbTraces(r4a.taskId);
      log("E2E.4a.traces",     traces.length > 0, `${traces.length} traces`);
      for (const t of traces) console.log(`    trace: [${t.type}] ${t.description?.slice(0,80)}`);
    }
  }

  await sleep(3000);

  // ── E2E.4b: contract_summary — EOA address ($0.75) ──────────────────────
  console.log("\n── E2E.4b: contract_summary EOA ($0.75) ────────────────────");
  const r4b = await submitTask(
    "Summarize contract 0x000000000000000000000000000000000000dead — what type of address is this?",
    "contract_summary", 0.75
  );
  if (r4b.status !== 200) {
    log("E2E.4b.submit", false, `HTTP ${r4b.status}: ${r4b.error}`);
  } else {
    const types = sseTypes(r4b.events);
    log("E2E.4b.sse_order",  types[0] === "treasury_snapshot", `first=${types[0]}`);
    const completeEvt = r4b.events.find(e => e.type === "complete");
    const deferredEvt = r4b.events.find(e => e.type === "deferred");
    log("E2E.4b.terminal",   !!(completeEvt || deferredEvt), `complete=${!!completeEvt} deferred=${!!deferredEvt}`);
    if (r4b.taskId) {
      await sleep(1500);
      const db = await dbTask(r4b.taskId);
      log("E2E.4b.status",     ["complete","deferred"].includes(db?.status), `status=${db?.status}`);
      log("E2E.4b.result",     !!db?.result, `result length=${db?.result?.length ?? 0}`);
      if (db?.result) {
        const mentionsEOA = db.result.toLowerCase().includes("eoa") || db.result.toLowerCase().includes("not a contract") || db.result.toLowerCase().includes("externally owned");
        log("E2E.4b.eoa_detected", mentionsEOA, `result mentions EOA/not-a-contract: ${mentionsEOA}`);
        console.log(`    result: ${db.result.slice(0,250)}`);
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  await pool.end();

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${"═".repeat(60)}`);
  console.log(`Phase 2 Results: ${passed} PASS  ${failed} FAIL  (${results.length} total)`);
  console.log("═".repeat(60));
  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.id}: ${r.note}`));
  }
  console.log();
}

main().catch(e => { console.error(e); process.exit(1); });
