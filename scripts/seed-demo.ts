import { sql }            from "@vercel/postgres";
import { GatewayClient }  from "@circle-fin/x402-batching/client";
import { randomUUID }     from "crypto";
import { checkChainLive } from "../src/lib/arc-canteen";
import dotenv             from "dotenv";

dotenv.config({ path: ".env.local" });

// ─── Seed state targets (from PRD Demo Prerequisites) ────────────────────────
const SEED_WALLETS = [
  { address: "0xDEMO010000000000000000000000000000000001" },
  { address: "0xDEMO020000000000000000000000000000000002" },
  { address: "0xDEMO030000000000000000000000000000000003" },
  { address: "0xDEMO040000000000000000000000000000000004" },
  { address: "0xDEMO050000000000000000000000000000000005" },
];

async function createSchema(): Promise<void> {
  console.log("Creating schema...");
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

  console.log("Schema ready.");
}

async function seedTasks(): Promise<void> {
  const existingCount = await sql`SELECT COUNT(*) as cnt FROM tasks`;
  if (parseInt(existingCount.rows[0].cnt) > 0) {
    console.log("Tasks already seeded. Skipping.");
    return;
  }

  console.log("Seeding 8 historical tasks...");

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 12);

  const taskSeeds = [
    { payer: SEED_WALLETS[0].address, task_type: "wallet_intelligence",  task: "Vet wallet 0xDEMO01 before transferring 100 USDC", income: 0.50, cost: 0.015, net: 0.485, daysAgo: 12 },
    { payer: SEED_WALLETS[1].address, task_type: "counterparty_vet",     task: "Is 0xDEMO02 a reliable counterparty?",              income: 0.50, cost: 0.015, net: 0.485, daysAgo: 11 },
    { payer: SEED_WALLETS[2].address, task_type: "general",              task: "Research Arc testnet liquidity pools",               income: 0.30, cost: 0.022, net: 0.278, daysAgo: 10 },
    { payer: SEED_WALLETS[3].address, task_type: "wallet_intelligence",  task: "Check transaction history for 0xDEMO03",             income: 0.50, cost: 0.015, net: 0.485, daysAgo: 8  },
    { payer: SEED_WALLETS[4].address, task_type: "contract_summary",     task: "Summarize the USYC Teller contract",                 income: 0.75, cost: 0.020, net: 0.730, daysAgo: 7  },
    { payer: SEED_WALLETS[0].address, task_type: "conditional_payment",  task: "Send 0.5 USDC to 0xDEMO04 when balance > 10",        income: 0.20, cost: 0.005, net: 0.195, daysAgo: 5  },
    { payer: SEED_WALLETS[1].address, task_type: "wallet_watch",         task: "Watch 0xDEMO05 for inbound transfers",               income: 0.10, cost: 0.040, net: 0.060, daysAgo: 3  },
    { payer: SEED_WALLETS[2].address, task_type: "general",              task: "Analyze Circle Gateway volume on Arc",                income: 0.30, cost: 0.022, net: 0.278, daysAgo: 1  },
  ];

  for (const seed of taskSeeds) {
    const id        = randomUUID();
    const createdAt = new Date(baseDate);
    createdAt.setDate(baseDate.getDate() + (12 - seed.daysAgo));
    const fakeIncTx  = `0x${randomHex(32)}`;
    const fakeExpTxs = [`0x${randomHex(32)}`, `0x${randomHex(32)}`];

    await sql`
      INSERT INTO tasks (id, task, task_type, payer_wallet, status, income_usdc, cost_usdc, net_usdc,
        reasoning, result, client_type, income_tx_hash, expense_tx_hashes, created_at, completed_at)
      VALUES (
        ${id}, ${seed.task}, ${seed.task_type}, ${seed.payer}, 'complete',
        ${seed.income}, ${seed.cost}, ${seed.net},
        ${"Balance confirmed at $15.23. Task margin 97%. Queue depth 0. Executing now."},
        ${"Task completed successfully."},
        'agent',
        ${fakeIncTx},
        ${`{${fakeExpTxs.join(",")}}`},
        ${createdAt.toISOString()},
        ${createdAt.toISOString()}
      )
    `;

    await sql`
      INSERT INTO treasury_events (type, amount_usdc, tx_hash, created_at)
      VALUES ('income', ${seed.income}, ${fakeIncTx}, ${createdAt.toISOString()})
    `;

    for (const expTx of fakeExpTxs) {
      await sql`
        INSERT INTO treasury_events (type, amount_usdc, tx_hash, created_at)
        VALUES ('expense', ${seed.cost / 2}, ${expTx}, ${createdAt.toISOString()})
      `;
    }
  }

  console.log("Tasks seeded.");
}

async function depositExpenseFunds(): Promise<void> {
  const privateKey = process.env.EXPENSE_WALLET_PRIVATE_KEY;
  if (!privateKey) { console.warn("EXPENSE_WALLET_PRIVATE_KEY not set — skipping GatewayClient deposit"); return; }

  console.log("Depositing $2 USDC into expense Gateway Wallet...");
  const client = new GatewayClient({ chain: "arcTestnet", privateKey: privateKey as `0x${string}` });
  await client.deposit("2");
  console.log("Expense wallet funded.");
}

function randomHex(n: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(n))).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function main(): Promise<void> {
  console.log("\nsolv-001 Demo Seeder");
  console.log("=========================\n");

  const chain = await checkChainLive().catch(() => null);
  if (chain) {
    console.log(`Arc testnet live — block #${chain.blockNumber}`);
  } else {
    console.warn("Arc testnet unreachable — seeding DB only (no onchain transactions)");
  }

  await createSchema();
  await seedTasks();
  await depositExpenseFunds();

  console.log("\nSeed complete. Demo state ready.");
  console.log("Run the app: npm run dev");
}

main().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
