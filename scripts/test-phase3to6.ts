// TESTING-PLAN-V3 — Phases 3-6
// N6.2 contract_watch, N6.3 scheduled future, rate limit RG.7, misc verifications
// Run: npx tsx scripts/test-phase3to6.ts

import { privateKeyToAccount }               from "viem/accounts";
import { createWalletClient, http, parseUnits } from "viem";
import { randomBytes }                        from "crypto";

const AGENT_URL      = "https://solv-001.vercel.app";
const PRIVATE_KEY    = "0x3661767a8f1298138129e305cc3178e086b459cb090a117cf014aa59884ae0be" as `0x${string}`;
const AGENT_WALLET   = "0x927c1d756d12879aebea0772f3ee220f21f4841a" as `0x${string}`;
const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as `0x${string}`;
const ARC_CHAIN_ID   = 5042002;
const ARC_RPC        = "https://rpc.testnet.arc-node.thecanteenapp.com/v1/swrm_d4643bb9d2ec62adf991e2b84a5968aca7bf48995bdb1f01b22e7f903da00f2c";

const account      = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({ account, transport: http(ARC_RPC) });
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
  const signature   = await walletClient.signTypedData({
    account,
    domain: { name: "GatewayWalletBatched", version: "1", chainId: ARC_CHAIN_ID, verifyingContract: GATEWAY_WALLET },
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
    message: { from: account.address, to: AGENT_WALLET, value: price, validAfter: now - 600n, validBefore: now + 604900n, nonce },
  });
  return { from: account.address, to: AGENT_WALLET, value: price.toString(), validAfter: (now - 600n).toString(), validBefore: (now + 604900n).toString(), nonce, signature };
}

type SSEEvent = { type: string; data?: any };

async function submitTask(task: string, task_type: string, price_usdc: number): Promise<{ status: number; taskId?: string; events: SSEEvent[] }> {
  const payment_authorization = await buildPaymentAuth(price_usdc);
  const res = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, task_type, payer_wallet: account.address, client_type: "agent", payment_authorization }),
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
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const parsed = JSON.parse(line.slice(5).trim()) as SSEEvent;
            events.push(parsed);
            if (parsed.data?.task_id) taskId = parsed.data.task_id;
            console.log(`    SSE [${parsed.type}] ${JSON.stringify(parsed.data ?? "").slice(0,100)}`);
          } catch {}
        }
      }
      if (d) {
        if (lineBuffer.startsWith("data:")) {
          try {
            const parsed = JSON.parse(lineBuffer.slice(5).trim()) as SSEEvent;
            events.push(parsed);
            if (parsed.data?.task_id) taskId = parsed.data.task_id;
            console.log(`    SSE [${parsed.type}] ${JSON.stringify(parsed.data ?? "").slice(0,100)}`);
          } catch {}
        }
        break;
      }
    }
  }
  return { status: res.status, taskId, events };
}

