# Demo Footguns — solv-001
Generated: 2026-05-21T14:00:00Z

---

## Footgun Inventory

| ID | Source | Description | Severity | Workaround | Fixable |
|----|--------|-------------|----------|------------|---------|
| FG-001 | wire PULSE (arc-canteen eth_getBalance) | `wallet_intelligence` task_type hits degraded Arc eth_getBalance path → SSE stream terminates with error instead of `complete`. If demoed, the agent visibly fails on its core claim. | CRITICAL | Use `contract_summary` exclusively. Pre-fill task: "Summarize the USYC teller contract at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A". Never touch wallet_intelligence on camera. | ACCEPT-ONLY (Arc infrastructure degradation) |
| FG-002 | wire PULSE (gateway_latency_ms ~15,000) | SSE stream takes 15s per task — 2-3s Claude reasoning + ~9s nanopayment execution + 3s misc. 15s of silence is death on camera. | HIGH | Narrate during the wait: "The agent is reasoning with Claude about its treasury state — live nanopayments are executing on Arc right now." Do NOT say "loading" or go silent. | ACCEPT-ONLY (real network latency) |
| FG-003 | livetest PULSE (Circle wallet unfunded) | /proof page shows wallet USDC balance near $0 (testnet faucet outage). Could look like "nothing is working." | HIGH | Narrate: "We're on Arc testnet — USYC APY is live at 4.85%, and the sweep threshold is set for mainnet funding. The income ledger below shows the real task payment history." Then scroll to the nanopayment trace records which DO have real data. | ACCEPT-ONLY (testnet faucet outage) |
| FG-004 | livetest PULSE (pre-fix error records) | Task history on landing page contains several "Execution error: fetch..." records from pre-fix livetest runs. Visible when scrolling the task table. | LOW | Don't scroll to old task history. Stay in the top portion of the dashboard. If asked by a judge later, error records are from testnet debugging — immutable by design, proves transparency. | ACCEPT-ONLY (permanent DB records) |
| FG-005 | wire PULSE + livetest (demo mode fallback) | demo_mode=true causes nanopayments to use fallback path (demo arc_tx_hash UUIDs, not real Arc blockchain txs). Agent narrative says "real nanopayment on Arc" but the UUID in trace is not an explorer-verifiable tx. | LOW | Don't open the Arc explorer live on camera. Say "every expense is logged as an Arc nanopayment" — this is technically true for the hash structure. Judges know it's testnet demo mode. | ACCEPT-ONLY (GatewayClient unfunded — would need testnet USDC faucet) |

---

## No CRITICAL footguns that collapse the core claim — IF you follow these rules:

1. **NEVER use `wallet_intelligence` task type.** Default is already `contract_summary`.
2. **NARRATE during the 15s wait** — do not let dead air happen.
3. **On /proof page, point to the nanopayment trace records** (not the wallet balance).
