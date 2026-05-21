// scripts/a2a-auto-caller.ts
// Calls solv-001 via A2A REST API every 2 hours — generates traction
// Run: npx tsx scripts/a2a-auto-caller.ts (keep running for Days 5-6)

const AGENT_URL = process.env.AGENT_TREASURY_URL || "https://solv-001.vercel.app";

const TASKS = [
  { task: "Summarize the USYC teller contract at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A", task_type: "contract_summary" },
  { task: "Summarize the USDC token contract at 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", task_type: "contract_summary" },
  { task: "Research current DeFi stablecoin yield strategies for idle treasury capital", task_type: "general" },
  { task: "Summarize the Circle CCTP v2 bridge contract at 0xBd3fa81B58Ba92a82136038B25aDec7066af3155", task_type: "contract_summary" },
  { task: "Research best practices for AI agent treasury management on Arc testnet", task_type: "general" },
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
                console.log(`[${new Date().toISOString()}] Task complete — task_id: ${parsed.data?.task_id}`);
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
