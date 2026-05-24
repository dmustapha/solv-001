import { getDeferredTasks, completeTask } from "@/lib/db";
import { getTransactionCount } from "@/lib/arc-canteen";
import { executeTask } from "@/lib/task-execution";

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

      if (task.task_type === "wallet_watch" || task.task_type === "contract_watch") {
        const baseline = (state.baseline_tx_count as number) ?? 0;
        const address  = state.address as `0x${string}`;
        const current  = await getTransactionCount(address).catch(() => baseline);

        if (current > baseline) {
          const delta  = current - baseline;
          const result = `ALERT: ${delta} new transaction${delta === 1 ? "" : "s"} detected on ${address} since watch started (baseline: ${baseline}, current: ${current}).`;
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
    } catch (e) {
      results.push({ id: task.id, action: "error", error: String(e) });
    }
  }

  return Response.json({ processed: deferred.length, results });
}
