import { sql } from "@vercel/postgres";
import { NextRequest } from "next/server";

// One-time migration endpoint — protected by ADMIN_SECRET env var
export async function POST(req: NextRequest): Promise<Response> {
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

    return Response.json({ success: true, message: "Migration complete" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
