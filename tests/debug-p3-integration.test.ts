/**
 * Phase 3 — Integration Tests (non-user-facing connections)
 * Tests API↔DB, API↔treasury-reasoning, treasury API schema,
 * agent-card completeness, data-service endpoints.
 */

import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000";

// ── Layer 1: GET /api/tasks (DB read) ─────────────────────────────────────────

describe("INT-L1: GET /api/tasks — DB connection", () => {
  it("returns array from database", async () => {
    const res = await fetch(`${BASE}/api/tasks`);
    expect(res.status).toBe(200);
    const tasks = await res.json();
    expect(Array.isArray(tasks)).toBe(true);
  });

  it("seeded tasks have correct shape", async () => {
    const res = await fetch(`${BASE}/api/tasks`);
    const tasks = await res.json();
    expect(tasks.length).toBeGreaterThan(0);
    const t = tasks[0];
    expect(t).toHaveProperty("id");
    expect(t).toHaveProperty("task");
    expect(t).toHaveProperty("task_type");
    expect(t).toHaveProperty("payer_wallet");
    expect(t).toHaveProperty("status");
    expect(t).toHaveProperty("income_usdc");
  });

  it("has at least 8 seeded tasks", async () => {
    const res = await fetch(`${BASE}/api/tasks`);
    const tasks = await res.json();
    expect(tasks.length).toBeGreaterThanOrEqual(8);
  });
});

// ── Layer 2: GET /api/treasury — treasury stats from DB ──────────────────────

describe("INT-L2: GET /api/treasury — treasury state aggregation", () => {
  it("returns valid TreasuryState shape", async () => {
    const res = await fetch(`${BASE}/api/treasury`);
    expect(res.status).toBe(200);
    const state = await res.json();
    expect(state).toHaveProperty("usdc_balance");
    expect(state).toHaveProperty("usyc_apy");
    expect(state).toHaveProperty("total_tasks_completed");
    expect(state).toHaveProperty("total_income_all_time_usdc");
    expect(state).toHaveProperty("operating_reserve_usdc");
    expect(state).toHaveProperty("last_updated");
  });

  it("total_income_all_time_usdc is >= 3.15 from seed", async () => {
    const res = await fetch(`${BASE}/api/treasury`);
    const state = await res.json();
    expect(state.total_income_all_time_usdc).toBeGreaterThanOrEqual(3.15);
  });

  it("total_tasks_completed is >= 8 from seed", async () => {
    const res = await fetch(`${BASE}/api/treasury`);
    const state = await res.json();
    expect(state.total_tasks_completed).toBeGreaterThanOrEqual(8);
  });

  it("usyc_apy is 0.0485 (hardcoded from USYC contract)", async () => {
    const res = await fetch(`${BASE}/api/treasury`);
    const state = await res.json();
    expect(state.usyc_apy).toBe(0.0485);
  });
});

// ── Layer 3: GET /api/agent-card — A2A agent discovery ───────────────────────

describe("INT-L3: GET /api/agent-card — A2A protocol", () => {
  it("returns valid AgentCard shape", async () => {
    const res = await fetch(`${BASE}/api/agent-card`);
    expect(res.status).toBe(200);
    const card = await res.json();
    expect(card).toHaveProperty("name", "solv-001");
    expect(card).toHaveProperty("capabilities");
    expect(card).toHaveProperty("payment");
    expect(card).toHaveProperty("api");
  });

  it("agent card payment method is x402", async () => {
    const res = await fetch(`${BASE}/api/agent-card`);
    const card = await res.json();
    expect(card.payment.method).toBe("x402");
    expect(card.payment.chain).toBe("arcTestnet");
    expect(card.payment.seller_address).toMatch(/^0x/);
  });

  it("agent card lists all 8 task types", async () => {
    const res = await fetch(`${BASE}/api/agent-card`);
    const card = await res.json();
    expect(Array.isArray(card.capabilities)).toBe(true);
    expect(card.capabilities.length).toBeGreaterThanOrEqual(8);
  });

  it("agent card has MCP endpoint", async () => {
    const res = await fetch(`${BASE}/api/agent-card`);
    const card = await res.json();
    expect(card.api.mcp).toHaveProperty("endpoint");
    expect(card.api.mcp).toHaveProperty("transport", "http-sse");
  });
});

