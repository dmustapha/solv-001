/**
 * Phase 4 — E2E Tests
 * Full task flow: POST /api/tasks (demo_mode) → SSE stream drain → complete event
 * Tier 2: curl-equivalent fetch against running dev server
 */

import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000";

// ── E2E Flow 1: Full SSE drain for demo task ──────────────────────────────────

describe("E2E-F1: Full SSE stream — demo task completes", () => {
  it("contract_summary demo task produces treasury_snapshot + complete events", async () => {
    const res = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: "Summarize the USYC teller contract at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A",
        task_type: "contract_summary",
        payer_wallet: "0xDEMO010000000000000000000000000000000001",
        demo_mode: true,
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    // Drain SSE events (max 60 chunks)
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const events: Array<{ type: string; data: unknown }> = [];
    let attempts = 0;

    while (attempts < 60) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        if (part.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(part.slice(6));
            events.push(parsed);
          } catch { /* skip malformed */ }
        }
      }
      // Stop after seeing a terminal event
      const lastType = events[events.length - 1]?.type;
      if (lastType === "complete" || lastType === "deferred" || lastType === "rejected" || lastType === "error") break;
      attempts++;
    }
    reader.cancel();

    expect(events.length).toBeGreaterThan(0);

    // First event must be treasury_snapshot
    expect(events[0].type).toBe("treasury_snapshot");
    expect((events[0].data as Record<string, unknown>)).toHaveProperty("total_tasks_completed");

    // Must have a reasoning_complete event
    const reasoningDone = events.find(e => e.type === "reasoning_complete");
    expect(reasoningDone).toBeDefined();

    // Must end with terminal event
    const terminal = events.find(e =>
      e.type === "complete" || e.type === "deferred" || e.type === "rejected"
    );
    expect(terminal).toBeDefined();
  }, 90000);

  it("general demo task ends with a terminal event", async () => {
    const res = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: "What is the Arc testnet chain ID?",
        task_type: "general",
        payer_wallet: "0xDEMO020000000000000000000000000000000002",
        demo_mode: true,
      }),
    });

    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const eventTypes: string[] = [];
    let attempts = 0;

    while (attempts < 60) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        if (part.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(part.slice(6)) as { type: string };
            eventTypes.push(parsed.type);
          } catch { /* skip */ }
        }
      }
      const last = eventTypes[eventTypes.length - 1];
      if (last === "complete" || last === "deferred" || last === "rejected") break;
      attempts++;
    }
    reader.cancel();

    expect(eventTypes[0]).toBe("treasury_snapshot");
    expect(eventTypes).toContain("reasoning_complete");
    const hasTerminal = eventTypes.some(t => ["complete", "deferred", "rejected"].includes(t));
    expect(hasTerminal).toBe(true);
  }, 90000);
});

// ── E2E Flow 2: 402 gate then demo bypass ────────────────────────────────────

describe("E2E-F2: Payment gate → demo bypass flow", () => {
  it("real task without payment returns 402 with payment spec", async () => {
    const res = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: "Analyze wallet 0x9999000000000000000000000000000000000001",
        task_type: "counterparty_vet",
        payer_wallet: "0x9999000000000000000000000000000000000001",
      }),
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.payment.method).toBe("x402");
    expect(body.payment.price_usdc).toBeGreaterThan(0);
  });

  it("same task with demo_mode returns SSE stream", async () => {
    const res = await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: "Analyze wallet 0x9999000000000000000000000000000000000001",
        task_type: "counterparty_vet",
        payer_wallet: "0x9999000000000000000000000000000000000001",
        demo_mode: true,
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    // Read just the first event and cancel
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let firstEvent: { type: string } | null = null;
    for (let i = 0; i < 10 && !firstEvent; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        if (part.startsWith("data: ")) {
          firstEvent = JSON.parse(part.slice(6));
          break;
        }
      }
    }
    reader.cancel();
    expect(firstEvent?.type).toBe("treasury_snapshot");
  }, 60000);
});

// ── E2E Flow 3: data-service demo mode ───────────────────────────────────────

describe("E2E-F3: data-service demo endpoints return stub data", () => {
  it("transaction-count in demo mode returns count", async () => {
    const res = await fetch(
      `${BASE}/api/data-service/transaction-count?address=0xDEMO010000000000000000000000000000000001&demo=true`
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("count");
    expect(typeof data.count).toBe("number");
  });

  it("contract-interactions in demo mode returns interaction_count", async () => {
    const res = await fetch(
      `${BASE}/api/data-service/contract-interactions?address=0xDEMO010000000000000000000000000000000001&demo=true`
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("interaction_count");
  });

  it("token-transfers in demo mode returns usdc_balance", async () => {
    const res = await fetch(
      `${BASE}/api/data-service/token-transfers?address=0xDEMO010000000000000000000000000000000001&demo=true`
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("usdc_balance");
  });
});
