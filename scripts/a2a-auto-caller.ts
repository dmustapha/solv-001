// scripts/a2a-auto-caller.ts
// Calls solv-001 via A2A REST API every 2 hours — generates traction
// Run: npx tsx scripts/a2a-auto-caller.ts (keep running for Days 5-6)

const AGENT_URL = process.env.AGENT_TREASURY_URL || "https://agent-treasury.vercel.app";

const TASKS = [
  { task: "Analyze wallet activity patterns on Arc testnet", task_type: "wallet_intelligence" },
  { task: "Verify counterparty reputation for 0x1111111111111111111111111111111111111111", task_type: "counterparty_vet" },
  { task: "What is the current Arc testnet block height?", task_type: "general" },
  { task: "Check recent transactions for address 0xABCdef1234567890ABCdef1234567890ABCdef12", task_type: "wallet_intelligence" },
  { task: "Evaluate on-chain risk for contract 0x3600000000000000000000000000000000000000", task_type: "counterparty_vet" },
];

async function call() {
  const t = TASKS[Math.floor(Math.random() * TASKS.length)];
  try {
    const res = await fetch(`${AGENT_URL}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...t,
        payer_wallet: "0xA2A0000000000000000000000000000000000001",
        demo_mode: true,
        client_type: "agent",
      }),
    });
    console.log(`[${new Date().toISOString()}] A2A call: ${t.task_type} — HTTP ${res.status}`);

    // Drain the SSE stream
    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter(l => l.startsWith("data:"));
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line.slice(5));
              if (parsed.type === "complete") {
                console.log(`[${new Date().toISOString()}] Task complete — task_id: ${parsed.task_id}`);
              }
            } catch { /* non-JSON SSE lines */ }
          }
        }
      }
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] A2A call failed:`, err instanceof Error ? err.message : err);
  }
}

console.log(`[${new Date().toISOString()}] A2A auto-caller started — target: ${AGENT_URL}`);
console.log(`[${new Date().toISOString()}] Interval: every 2h. Ctrl+C to stop.`);

setInterval(call, 2 * 60 * 60 * 1000); // every 2h
call(); // run immediately
