import { NextRequest }        from "next/server";

export const maxDuration = 60; // seconds — signal to Vercel; upgrade to Pro for 300s
import { randomUUID }         from "crypto";
import { insertTask, listTasks, updateTaskStatus, completeTask, deferTask, rejectTask,
         failTask, getTask, insertTreasuryEvent, getAllTimeStats, getActiveTaskCount,
         cleanupZombieTasks }  from "@/lib/db";
import { build402Response, verifyNanopayment }  from "@/lib/nanopayments-seller";
import { getAgentWallet } from "@/lib/circle-wallets";
import { checkRateLimit, pruneExpiredEntries }  from "@/lib/rate-limit";
import { getUSYCPosition, sweepIdleUSDCtoUSYC, redeemUSYCIfNeeded }  from "@/lib/usyc";
import { streamTreasuryReasoning, buildReasoningContext } from "@/lib/treasury-reasoning";
import { executeTask }        from "@/lib/task-execution";
import type { TaskSubmission, TreasuryState, SSEEvent } from "@/types";
import { TASK_PRICING, OPERATING_RESERVE_USDC } from "@/types";

// ─── GET /api/tasks ───────────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  await cleanupZombieTasks();
  const tasks = await listTasks(50);
  return Response.json(tasks);
}

// ─── POST /api/tasks (streaming SSE) ─────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  let body: TaskSubmission;
  try {
    body = await req.json() as TaskSubmission;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { task, task_type, payer_wallet, callback_url, payment_authorization,
          client_type: submitted_client_type } = body;

  if (!task || !task_type || !payer_wallet) {
    return Response.json({ error: "task, task_type, and payer_wallet are required" }, { status: 400 });
  }

  // Rate limit: 5 task submissions per payer wallet per minute
  pruneExpiredEntries();
  const rl = checkRateLimit(`tasks:${payer_wallet}`, { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return Response.json(
      { error: "Rate limit exceeded. Max 5 tasks per minute per wallet." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  if (task.length > 2000) {
    return Response.json({ error: "task must be 2000 characters or fewer" }, { status: 400 });
  }

  // Validate callback_url if provided — prevent SSRF to internal hosts
  if (callback_url) {
    try {
      const parsed = new URL(callback_url);
      const h = parsed.hostname;
      const BLOCKED      = ["localhost", "0.0.0.0", "::1", "[::1]"];
      const BLOCKED_PFXS = ["127.", "192.168.", "10.", "172.16.", "169.254."];
      if (parsed.protocol !== "https:" ||
          BLOCKED.includes(h) ||
          BLOCKED_PFXS.some(p => h.startsWith(p))) {
        return Response.json({ error: "callback_url must be a public https URL" }, { status: 400 });
      }
    } catch {
      return Response.json({ error: "callback_url is not a valid URL" }, { status: 400 });
    }
  }

  const pricing = TASK_PRICING[task_type];
  if (!pricing) {
    return Response.json({
      error: `Unknown task_type: "${task_type}". Valid types: ${Object.keys(TASK_PRICING).join(", ")}`,
    }, { status: 400 });
  }

  // ── Payment gate — always required ────────────────────────────────────────
  const agentWalletAddress = process.env.CIRCLE_WALLET_ADDRESS!;
  const client_type: "human" | "agent" = submitted_client_type === "agent" ? "agent" : "human";

  if (!payment_authorization) {
    return build402Response({ price_usdc: pricing.price_usdc, task_type, requestUrl: req.url });
  }

  let verification: Awaited<ReturnType<typeof verifyNanopayment>>;
  try {
    verification = await verifyNanopayment(payment_authorization, agentWalletAddress);
  } catch {
    return Response.json({ error: "Malformed payment authorization" }, { status: 402 });
  }

  if (!verification.verified) {
    return Response.json(
      { error: `Payment verification failed: ${verification.error}` },
      { status: 402 },
    );
  }
  const income_tx_hash = verification.tx_hash;

  // ── Create task record ────────────────────────────────────────────────────
  const taskId = randomUUID();
  await insertTask({
    id:           taskId,
    task,
    task_type,
    payer_wallet,
    income_usdc:  pricing.price_usdc,
    client_type:  client_type as "human" | "agent",
  });

  await insertTreasuryEvent({
    type:        "income",
    amount_usdc: pricing.price_usdc,
    tx_hash:     income_tx_hash,
  });

  // ── Streaming SSE response ────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: SSEEvent): void {
        const line = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(line));
      }

      let wallet: { address: `0x${string}`; usdc_balance: number } | null = null;

      try {
        // 1. Send initial treasury snapshot
        await updateTaskStatus(taskId, "reasoning");
        const [walletInfo, allTimeStats, queue_depth] = await Promise.all([
          getAgentWallet(),
          getAllTimeStats(),
          getActiveTaskCount(),
        ]);
        wallet = walletInfo;

        let usycPosition = { usyc_balance: 0n, exchange_rate: 1, usdc_value: 0, apy: 0.0485 };
        try {
          usycPosition = await getUSYCPosition(wallet.address);
        } catch {
          // USYC read may fail if RPC is unavailable; continue with zero values
        }

        const treasuryState: TreasuryState = {
          usdc_balance:               wallet.usdc_balance,
          usyc_balance:               parseFloat(usycPosition.usyc_balance.toString()) / 1e18,
          usyc_usdc_value:            usycPosition.usdc_value,
          usyc_apy:                   usycPosition.apy,
          pending_income_usdc:        allTimeStats.pending_income,
          today_income_usdc:          0,
          today_expense_usdc:         0,
          today_net_usdc:             0,
          operating_reserve_usdc:     OPERATING_RESERVE_USDC,
          total_tasks_completed:      allTimeStats.total_completed,
          total_income_all_time_usdc: allTimeStats.total_income,
          last_updated:               new Date(),
        };

        send({ type: "treasury_snapshot", data: treasuryState });

        // 2. Stream Claude reasoning
        const reasoningCtx = buildReasoningContext({
          current_balance_usdc:           wallet.usdc_balance,
          usyc_usdc_value:                usycPosition.usdc_value,
          pending_income_usdc:            allTimeStats.pending_income,
          task_type,
          task_price_usdc:                pricing.price_usdc,
          estimated_execution_cost_usdc:  pricing.estimated_cost_usdc,
          queue_depth,
        });

        let finalDecision = null;
        for await (const event of streamTreasuryReasoning(reasoningCtx)) {
          if (event.chunk !== undefined) {
            send({ type: "reasoning_chunk", data: event.chunk });
          }
          if (event.decision) {
            finalDecision = event.decision;
            send({ type: "reasoning_complete", data: event.decision });
          }
        }

        if (!finalDecision) {
          finalDecision = { decision: "DEFER" as const, explanation: "Reasoning incomplete.", reasoning_tokens: 0 };
        }

        // 3. Act on decision
        if (finalDecision.decision === "DEFER") {
          await deferTask(taskId, finalDecision.explanation);
          send({ type: "deferred", data: { task_id: taskId, reason: finalDecision.explanation } });
          controller.close();
          return;
        }

        if (finalDecision.decision === "REJECT") {
          await rejectTask(taskId, finalDecision.explanation);
          send({ type: "rejected", data: { task_id: taskId, reason: finalDecision.explanation } });
          controller.close();
          return;
        }

        // ACCEPT — execute the task
        await updateTaskStatus(taskId, "executing");

        send({ type: "trace", data: {
          task_id:     taskId,
          type:        "payment_received",
          description: `Payment received: +${pricing.price_usdc} USDC${income_tx_hash ? ` [Arc tx: ${income_tx_hash}]` : ""}`,
          arc_tx_hash: income_tx_hash,
          timestamp:   new Date(),
        }});

        const taskRecord = await getTask(taskId);
        if (!taskRecord) throw new Error("Task record disappeared");

        const { result, cost_usdc, expense_tx_hashes } = await executeTask(
          taskRecord,
          (evt) => send(evt),
        );

        // Add Claude reasoning cost (~$3.75/1M tokens blended)
        const reasoningCostUsdc = Math.round((finalDecision.reasoning_tokens / 1_000_000) * 3.75 * 1_000_000) / 1_000_000;
        const totalCostUsdc = cost_usdc + reasoningCostUsdc;

        const net_usdc = pricing.price_usdc - totalCostUsdc;
        await completeTask({
          id:                taskId,
          cost_usdc:         totalCostUsdc,
          net_usdc,
          reasoning:         finalDecision.explanation,
          result,
          income_tx_hash:    income_tx_hash,
          expense_tx_hashes: expense_tx_hashes as string[],
        });

        send({ type: "complete", data: { task_id: taskId, result, net_usdc } });

        // 4. Post-completion: sweep idle USDC to USYC if warranted
        try {
          await sweepIdleUSDCtoUSYC();
        } catch {
          // Sweep failure is non-critical — may not be allowlisted yet
        }

        // 5. Redeem USYC to USDC if balance fell below operating reserve
        if (wallet) {
          try {
            await redeemUSYCIfNeeded(wallet.address);
          } catch {
            // Redeem failure is non-critical — may not be allowlisted yet
          }
        }

        // 6. If A2A client with callback, fire callback
        if (callback_url) {
          fetch(callback_url, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ task_id: taskId, result, reasoning: finalDecision.explanation }),
          }).catch(() => {/* callback failure is non-critical */});
        }

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", data: msg });
        await failTask(taskId, `Execution error: ${msg}`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
