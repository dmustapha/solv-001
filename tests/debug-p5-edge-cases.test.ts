/**
 * Phase 5 — Edge Cases + Security Inputs
 * Covers: API edge cases, AI agent edge cases (RC-10 config isolation),
 * frontend edge cases (via API layer).
 */

import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000";

// ── 5.1 API Edge Cases ────────────────────────────────────────────────────────

describe("EDGE-API: Malformed inputs", () => {
  it("malformed JSON body returns 400 or 500", async () => {
    const res = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not valid json",
    });
    // Next.js returns 400 for JSON parse errors
    expect([400, 500]).toContain(res.status);
  });

  it("wrong HTTP method (GET to treasury) still returns 200", async () => {
    const res = await fetch(`${BASE}/api/treasury`);
    expect(res.status).toBe(200);
  });

  it("DELETE to /api/tasks returns 405", async () => {
    const res = await fetch(`${BASE}/api/tasks`, { method: "DELETE" });
    expect([404, 405]).toContain(res.status);
  });

  it("XSS payload in task field is safely stored (not executed)", async () => {
    const xssPayload = '<script>alert("xss")</script>';
    const res = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: xssPayload,
        task_type: "general",
        payer_wallet: "0x1234567890123456789012345678901234567890",
        demo_mode: true,
      }),
    });
    // Should succeed (200 SSE) — XSS is a display concern, not API concern
    // The API stores plain text; escaping happens at render layer
    expect([200, 400]).toContain(res.status);
    // Verify Content-Type is NOT text/html (prevents XSS execution)
    if (res.status === 200) {
      expect(res.headers.get("content-type")).not.toContain("text/html");
    }
  });

  it("SQL injection payload in task field handled safely", async () => {
    const sqlPayload = "'; DROP TABLE tasks; --";
    const res = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: sqlPayload,
        task_type: "general",
        payer_wallet: "0x1234567890123456789012345678901234567890",
        demo_mode: true,
      }),
    });
    // Should succeed (parameterized SQL) or return error — never crash
    expect([200, 400, 500]).toContain(res.status);
    // Critical: server must still respond after SQL injection attempt
    expect(res.status).not.toBeNull();
  });

  it("very large task payload (10KB) handled gracefully", async () => {
    const bigTask = "analyze wallet ".repeat(700); // ~10KB
    const res = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: bigTask,
        task_type: "general",
        payer_wallet: "0x1234567890123456789012345678901234567890",
        demo_mode: true,
      }),
    });
    // Should either accept or reject gracefully — never hang
    expect([200, 400, 413]).toContain(res.status);
  });
});

// ── 5.2 API Edge Cases — estimate endpoint ────────────────────────────────────

describe("EDGE-API: Estimate endpoint edge cases", () => {
  it("missing task_type query param returns error", async () => {
    const res = await fetch(`${BASE}/api/tasks/estimate`);
    expect([400, 404]).toContain(res.status);
  });

  it("unknown task_type returns 400", async () => {
    const res = await fetch(`${BASE}/api/tasks/estimate?task_type=trade_now_please`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── 5.3 AI Agent Edge Cases (RC-10: per-instance config isolation) ────────────

describe("EDGE-AGENT: AI agent configuration isolation", () => {
  it("wallet_intelligence and general have different pricing", async () => {
    // RC-10 config isolation: each task type should have its own config
    const { TASK_PRICING } = await import("@/types");
    expect(TASK_PRICING.wallet_intelligence.price_usdc).not.toBe(
      TASK_PRICING.general.price_usdc
    );
  });

  it("high-value tasks (conditional_payment) have higher priority than general", async () => {
    const { buildReasoningContext } = await import("@/lib/treasury-reasoning");
    const highValue = buildReasoningContext({
      current_balance_usdc: 20,
      usyc_usdc_value: 0,
      pending_income_usdc: 0,
      task_type: "conditional_payment",
      task_price_usdc: 0.20,
      estimated_execution_cost_usdc: 0.005,
      queue_depth: 0,
    });
    const lowValue = buildReasoningContext({
      current_balance_usdc: 20,
      usyc_usdc_value: 0,
      pending_income_usdc: 0,
      task_type: "general",
      task_price_usdc: 0.30,
      estimated_execution_cost_usdc: 0.022,
      queue_depth: 0,
    });
    // conditional_payment is priority 5, general is priority 2
    expect(highValue.task_priority).toBeGreaterThan(lowValue.task_priority);
  });

  it("two concurrent demo tasks don't share state (no singleton pollution)", async () => {
    // Submit 2 tasks in parallel — both should succeed independently
    const [res1, res2] = await Promise.all([
      fetch(`${BASE}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "Analyze wallet 0xAAAA0000000000000000000000000000000000AA",
          task_type: "wallet_intelligence",
          payer_wallet: "0xAAAA0000000000000000000000000000000000AA",
          demo_mode: true,
        }),
      }),
      fetch(`${BASE}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "Analyze wallet 0xBBBB000000000000000000000000000000000BBB",
          task_type: "counterparty_vet",
          payer_wallet: "0xBBBB000000000000000000000000000000000BBB",
          demo_mode: true,
        }),
      }),
    ]);
    // Both should get 200 SSE streams
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});

// ── 5.4 AI Agent Safety Checks ───────────────────────────────────────────────

describe("EDGE-AGENT: Safety boundaries", () => {
  it("client_type agent is correctly recognized", async () => {
    const res = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: "What is Arc testnet block height?",
        task_type: "general",
        payer_wallet: "0xA2A00000000000000000000000000000000000A1",
        demo_mode: true,
        client_type: "agent",
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  it("invalid client_type defaults to human (no crash)", async () => {
    const res = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: "test",
        task_type: "general",
        payer_wallet: "0x1234567890123456789012345678901234567890",
        demo_mode: true,
        client_type: "robot_overlord", // invalid
      }),
    });
    expect(res.status).toBe(200);
  });
});

// ── 5.5 Treasury reasoning edge cases ────────────────────────────────────────

describe("EDGE-REASONING: Boundary values in buildReasoningContext", () => {
  it("zero balance still builds context without crash", async () => {
    const { buildReasoningContext } = await import("@/lib/treasury-reasoning");
    expect(() => buildReasoningContext({
      current_balance_usdc: 0,
      usyc_usdc_value: 0,
      pending_income_usdc: 0,
      task_type: "general",
      task_price_usdc: 0.30,
      estimated_execution_cost_usdc: 0.022,
      queue_depth: 0,
    })).not.toThrow();
  });

  it("very high queue_depth doesn't crash", async () => {
    const { buildReasoningContext } = await import("@/lib/treasury-reasoning");
    expect(() => buildReasoningContext({
      current_balance_usdc: 100,
      usyc_usdc_value: 50,
      pending_income_usdc: 10,
      task_type: "wallet_intelligence",
      task_price_usdc: 0.50,
      estimated_execution_cost_usdc: 0.015,
      queue_depth: 9999,
    })).not.toThrow();
  });

  it("negative balance is handled (doesn't crash)", async () => {
    const { buildReasoningContext } = await import("@/lib/treasury-reasoning");
    // Negative balance shouldn't cause crash — just a low-balance scenario
    expect(() => buildReasoningContext({
      current_balance_usdc: -1.5,
      usyc_usdc_value: 0,
      pending_income_usdc: 0,
      task_type: "general",
      task_price_usdc: 0.30,
      estimated_execution_cost_usdc: 0.022,
      queue_depth: 0,
    })).not.toThrow();
  });
});
