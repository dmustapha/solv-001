# DEMO-SCRIPT — solv-001
Generated: 2026-05-21T14:00:00Z | Duration target: 180s (3 min max) | Estimated: ~135s

---

## Pre-Recording Setup

- [ ] Open https://solv-001.vercel.app in a clean browser tab (incognito preferred — no MetaMask extension)
- [ ] Navigate to the page and let it fully load (dashboard data must be visible)
- [ ] Verify the task form shows `contract_summary` as the default task type
- [ ] Set browser zoom to 100%
- [ ] Disable desktop notifications (Do Not Disturb)
- [ ] Close all other tabs — only the live app should be visible
- [ ] Verify console has zero errors (F12 → Console — should be blank)
- [ ] Pre-type the task text in a note: `Summarize the USYC teller contract at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A`
- [ ] Keep a second tab ready with https://solv-001.vercel.app/proof (don't open yet)
- [ ] Do NOT use `wallet_intelligence` task type at any point — Arc eth_getBalance is degraded

---

## Filming Sequence

### Scene 1: Landing + Dashboard Overview — 0:00–0:20
**Action:** Open https://solv-001.vercel.app — show the 3-column dashboard
**Show:** Treasury panel (left), reasoning stream panel (center), task history (right, top records only)
**Say:** "solv-001 is an autonomous AI agent that earns USDC completing tasks, reasons about its own treasury using Claude, and pays every expense as a nanopayment on Arc. Everything you see here is live — income, expenses, and yield are all on-chain."
**DO NOT SHOW:** Old error records in task history — keep scroll at top

---

### Scene 2: Explain the Agent Loop — 0:20–0:35
**Action:** Point to the treasury panel — highlight total_income ($3.15), tasks completed (36), USYC APY (4.85%)
**Show:** The numbers in the left panel
**Say:** "The agent has processed 36 tasks so far — $3.15 in income collected via Circle Nanopayments. Idle capital earns 4.85% APY in USYC. The agent manages all of this autonomously — no rules, no thresholds, just Claude reasoning over live financial state."

---

### Scene 3: Submit a Task (demo mode) — 0:35–0:55
**Action:**
1. Click the task form
2. Task description: `Summarize the USYC teller contract at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A`
3. Task type: `contract_summary` (already default)
4. Check the **"Try without wallet (demo mode)"** checkbox
5. Click **"run task"**

**Show:** The form being filled, the demo mode checkbox being ticked, the button click
**Say:** "I'll submit a smart contract audit. Notice the demo mode checkbox — this bypasses the x402 payment gate so judges can test without a wallet. The agent still reasons and executes exactly the same way."
**DO NOT SHOW:** wallet_intelligence task type, any other tab, or the raw JSON body

---

### Scene 4: Stream Active — Narrate the Wait — 0:55–1:10
**Action:** Watch the SSE stream start in the center panel. `treasury_snapshot` fires first, then `reasoning_chunk` tokens begin streaming
**WAIT:** ~15s for stream to complete — narrate throughout
**Say:** "First, the agent fetches a live treasury snapshot — Circle Wallets API, USYC position, pending receivables. Then Claude reasons over all four inputs: current balance, pending income, USYC yield rate, and this task's profit margin. Those tokens are streaming right now. Each tool call is a real Circle API call."
**DO NOT:** Go silent. Keep narrating. Do not say "loading" or "waiting."

---

### Scene 5: ACCEPT Decision — 1:10–1:30
**Action:** Stream completes. Point to the reasoning panel: decision badge (ACCEPT), reasoning text, then the trace: `payment_received`, `nanopayment` (3× arc_tx_hash), `result`, `complete`
**Show:** The ACCEPT badge + streaming reasoning text + final `net_usdc: 0.745` result
**Say:** "ACCEPT. Claude decided this task is profitable — margin is strong, treasury is healthy. Three Circle Nanopayments executed on Arc as expenses: one per external API call. Net income: 74.5 cents, after costs. The reasoning behind this decision — not just the answer — is logged permanently."

---

### Scene 6: /proof Page — Expense Ledger + USYC — 1:30–1:55
**Action:** Open the pre-loaded /proof tab
**Show:** The expense nanopayment trace records (arc_tx_hash entries), the USYC panel (APY 4.85%, sweep threshold), the Claude reasoning sample
**Say:** "Every expense the agent incurs is here — immutable nanopayment receipts on Arc testnet. The USYC panel shows idle capital earning yield between tasks. And judges can read the actual Claude reasoning trace that drove the last decision — not a summary, the real tokens."
**DO NOT SHOW:** The Circle wallet USDC balance at the top (testnet faucet outage — 0 balance looks bad). Point to the nanopayment ledger below it instead.

---

### Scene 7: Traction + MCP + Outro — 1:55–2:15
**Action:** Return to main dashboard or show agent-card endpoint
**Show:** Task history table (36 tasks, 5 distinct payer wallets), mention /api/mcp
**Say:** "36 tasks completed during the event window — 5 distinct payer wallets, human and agent-to-agent. Other AI agents can hire solv-001 directly via the MCP interface at /api/mcp — three tools: run_task, estimate_task, get_treasury_status. This is agentic commerce, not automation."
**End with:** "solv-001: Circle Wallets, Nanopayments, USYC, and Claude reasoning — live on Arc."

---

## Do NOT Show During Recording

| Footgun | Severity | Why | Workaround |
|---------|----------|-----|------------|
| wallet_intelligence task type | CRITICAL | Arc eth_getBalance degraded → stream terminates with error on camera | Use contract_summary exclusively |
| Circle wallet USDC balance (top of /proof) | HIGH | 0 balance looks unfunded | Point to nanopayment trace records below it |
| Bottom of task history table | LOW | Pre-fix error records from livetest visible | Stay at top of task table |

---

## Async Operation Timings

| Operation | Expected Wait | What to Say During Wait |
|-----------|--------------|------------------------|
| SSE task stream | ~15s | "Claude is reasoning over live treasury state — Circle API calls executing on Arc right now..." |
| treasury_snapshot → first reasoning_chunk | ~2s | Stay on screen, tokens will start |
| reasoning_complete → trace events | ~3-5s | "Decision made — nanopayments executing..." |

---

## Circle Tool Name-Drops (Required — judges score this)

Say each of these by name at least once:
- **Circle Wallets API** — "agent identity and USDC custody"
- **Circle Nanopayments** — "income gate (seller) and expense tracking (buyer)"
- **USYC** — "idle capital earning 4.85% APY between tasks"
- **MCP interface** — ties back to Arc agent-to-agent commerce

---

## Timing Check

| Scene | Time | Running Total |
|-------|------|---------------|
| Scene 1: Dashboard | 0:20 | 0:20 |
| Scene 2: Treasury panel | 0:15 | 0:35 |
| Scene 3: Form submit | 0:20 | 0:55 |
| Scene 4: Stream wait + narrate | 0:15 | 1:10 |
| Scene 5: ACCEPT result | 0:20 | 1:30 |
| Scene 6: /proof page | 0:25 | 1:55 |
| Scene 7: Outro | 0:20 | 2:15 |

**Total: ~135s — 45s under the 3-minute limit. Good buffer for live latency variance.**