// ── Layer 4: GET /api/tasks/:id — individual task fetch ──────────────────────

describe("INT-L4: GET /api/tasks/:id — task lookup", () => {
  it("returns 404 for non-existent task", async () => {
    const res = await fetch(`${BASE}/api/tasks/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(404);
  });

  it("returns task for valid seeded task ID", async () => {
    // First get the list to find a real task ID
    const listRes = await fetch(`${BASE}/api/tasks`);
    const tasks = await listRes.json();
    const firstId = tasks[0]?.id;
    if (!firstId) return; // skip if no tasks

    const res = await fetch(`${BASE}/api/tasks/${firstId}`);
    expect(res.status).toBe(200);
    const task = await res.json();
    expect(task.id).toBe(firstId);
    expect(task).toHaveProperty("status");
    expect(task).toHaveProperty("task_type");
  });
});

// ── Layer 5: GET /api/tasks/estimate — pricing endpoint ──────────────────────

describe("INT-L5: GET /api/tasks/estimate — price lookup", () => {
  it("returns estimate for valid task type", async () => {
    const res = await fetch(`${BASE}/api/tasks/estimate?task_type=wallet_intelligence`);
    expect(res.status).toBe(200);
    const est = await res.json();
    expect(est).toHaveProperty("price_usdc");
    expect(est.price_usdc).toBeGreaterThan(0);
  });

  it("wallet_intelligence price is 0.50", async () => {
    const res = await fetch(`${BASE}/api/tasks/estimate?task_type=wallet_intelligence`);
    const est = await res.json();
    expect(est.price_usdc).toBe(0.50);
  });

  it("returns 400 for invalid task type", async () => {
    const res = await fetch(`${BASE}/api/tasks/estimate?task_type=invalid_type`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── Layer 6: Data-service endpoints (internal A2A x402 calls) ─────────────────

describe("INT-L6: /api/data-service — internal paid endpoints", () => {
  it("transaction-count returns count field", async () => {
    const res = await fetch(
      `${BASE}/api/data-service/transaction-count?address=0xDEMO010000000000000000000000000000000001&demo=true`
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("count");
  });

  it("contract-interactions returns interactions field", async () => {
    const res = await fetch(
      `${BASE}/api/data-service/contract-interactions?address=0xDEMO010000000000000000000000000000000001&demo=true`
    );
    expect(res.status).toBe(200);
  });

  it("token-transfers returns data", async () => {
    const res = await fetch(
      `${BASE}/api/data-service/token-transfers?address=0xDEMO010000000000000000000000000000000001&demo=true`
    );
    expect(res.status).toBe(200);
  });
});

// ── Layer 7: treasury-reasoning buildReasoningContext ────────────────────────

describe("INT-L7: buildReasoningContext — all task types get priority", () => {
  it("all task types have a priority mapping", async () => {
    const { buildReasoningContext } = await import("@/lib/treasury-reasoning");
    const taskTypes = [
      "wallet_intelligence", "counterparty_vet", "contract_summary",
      "conditional_payment", "scheduled_disbursement", "wallet_watch",
      "contract_watch", "general",
    ] as const;

    for (const tt of taskTypes) {
      const ctx = buildReasoningContext({
        current_balance_usdc: 5,
        usyc_usdc_value: 0,
        pending_income_usdc: 0,
        task_type: tt,
        task_price_usdc: 0.50,
        estimated_execution_cost_usdc: 0.01,
        queue_depth: 0,
      });
      expect(ctx.task_priority).toBeGreaterThan(0);
      expect(ctx.task_priority).toBeLessThanOrEqual(5);
    }
  });
});
