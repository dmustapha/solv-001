import { sql } from "@vercel/postgres";
import type { Task, TaskStatus, TaskType, TraceEvent } from "@/types";

// ─── Schema ──────────────────────────────────────────────────────────────────
// Run once via scripts/migrate.ts or Vercel Postgres dashboard:
//
// CREATE TABLE IF NOT EXISTS tasks (
//   id                TEXT PRIMARY KEY,
//   task              TEXT NOT NULL,
//   task_type         TEXT NOT NULL,
//   payer_wallet      TEXT NOT NULL,
//   status            TEXT NOT NULL DEFAULT 'pending',
//   income_usdc       NUMERIC(10,6) NOT NULL DEFAULT 0,
//   cost_usdc         NUMERIC(10,6),
//   net_usdc          NUMERIC(10,6),
//   reasoning         TEXT,
//   result            TEXT,
//   client_type       TEXT NOT NULL DEFAULT 'human',
//   income_tx_hash    TEXT,
//   expense_tx_hashes TEXT[] NOT NULL DEFAULT '{}',
//   created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
//   completed_at      TIMESTAMPTZ
// );
//
// CREATE TABLE IF NOT EXISTS treasury_events (
//   id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
//   type        TEXT NOT NULL,   -- 'income' | 'expense' | 'sweep' | 'redeem'
//   amount_usdc NUMERIC(10,6) NOT NULL,
//   tx_hash     TEXT,
//   arc_link    TEXT,
//   created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
// );
//
// CREATE TABLE IF NOT EXISTS trace_events (
//   id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
//   task_id     TEXT NOT NULL REFERENCES tasks(id),
//   type        TEXT NOT NULL,
//   description TEXT NOT NULL,
//   arc_tx_hash TEXT,
//   cost_usdc   NUMERIC(10,6),
//   timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
// );

export async function insertTask(params: {
  id: string;
  task: string;
  task_type: TaskType;
  payer_wallet: string;
  income_usdc: number;
  client_type: "human" | "agent";
}): Promise<void> {
  await sql`
    INSERT INTO tasks (id, task, task_type, payer_wallet, status, income_usdc, client_type)
    VALUES (${params.id}, ${params.task}, ${params.task_type}, ${params.payer_wallet},
            'pending', ${params.income_usdc}, ${params.client_type})
  `;
}

export async function getTask(id: string): Promise<Task | null> {
  const result = await sql`SELECT * FROM tasks WHERE id = ${id} LIMIT 1`;
  if (result.rows.length === 0) return null;
  return rowToTask(result.rows[0]);
}

export async function listTasks(limit = 50): Promise<Task[]> {
  const result = await sql`
    SELECT * FROM tasks ORDER BY created_at DESC LIMIT ${limit}
  `;
  return result.rows.map(rowToTask);
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  await sql`UPDATE tasks SET status = ${status} WHERE id = ${id}`;
}

export async function completeTask(params: {
  id: string;
  cost_usdc: number;
  net_usdc: number;
  reasoning: string;
  result: string;
  income_tx_hash?: string;
  expense_tx_hashes: string[];
}): Promise<void> {
  await sql`
    UPDATE tasks SET
      status            = 'complete',
      cost_usdc         = ${params.cost_usdc},
      net_usdc          = ${params.net_usdc},
      reasoning         = ${params.reasoning},
      result            = ${params.result},
      income_tx_hash    = ${params.income_tx_hash ?? null},
      expense_tx_hashes = ${`{${params.expense_tx_hashes.map(h => `"${h}"`).join(",")}}` as unknown as string},
      completed_at      = now()
    WHERE id = ${params.id}
  `;
}

export async function deferTask(id: string, reasoning: string): Promise<void> {
  await sql`UPDATE tasks SET status = 'deferred', reasoning = ${reasoning} WHERE id = ${id}`;
}

export async function rejectTask(id: string, reasoning: string): Promise<void> {
  await sql`UPDATE tasks SET status = 'rejected', reasoning = ${reasoning} WHERE id = ${id}`;
}

export async function failTask(id: string, reasoning: string): Promise<void> {
  await sql`UPDATE tasks SET status = 'failed', reasoning = ${reasoning} WHERE id = ${id}`;
}

export async function cleanupZombieTasks(): Promise<void> {
  await sql`
    UPDATE tasks
    SET status    = 'failed',
        reasoning = 'Execution timed out — serverless function limit exceeded'
    WHERE status IN ('pending', 'reasoning', 'executing')
    AND created_at < NOW() - INTERVAL '5 minutes'
  `;
}

