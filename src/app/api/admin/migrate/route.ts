import { sql } from "@vercel/postgres";
import { NextRequest } from "next/server";

// One-time migration endpoint — must be explicitly enabled via ENABLE_MIGRATE_ENDPOINT=true
export async function POST(req: NextRequest): Promise<Response> {
  if (process.env.ENABLE_MIGRATE_ENDPOINT !== "true") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const secret = req.headers.get("x-admin-secret");
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || secret !== adminSecret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await sql`CREATE TABLE IF NOT EXISTS tasks (
      id                TEXT PRIMARY KEY,
      task              TEXT NOT NULL,
      task_type         TEXT NOT NULL,
      payer_wallet      TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'pending',
      income_usdc       NUMERIC(10,6) NOT NULL DEFAULT 0,
      cost_usdc         NUMERIC(10,6),
      net_usdc          NUMERIC(10,6),
      reasoning         TEXT,
      result            TEXT,
      client_type       TEXT NOT NULL DEFAULT 'human',
      income_tx_hash    TEXT,
      expense_tx_hashes TEXT[] NOT NULL DEFAULT '{}',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at      TIMESTAMPTZ
    )`;

    await sql`CREATE TABLE IF NOT EXISTS treasury_events (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      type        TEXT NOT NULL,
      amount_usdc NUMERIC(10,6) NOT NULL,
      tx_hash     TEXT,
      arc_link    TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS trace_events (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      task_id     TEXT NOT NULL REFERENCES tasks(id),
      type        TEXT NOT NULL,
      description TEXT NOT NULL,
      arc_tx_hash TEXT,
      cost_usdc   NUMERIC(10,6),
      timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

    // Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL`;
    await sql`CREATE INDEX IF NOT EXISTS idx_trace_events_task_id ON trace_events(task_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_treasury_events_type_created ON treasury_events(type, created_at)`;

    return Response.json({ success: true, message: "Migration complete" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
