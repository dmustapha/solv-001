// solv-001 comprehensive test runner — targets Vercel
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, parseUnits } from "viem";
import { randomBytes } from "crypto";
import { Pool } from "pg";

const AGENT_URL       = "https://solv-001.vercel.app";
const PRIVATE_KEY     = "0x3661767a8f1298138129e305cc3178e086b459cb090a117cf014aa59884ae0be" as `0x${string}`;
const AGENT_WALLET    = "0x927c1d756d12879aebea0772f3ee220f21f4841a" as `0x${string}`; // Circle wallet (receives payment)
const SELLER_EOA      = "0x156D30820aec51eEB34C74977Eb5f106322c2B50" as `0x${string}`;
const ARC_CHAIN_ID    = 5042002;
const ARC_USDC        = "0x3600000000000000000000000000000000000000" as `0x${string}`;
const GATEWAY_WALLET  = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as `0x${string}`;
const ARC_RPC         = "https://rpc.testnet.arc-node.thecanteenapp.com/v1/swrm_d4643bb9d2ec62adf991e2b84a5968aca7bf48995bdb1f01b22e7f903da00f2c";
const PG_URL          = "postgresql://neondb_owner:npg_NSGYnJP4rke5@ep-gentle-scene-aqq1h9rg-pooler.c-8.us-east-1.aws.neon.tech/solv001?sslmode=require";

const account     = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({ account, transport: http(ARC_RPC) });
const pool        = new Pool({ connectionString: PG_URL });

const results: { id: string; pass: boolean; note: string }[] = [];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const RATE_PAUSE = 65_000; // 65s pause between rate-limit batches (5 tasks/min)

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
    message: {
      from: account.address, to: AGENT_WALLET,
      value: price,
      validAfter: now - 600n,
      validBefore: now + 604900n,
      nonce,
    },
  });
  return { from: account.address, to: AGENT_WALLET, value: price.toString(), validAfter: (now - 600n).toString(), validBefore: (now + 604900n).toString(), nonce, signature };
}

async function submitTask(task: string, task_type: string, price_usdc: number): Promise<{ status: number; taskId?: string; events: any[] }> {
  const payment_authorization = await buildPaymentAuth(price_usdc);
  const res = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, task_type, payer_wallet: account.address, client_type: "agent", payment_authorization }),
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
              const parsed = JSON.parse(line.slice(5));
              events.push(parsed);
              if (parsed.data?.task_id) taskId = parsed.data.task_id;
              console.log(`  SSE [${parsed.type}]`, JSON.stringify(parsed.data ?? "").slice(0, 120));
            } catch {}
          }
        }
      }
    }
  }
  return { status: res.status, taskId, events };
}

async function dbCheck(taskId: string) {
  const client = await pool.connect();
  try {
    const r = await client.query(`SELECT status, income_tx_hash, income_usdc, cost_usdc, net_usdc, expense_tx_hashes, result, client_type FROM tasks WHERE id = $1`, [taskId]);
    return r.rows[0];
  } finally { client.release(); }
}