export async function insertTraceEvent(event: Omit<TraceEvent, "id">): Promise<void> {
  await sql`
    INSERT INTO trace_events (task_id, type, description, arc_tx_hash, cost_usdc, timestamp)
    VALUES (${event.task_id}, ${event.type}, ${event.description},
            ${event.arc_tx_hash ?? null}, ${event.cost_usdc ?? null}, ${event.timestamp.toISOString()})
  `;
}

export async function getTraceEvents(task_id: string): Promise<TraceEvent[]> {
  const result = await sql`
    SELECT * FROM trace_events WHERE task_id = ${task_id} ORDER BY timestamp ASC
  `;
  return result.rows.map(r => ({
    id: r.id,
    task_id: r.task_id,
    type: r.type,
    description: r.description,
    arc_tx_hash: r.arc_tx_hash,
    cost_usdc: r.cost_usdc ? parseFloat(r.cost_usdc) : undefined,
    timestamp: new Date(r.timestamp),
  }));
}

export async function insertTreasuryEvent(params: {
  type: "income" | "expense" | "sweep" | "redeem";
  amount_usdc: number;
  tx_hash?: string;
  arc_link?: string;
}): Promise<void> {
  await sql`
    INSERT INTO treasury_events (type, amount_usdc, tx_hash, arc_link)
    VALUES (${params.type}, ${params.amount_usdc}, ${params.tx_hash ?? null}, ${params.arc_link ?? null})
  `;
}

export async function getTodayStats(): Promise<{
  income: number;
  expense: number;
  completed_count: number;
}> {
  const result = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount_usdc ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_usdc ELSE 0 END), 0) as expense
    FROM treasury_events
    WHERE created_at >= CURRENT_DATE
  `;
  const tasks = await sql`
    SELECT COUNT(*) as cnt FROM tasks WHERE status = 'complete' AND completed_at >= CURRENT_DATE
  `;
  return {
    income:          parseFloat(result.rows[0].income),
    expense:         parseFloat(result.rows[0].expense),
    completed_count: parseInt(tasks.rows[0].cnt, 10),
  };
}

export async function getAllTimeStats(): Promise<{
  total_income: number;
  total_completed: number;
  pending_income: number;
}> {
  const income = await sql`
    SELECT COALESCE(SUM(amount_usdc), 0) as total FROM treasury_events WHERE type = 'income'
  `;
  const completed = await sql`SELECT COUNT(*) as cnt FROM tasks WHERE status = 'complete'`;
  const pending = await sql`
    SELECT COALESCE(SUM(income_usdc), 0) as total FROM tasks
    WHERE status IN ('pending', 'reasoning', 'executing')
    AND created_at > NOW() - INTERVAL '5 minutes'
  `;
  return {
    total_income:    parseFloat(income.rows[0].total),
    total_completed: parseInt(completed.rows[0].cnt, 10),
    pending_income:  parseFloat(pending.rows[0].total),
  };
}

export async function getActiveTaskCount(): Promise<number> {
  // Only count tasks created in the last 5 minutes — avoids zombie tasks from timed-out serverless requests
  const result = await sql`
    SELECT COUNT(*) as cnt FROM tasks
    WHERE status IN ('pending', 'reasoning', 'executing')
    AND created_at > NOW() - INTERVAL '5 minutes'
  `;
  return parseInt(result.rows[0].cnt, 10);
}

function rowToTask(r: Record<string, unknown>): Task {
  return {
    id:                 r.id as string,
    task:               r.task as string,
    task_type:          r.task_type as TaskType,
    payer_wallet:       r.payer_wallet as `0x${string}`,
    status:             r.status as TaskStatus,
    income_usdc:        parseFloat(r.income_usdc as string),
    cost_usdc:          r.cost_usdc != null ? parseFloat(r.cost_usdc as string) : null,
    net_usdc:           r.net_usdc != null ? parseFloat(r.net_usdc as string) : null,
    reasoning:          r.reasoning as string | null,
    result:             r.result as string | null,
    client_type:        r.client_type as "human" | "agent",
    income_tx_hash:     r.income_tx_hash as `0x${string}` | null,
    expense_tx_hashes:  Array.isArray(r.expense_tx_hashes) ? r.expense_tx_hashes : [],
    created_at:         new Date(r.created_at as string),
    completed_at:       r.completed_at ? new Date(r.completed_at as string) : null,
  };
}
