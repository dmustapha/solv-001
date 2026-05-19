import { Client } from "pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  console.log("Running database migration...");
  const client = new Client({ connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL });
  await client.connect();

  const sql = (strings: TemplateStringsArray, ..._values: unknown[]) =>
    client.query(strings.join(""));

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

  await client.end();
  console.log("Migration complete");
  process.exit(0);
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