async function runTests() {
  console.log(`\n=== solv-001 Test Runner → ${AGENT_URL} ===`);
  console.log(`Payer: ${account.address}\n`);

  // ── Suite 1: T1.1 — valid payment (wallet_intelligence) ──────────────────
  console.log("\n── T1.1: Valid EIP-3009 payment accepted ──");
  const t11 = await submitTask(
    "Analyze wallet 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A for counterparty risk",
    "wallet_intelligence", 0.50
  );
  
  if (!t11.taskId) {
    log("T1.1", false, `No task_id in SSE. HTTP ${t11.status}. Events: ${JSON.stringify(t11.events).slice(0,200)}`);
  } else {
    const db = await dbCheck(t11.taskId);
    // Circle Gateway returns UUID tx_hash (not 0x Arc hash) — accept any non-empty string
    const incomeOk = !!db?.income_tx_hash && db.income_tx_hash.length > 10;
    log("T1.1", !!db && db?.status === "complete" && incomeOk, `status=${db?.status} income_tx_hash=${db?.income_tx_hash?.slice(0,20)}... income=${db?.income_usdc} cost=${db?.cost_usdc}`);
    
    // check treasury_events
    const client = await pool.connect();
    const ev = await client.query(`SELECT type, amount_usdc FROM treasury_events WHERE type='income' ORDER BY created_at DESC LIMIT 1`);
    client.release();
    log("T1.1-treasury", ev.rows.length > 0, `treasury_events income: ${JSON.stringify(ev.rows[0])}`);
    
    // SSE sequence check
    const types = t11.events.map((e:any) => e.type);
    log("T1.1-sse", types.includes("treasury_snapshot"), `SSE types: ${types.join(", ")}`);
  }

  // ── T1.5: Replay rejected ─────────────────────────────────────────────────
  // (done separately — uses same nonce, should 402)
  // ── T1.7: Wrong recipient ─────────────────────────────────────────────────
  console.log("\n── T1.7: Wrong recipient rejected ──");
  const wrongAuth = await buildPaymentAuth(0.50);
  wrongAuth.to = "0x000000000000000000000000000000000000dEaD";
  const t17res = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "test", task_type: "wallet_intelligence", payer_wallet: account.address, client_type: "agent", payment_authorization: wrongAuth }),
  });
  log("T1.7", t17res.status === 402, `HTTP ${t17res.status} (expect 402). Body: ${(await t17res.text()).slice(0,100)}`);

  // ── T1.8: Amount too low ──────────────────────────────────────────────────
  console.log("\n── T1.8: Payment amount too low ──");
  const lowAuth = await buildPaymentAuth(0.01); // task requires 0.50
  const t18res = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "test", task_type: "wallet_intelligence", payer_wallet: account.address, client_type: "agent", payment_authorization: lowAuth }),
  });
  log("T1.8", t18res.status === 402, `HTTP ${t18res.status} (expect 402). Body: ${(await t18res.text()).slice(0,100)}`);

  // ── Suite 2: T2.1 — wallet_intelligence expense payments ─────────────────
  console.log("\n── T2.1/T3a.1: wallet_intelligence full end-to-end ──");
  // check trace_events for the T1.1 task
  if (t11.taskId) {
    const client = await pool.connect();
    const trace = await client.query(`SELECT type, description, cost_usdc FROM trace_events WHERE task_id=$1 AND type='query' ORDER BY timestamp`, [t11.taskId]);
    client.release();
    // wallet_intelligence makes 3 Arc RPC queries — check that trace events were recorded
    log("T2.1-trace", trace.rows.length >= 3, `Arc RPC query traces: ${trace.rows.length}. ${JSON.stringify(trace.rows.map((r: any) => r.description)).slice(0,200)}`);
    
    const db = await dbCheck(t11.taskId);
    const resultOk = !!(db?.result) && !db.result.includes("no major anomalies detected");
    log("T3a.1", db?.status === "complete" && db?.cost_usdc > 0 && resultOk,
      `status=${db?.status} cost=${db?.cost_usdc} result_preview="${db?.result?.slice(0,100)}"`);
  }

  // ── T3a.2: Fresh wallet ───────────────────────────────────────────────────
  console.log("\n── T3a.2: Fresh wallet (limited history) ──");
  const t3a2 = await submitTask("Analyze wallet 0x0000000000000000000000000000000000000001", "wallet_intelligence", 0.50);
  if (t3a2.taskId) {
    const db = await dbCheck(t3a2.taskId);
    const limitedHistory = db?.result?.toLowerCase().includes("limited") || db?.result?.toLowerCase().includes("no transaction") || db?.result?.toLowerCase().includes("caution");
    log("T3a.2", db?.status === "complete" && limitedHistory, `status=${db?.status} result="${db?.result?.slice(0,150)}"`);
  } else {
    log("T3a.2", false, `No task_id. HTTP ${t3a2.status}`);
  }

  // ── T3a.3: No address fallback ────────────────────────────────────────────
  console.log("\n── T3a.3: No address → fallback to DEMO_WALLET_01 ──");
  const t3a3 = await submitTask("Analyze my wallet for risk", "wallet_intelligence", 0.50);
  if (t3a3.taskId) {
    const db = await dbCheck(t3a3.taskId);
    log("T3a.3", db?.status === "complete", `status=${db?.status} result="${db?.result?.slice(0,100)}"`);
  } else {
    log("T3a.3", false, `No task_id. HTTP ${t3a3.status}. Events: ${JSON.stringify(t3a3.events).slice(0,200)}`);
  }

  // ── T3b.1: contract_summary known contract ─────────────────────────────────
  console.log("\n── T3b.1: contract_summary USYC ──");
  const t3b1 = await submitTask("Summarize contract 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C", "contract_summary", 0.75);
  if (t3b1.taskId) {
    const db = await dbCheck(t3b1.taskId);
    const notHardcoded = !db?.result?.includes("ERC-20/Teller pattern detected");
    log("T3b.1", db?.status === "complete" && notHardcoded, `status=${db?.status} is_real_analysis=${notHardcoded} result="${db?.result?.slice(0,150)}"`);
  } else {
    log("T3b.1", false, `No task_id. HTTP ${t3b1.status}`);
  }

  // ── Batch 1 exhausted (4 tasks). Wait for rate limit window reset ─────────
  console.log(`\n⏳ Rate limit pause (${RATE_PAUSE/1000}s)…`);
  await sleep(RATE_PAUSE);

  // ── T3b.2: EOA address ─────────────────────────────────────────────────────
  console.log("\n── T3b.2: contract_summary EOA address ──");
  const t3b2 = await submitTask("Summarize contract 0x0000000000000000000000000000000000000001", "contract_summary", 0.75);
  if (t3b2.taskId) {
    const db = await dbCheck(t3b2.taskId);
    const isEoaMsg = db?.result?.toLowerCase().includes("eoa") || db?.result?.toLowerCase().includes("not a contract") || db?.result?.toLowerCase().includes("externally");
    log("T3b.2", db?.status === "complete" && isEoaMsg, `status=${db?.status} eoa_detected=${isEoaMsg} result="${db?.result?.slice(0,150)}"`);
  } else {
    log("T3b.2", false, `No task_id. HTTP ${t3b2.status}`);
  }

  // ── T3e.1: general research ────────────────────────────────────────────────
  console.log("\n── T3e.1: general research ──");
  const t3e1 = await submitTask("Research DeFi yield strategies for stablecoin treasuries on Arc testnet", "general", 0.30);
  if (t3e1.taskId) {
    const db = await dbCheck(t3e1.taskId);
    const notTemplate = !db?.result?.includes("no major anomalies detected") && !db?.result?.includes("Research on Arc testnet:");
    log("T3e.1", db?.status === "complete" && notTemplate && db?.cost_usdc > 0,
      `status=${db?.status} cost=${db?.cost_usdc} real_ai=${notTemplate} result="${db?.result?.slice(0,100)}"`);
  } else {
    log("T3e.1", false, `No task_id. HTTP ${t3e1.status}`);
  }

  // ── T3d.1: wallet_watch baseline ──────────────────────────────────────────
  console.log("\n── T3d.1: wallet_watch baseline snapshot ──");
  const t3d1 = await submitTask("Watch wallet 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A for activity", "wallet_watch", 0.50);
  if (t3d1.taskId) {
    const db = await dbCheck(t3d1.taskId);
    log("T3d.1", db?.status === "complete", `status=${db?.status} result="${db?.result?.slice(0,120)}"`);
  } else {
    log("T3d.1", false, `No task_id. HTTP ${t3d1.status}`);
  }

  // ── T3d.2: wallet_watch no address ────────────────────────────────────────
  console.log("\n── T3d.2: wallet_watch no address ──");
  const t3d2 = await submitTask("Watch this address for changes", "wallet_watch", 0.50);
  if (t3d2.taskId) {
    const db = await dbCheck(t3d2.taskId);
    const noMonitor = db?.result?.includes("No address") || db?.result?.includes("no address") || db?.result?.includes("monitoring not started");
    log("T3d.2", db?.status === "complete" && noMonitor, `status=${db?.status} result="${db?.result?.slice(0,150)}"`);
  } else {
    log("T3d.2", false, `No task_id. HTTP ${t3d2.status}`);
  }

  // ── Batch 2 exhausted (4 tasks). Wait for rate limit window reset ─────────
  console.log(`\n⏳ Rate limit pause (${RATE_PAUSE/1000}s)…`);
  await sleep(RATE_PAUSE);

  // ── T3c.1: conditional_payment ────────────────────────────────────────────
  console.log("\n── T3c.1: conditional_payment (condition met) ──");
  const t3c1 = await submitTask(
    "Send 0.01 USDC to 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A if balance > 0",
    "conditional_payment", 0.50
  );
  if (t3c1.taskId) {
    const db = await dbCheck(t3c1.taskId);
    log("T3c.1", db?.status === "complete", `status=${db?.status} result="${db?.result?.slice(0,150)}"`);
  } else {
    log("T3c.1", false, `No task_id. HTTP ${t3c1.status}`);
  }

  // ── T3c.2: conditional_payment condition not met ──────────────────────────
  console.log("\n── T3c.2: conditional_payment (condition not met) ──");
  const t3c2 = await submitTask(
    "Send 1000 USDC to 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A if balance > 999999",
    "conditional_payment", 0.50
  );
  if (t3c2.taskId) {
    const db = await dbCheck(t3c2.taskId);
    const skipped = db?.result?.includes("skip") || db?.result?.includes("not met") || db?.result?.includes("NOT met");
    log("T3c.2", db?.status === "complete" && skipped, `status=${db?.status} skipped=${skipped} result="${db?.result?.slice(0,150)}"`);
  } else {
    log("T3c.2", false, `No task_id. HTTP ${t3c2.status}`);
  }

  // ── T4.1: USYC position read ───────────────────────────────────────────────
  console.log("\n── T4.1: USYC position read ──");
  const treasury = await fetch(`${AGENT_URL}/api/treasury`).then(r => r.json() as any);
  log("T4.1", typeof treasury.usyc_apy === "number" && treasury.usyc_apy > 0,
    `usdc_balance=${treasury.usdc_balance} usyc_apy=${treasury.usyc_apy} usyc_balance=${treasury.usyc_balance}`);

  // ── T5.1: A2A signs real EIP-3009 ─────────────────────────────────────────
  // Already tested via T1.1 (same flow). Check client_type = 'agent'
  if (t11.taskId) {
    const db = await dbCheck(t11.taskId);
    log("T5.1", db?.client_type === "agent", `client_type=${db?.client_type}`);
  }

  // ── T6.1: estimate_task ────────────────────────────────────────────────────
  const est = await fetch(`${AGENT_URL}/api/tasks/estimate?task_type=wallet_intelligence`).then(r => r.json() as any);
  log("T6.1", est.price_usdc === 0.5 && est.estimated_margin_pct === "97.0%",
    `price_usdc=${est.price_usdc} margin=${est.estimated_margin_pct}`);

  // ── T6.2: get_treasury_status ─────────────────────────────────────────────
  log("T6.2", typeof treasury.usdc_balance === "number" && typeof treasury.total_tasks_completed === "number",
    `usdc_balance=${treasury.usdc_balance} tasks=${treasury.total_tasks_completed}`);

  // ── T7.4: Invalid task_type ────────────────────────────────────────────────
  const inv = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "test", task_type: "make_me_rich", payer_wallet: account.address }),
  });
  log("T7.4", inv.status === 400, `HTTP ${inv.status}`);

  // ── T7.5: Task too long ────────────────────────────────────────────────────
  const long = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "A".repeat(2001), task_type: "general", payer_wallet: account.address }),
  });
  log("T7.5", long.status === 400, `HTTP ${long.status}`);

  // ── T7.9: No payment_authorization → 402 ──────────────────────────────────
  const nopay = await fetch(`${AGENT_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "test", task_type: "general", payer_wallet: account.address }),
  });
  const nopayHeaders = Object.fromEntries(nopay.headers.entries());
  log("T7.9", nopay.status === 402 && !!nopayHeaders["payment-required"],
    `HTTP ${nopay.status} payment-required header=${!!nopayHeaders["payment-required"]}`);

  // ── T6.5: MCP server name ─────────────────────────────────────────────────
  const mcp = await fetch(`${AGENT_URL}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
    body: JSON.stringify({ method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } }, id: 1, jsonrpc: "2.0" }),
  });
  // MCP transport returns SSE — parse the data: line
  const mcpText = await mcp.text();
  let mcpResult: any = null;
  for (const line of mcpText.split("\n")) {
    if (line.startsWith("data: ")) {
      try { mcpResult = JSON.parse(line.slice(6)); } catch {}
    }
  }
  log("T6.5", mcpResult?.result?.serverInfo?.name === "solv-001", `serverInfo.name=${mcpResult?.result?.serverInfo?.name}`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════");
  console.log("RESULTS SUMMARY");
  console.log("══════════════════════════════════════════");
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  results.forEach(r => console.log(`${r.pass ? "✅" : "❌"} ${r.id}: ${r.note}`));
  console.log(`\n${passed} passed / ${failed} failed`);
  
  await pool.end();
}

runTests().catch(err => { console.error("Fatal:", err); process.exit(1); });