async function getTask(taskId: string) {
  const res = await fetch(`${AGENT_URL}/api/tasks/${taskId}`);
  return res.ok ? res.json() : null;
}

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log("TESTING-PLAN-V3 — Phases 3-6");
  console.log(`Payer: ${account.address}`);
  console.log(`${"═".repeat(60)}\n`);

  // ── N6.2: contract_watch deferred persistence ($0.10) ──────────────────
  console.log("\n── N6.2: contract_watch ($0.10) ─────────────────────────────");
  const r_cw = await submitTask(
    "Monitor contract 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A for Deposit and Withdraw events. Alert on any activity.",
    "contract_watch", 0.10
  );
  if (r_cw.status !== 200) {
    log("N6.2.submit", false, `HTTP ${r_cw.status}`);
  } else {
    const types = r_cw.events.map(e => e.type);
    log("N6.2.sse_ok",     types.includes("reasoning_complete"), `reasoning_complete=${types.includes("reasoning_complete")}`);
    log("N6.2.has_result", !!(r_cw.events.find(e => e.type === "complete") || r_cw.events.find(e => e.type === "deferred")), `terminal=${types.filter(t => ["complete","deferred"].includes(t)).join(",")}`);
    if (r_cw.taskId) {
      await sleep(2000);
      const db = await getTask(r_cw.taskId);
      log("N6.2.deferred",     db?.status === "deferred", `status=${db?.status}`);
      log("N6.2.result_set",   !!db?.result, `result=${db?.result ? '"'+db.result.slice(0,80)+'"' : "NULL"}`);
      if (db?.result) {
        try { JSON.parse(db.result); log("N6.2.result_not_json", false, "result is JSON blob (BAD)"); }
        catch { log("N6.2.result_not_json", true, "result is readable text (GOOD)"); }
      }
      const label = (db?.status === "deferred" && ["contract_watch","wallet_watch"].includes(db?.task_type))
        ? "monitoring" : db?.status;
      log("N6.2.label_monitoring", label === "monitoring", `computed label='${label}'`);
    }
  }

  await sleep(2000);

  // ── N6.3: scheduled_disbursement future date ($0.20) ───────────────────
  console.log("\n── N6.3: scheduled_disbursement future ($0.20) ──────────────");
  const r_sd = await submitTask(
    "Send $0.01 USDC to 0x000000000000000000000000000000000000dEaD in 24 hours from now.",
    "scheduled_disbursement", 0.20
  );
  if (r_sd.status !== 200) {
    log("N6.3.submit", false, `HTTP ${r_sd.status}`);
  } else {
    const types = r_sd.events.map(e => e.type);
    log("N6.3.sse_ok", types.includes("reasoning_complete"), `reasoning=${types.includes("reasoning_complete")}`);
    log("N6.3.terminal", !!(r_sd.events.find(e => ["complete","deferred"].includes(e.type))), `terminal events: ${types.filter(t => ["complete","deferred"].includes(t))}`);
    if (r_sd.taskId) {
      await sleep(2000);
      const db = await getTask(r_sd.taskId);
      log("N6.3.deferred",     db?.status === "deferred", `status=${db?.status} (expected deferred for future date)`);
      log("N6.3.result_set",   !!db?.result, `result=${db?.result ? '"'+db.result.slice(0,100)+'"' : "NULL"}`);
      const label = (db?.status === "deferred" && ["scheduled_disbursement","conditional_payment"].includes(db?.task_type))
        ? "scheduled" : db?.status;
      log("N6.3.label_scheduled", label === "scheduled", `computed label='${label}'`);
    }
  }

  // ── Rate limit pause before RG.7 ─────────────────────────────────────────
  console.log("\n⏳ Waiting 70s to reset rate limit window for RG.7 test...");
  await sleep(70_000);

  // ── RG.7: Rate limit — 5 succeed, 6th gets 429 ────────────────────────
  // Strategy: for requests 1-5, just read until the first SSE event (treasury_snapshot)
  // to confirm task insertion happened, then immediately move to the next request.
  // insertTask is called BEFORE the SSE stream starts, so treasury_snapshot = task inserted.
  // This keeps all 5 tasks within the 60-second window when request 6 is sent.
  console.log("\n── RG.7: Rate limit test ────────────────────────────────────");
  const rlResults: number[] = [];
  for (let i = 1; i <= 6; i++) {
    const auth = await buildPaymentAuth(0.30);
    const res  = await fetch(`${AGENT_URL}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: `Rate limit test ${i}`, task_type: "general", payer_wallet: account.address, client_type: "agent", payment_authorization: auth }),
    });
    rlResults.push(res.status);
    console.log(`    Request ${i}: HTTP ${res.status}`);
    if (res.status === 429) break; // Stop after first 429
    // For non-429: read until treasury_snapshot (confirms insertTask ran), then abandon stream.
    // This ensures the task is in DB before we send the next request.
    if (res.ok && res.body) {
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = "";
      let inserted   = false;
      while (!inserted) {
        const { value, done: d } = await reader.read();
        if (value) {
          lineBuffer += decoder.decode(value, { stream: !d });
          if (lineBuffer.includes("treasury_snapshot")) inserted = true;
        }
        if (d) break;
      }
      reader.cancel().catch(() => {});
    }
    await sleep(200); // brief pause to let DB write propagate
  }
  log("RG.7.first5_ok",    rlResults.slice(0, Math.min(5, rlResults.length)).every(s => s === 200), `statuses=${rlResults.join(",")}`);
  log("RG.7.6th_429",      rlResults[rlResults.length - 1] === 429, `6th status=${rlResults[rlResults.length - 1]}`);

  // ── N3.6: Global /api/tasks returns all wallets ─────────────────────────
  console.log("\n── N3.6 / RG.7b: Remaining API checks ──────────────────────");
  const globalRes = await fetch(`${AGENT_URL}/api/tasks`);
  const global    = await globalRes.json() as any[];
  const wallets   = new Set(global.map((t: any) => t.payer_wallet));
  log("N3.6.global_no_filter", globalRes.status === 200 && global.length > 0, `${global.length} tasks, ${wallets.size} wallet(s)`);

  // ── N7.2b: /api/treasury still healthy after all paid tasks ─────────────
  const tRes  = await fetch(`${AGENT_URL}/api/treasury`);
  const tData = await tRes.json() as any;
  log("N7.2b.treasury_healthy",  tData.usdc_balance > 15, `usdc_balance=${tData.usdc_balance.toFixed(2)} (expected >15 after ~$2.40 spend)`);
  log("N7.2b.total_tasks",       tData.total_tasks_completed >= 200, `total_tasks=${tData.total_tasks_completed}`);
  log("N7.2b.apy_intact",        tData.usyc_apy === 0.0485, `usyc_apy=${tData.usyc_apy}`);

  // ── N10.7: No double fetch — check /api/tasks?wallet= filter ───────────
  const filteredRes = await fetch(`${AGENT_URL}/api/tasks?wallet=${account.address}`);
  const filtered    = await filteredRes.json() as any[];
  const allMatch    = filtered.every((t: any) => t.payer_wallet.toLowerCase() === account.address.toLowerCase());
  log("N10.7.wallet_filter", filteredRes.status === 200 && allMatch, `${filtered.length} tasks, all match wallet: ${allMatch}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${"═".repeat(60)}`);
  console.log(`Phases 3-6 Results: ${passed} PASS  ${failed} FAIL  (${results.length} total)`);
  console.log("═".repeat(60));
  if (failed > 0) {
    console.log("\nFailed:");
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.id}: ${r.note}`));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
