import { getDeferredTasks, completeTask } from "@/lib/db";
import { getTransactionCount, getLogs } from "@/lib/arc-canteen";
import { executeTask } from "@/lib/task-execution";

const ARC_USDC     = "0x3600000000000000000000000000000000000000";
const TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const DATA_COST = 0.005;

export async function GET(req: Request): Promise<Response> {
  // Verify Vercel cron authorization
  if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let deferred: Awaited<ReturnType<typeof getDeferredTasks>>;
  try {
    deferred = await getDeferredTasks();
  } catch (e) {
    return Response.json({ error: `DB query failed: ${String(e)}` }, { status: 500 });
  }

  const results: { id: string; action: string; result?: string; error?: string }[] = [];

  for (const task of deferred) {
    // Guard: skip if somehow already out of deferred state
    if (task.status !== "deferred") continue;

    try {
      const state = JSON.parse(task.reasoning ?? "{}") as Record<string, unknown>;

      if (task.task_type === "scheduled_disbursement") {
        const scheduledDate = new Date((state.scheduled_date as string) ?? "2099-01-01");
        if (new Date() >= scheduledDate) {
          const { result, cost_usdc, expense_tx_hashes } = await executeTask(task, () => {});
          await completeTask({
            id:                task.id,
            cost_usdc,
            net_usdc:          task.income_usdc - cost_usdc,
            reasoning:         "Executed via daily cron — scheduled date reached.",
            result,
            expense_tx_hashes: expense_tx_hashes as string[],
          });
          results.push({ id: task.id, action: "completed", result });
        }
        // else: not yet — leave deferred
      }

      if (task.task_type === "wallet_watch") {
        const baselineTxCount   = (state.baseline_tx_count   as number) ?? 0;
        const baselineRecvCount = (state.baseline_recv_count as number) ?? 0;
        const address           = state.address as `0x${string}`;
        const paddedAddress     = "0x" + "0".repeat(24) + address.slice(2).toLowerCase();

        const [currentTx, recvLogs] = await Promise.allSettled([
          getTransactionCount(address).catch(() => baselineTxCount),
          getLogs({ fromBlock: "0x0", toBlock: "latest", address: ARC_USDC, topics: [TRANSFER_SIG, null, paddedAddress] })
            .then(l => l.length).catch(() => baselineRecvCount),
        ]);
        const currentTxCount   = currentTx.status   === "fulfilled" ? (currentTx.value as number)   : baselineTxCount;
        const currentRecvCount = recvLogs.status     === "fulfilled" ? (recvLogs.value as number)    : baselineRecvCount;

        const newOutbound  = currentTxCount   - baselineTxCount;
        const newIncoming  = currentRecvCount - baselineRecvCount;

        if (newOutbound > 0 || newIncoming > 0) {
          const parts: string[] = [];
          if (newOutbound > 0) parts.push(`${newOutbound} new outbound transaction${newOutbound === 1 ? "" : "s"}`);
          if (newIncoming > 0) parts.push(`${newIncoming} new incoming USDC transfer${newIncoming === 1 ? "" : "s"}`);
          const result = `ALERT: ${parts.join(" and ")} detected on wallet ${address} since watch started.`;
          await completeTask({
            id:                task.id,
            cost_usdc:         DATA_COST,
            net_usdc:          task.income_usdc - DATA_COST,
            reasoning:         "Activity detected by daily cron.",
            result,
            expense_tx_hashes: [],
          });
          results.push({ id: task.id, action: "completed", result });
        }
        // else: no change — leave deferred until next cron run
      }

      if (task.task_type === "contract_watch") {
        const baselineBlock = (state.baseline_block as number) ?? 0;
        const address       = state.address as `0x${string}`;
        const fromBlock     = "0x" + baselineBlock.toString(16);

        // Check for any event emitted by this contract since baseline block
        const logs = await getLogs({ fromBlock, toBlock: "latest", address }).catch(() => []);

        if (logs.length > 0) {
          const result = `ALERT: ${logs.length} new event${logs.length === 1 ? "" : "s"} detected on contract ${address} since block ${baselineBlock}.`;
          await completeTask({
            id:                task.id,
            cost_usdc:         DATA_COST,
            net_usdc:          task.income_usdc - DATA_COST,
            reasoning:         "Contract events detected by daily cron.",
            result,
            expense_tx_hashes: [],
          });
          results.push({ id: task.id, action: "completed", result });
        }
        // else: no events — leave deferred
      }
    } catch (e) {
      results.push({ id: task.id, action: "error", error: String(e) });
    }
  }

  return Response.json({ processed: deferred.length, results });
}
