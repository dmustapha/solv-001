# WINNER-BRIEF — Agora Agents Hackathon
**Idea:** AgentTreasury — Self-Funding Autonomous Agent Treasury
**Track:** Circle Tool Integration ($20K)
**Warroom Version:** V3 (updated post-warroom)
**Date:** 2026-05-19

---

## Chosen Idea

An autonomous AI agent that accepts tasks in plain text, executes them using on-chain and off-chain tools, charges for its work in USDC, pays its own operating costs via Nanopayments, and reasons about its own financial state before deciding which tasks to run. The Circle stack is the financial operating system: Wallets for identity and USDC custody, Nanopayments for sub-cent API expenses, USYC for yield on idle capital, and Paymaster for unified gas accounting.

The agent is callable by humans via a web dashboard and by other AI agents via a REST API + MCP server. Every income event, expense, and treasury decision is auditable on Arc.

## Problem Statement

Agent treasuries exist — ElizaOS, Coinbase Agentic Wallets, and x402-based agents can all hold and spend crypto. But every current implementation runs on rules: accept all tasks above threshold X, rebalance when balance drops below Y. No agent uses an LLM to reason about its own financial decisions in real time.

AgentTreasury is the first to combine Circle's full 4-tool stack — Wallets, Nanopayments, USYC, and Paymaster — with Claude reasoning over live financial state, deployed natively on Arc. The decisions are explained, not just executed.

## Task Types

The agent accepts plain-text requests and routes them to the appropriate execution path:

**On-chain intelligence** (requires chain access + Circle Wallet identity):
- Wallet reputation scoring — "Is 0xABCD trustworthy?" — pulls transaction history, contract interactions, behavioral patterns from Arc
- Counterparty vetting — "Should I send 500 USDC to this address?" — structured risk report with score
- Transaction pattern analysis — behavioral profiling from on-chain activity
- Smart contract plain-English summary — "what does this contract do?"

**On-chain execution** (agent is the signing authority):
- Conditional payment — "Pay wallet X 50 USDC when condition Y is met on-chain" — agent holds escrow in its Circle Wallet, monitors chain, releases on condition
- Scheduled disbursements — recurring USDC transfers from the agent's wallet

**Monitoring** (ongoing, recurring Nanopayments):
- Wallet watch — alert when address moves above threshold
- Contract event watching — notify when specific event fires

**General tasks** (off-chain, via external APIs paid with Nanopayments):
- Web research, data enrichment, analysis — any plain-text task Claude can execute

## Why It Won

| Criterion | Weight | Score | Rationale |
|-----------|:------:|:-----:|-----------|
| Agentic Sophistication | 30% | 8/10 | Multi-factor financial state reasoning (balance + pending tasks + USYC yield rate + task priority) is a genuine decision loop — the AI reasons about its own operational continuity before deciding which tasks to run |
| Traction | 30% | 7/10 | Demo agent runs 12 days generating authentic expense Nanopayments; income side requires 5 external user recruits; A2A callers from other hackathon agents also count toward the 5 income events |
| Circle Tool Usage | 20% | 9/10 | 4 Circle tools each serving distinct treasury functions: Wallets (identity/custody), Nanopayments (expenses), USYC (savings/yield), Paymaster (unified gas accounting). Deepest Circle integration across three warroom rounds. |
| Innovation | 20% | 8/10 | Agent treasuries exist but every current implementation is rule-based. First to combine Circle's full stack with LLM reasoning over financial state on Arc. The judges built the stack — they will recognise whether it's real or decorative. |
| **Weighted Average** | | **8.10/10** | |
| YC Problem Quality | +0-6 | 5/6 | Real problem (agent developers manually fund wallets), growing affected population (every agent developer), no established solution pattern |
| Competition Bonus | | +0.5 | First non-trivial agent on Circle/Arc stack; broader agent treasury category has competitors but this specific stack + reasoning combination does not |

**FINAL Score: 9.22 / 12.0** (formula unchanged from warroom)

Formula breakdown:
- Norm_Vote_Points: (10/12) × 10 = 8.33 → × 0.30 = 2.50
- Weighted_Criteria_Avg: 8.10 → × 0.50 = 4.05
- Norm_YC_PQ: (5/6) × 10 = 8.33 → × 0.20 = 1.67
- Bonus: +1.0
- **FINAL = 2.50 + 4.05 + 1.67 + 1.0 = 9.22**

## Interface Design

### Human users (web dashboard)
- Plain-text input field — type the task in natural language
- Wallet connection — MetaMask or any Arc-compatible wallet
- USDC payment approval — site generates a payment request; task registers on payment confirmation
- Result displayed in dashboard; stored in task history

### Other AI agents (A2A)
- Agent Card at `/.well-known/agent.json` — machine-readable capability manifest listing task types, pricing, input/output schemas, and the agent's wallet address
- REST API: `POST /tasks` — accepts `{ task, payer_wallet, task_type, callback_url }`
- MCP server (HTTP/SSE transport) — any Claude-powered agent can discover and call AgentTreasury as a native tool without custom integration
- Payment gate: agent verifies incoming USDC from `payer_wallet` on Arc before executing
- Result delivered to `callback_url` for async tasks (monitoring, conditional payments)

## Demo Architecture

Every task runs through a visible execution trace in the dashboard:

```
Task received: "Vet wallet 0xABCD"
─────────────────────────────────────────────
→ Payment received: +0.50 USDC        [Arc tx: 0x1a2b...]
→ Queried transaction history          [Nanopayment: $0.005, tx: 0x3c4d...]
→ Queried contract interactions        [Nanopayment: $0.005, tx: 0x5e6f...]
→ Queried token transfers              [Nanopayment: $0.005, tx: 0x7a8b...]
→ Reasoning...                         [streaming]
→ Report delivered                     ✓
─────────────────────────────────────────────
Revenue: +$0.50  |  Costs: -$0.015  |  Net: +$0.485
```

Each Nanopayment line links to the Arc transaction — proof of work, not just proof of result.

**Three-panel dashboard:**
- Left: Live treasury state — balance, USYC position, APY, today's net earnings (updates after every task)
- Centre: Active task execution trace + streaming Claude reasoning output
- Right: Full task history — income and expense per row, Arc links, client type (human vs. agent)

**Claude reasoning output format** — professional, decisive, one sentence per decision:
> "Balance is $1.50. Task 1 earns $1.00 against a $0.40 execution cost — the margin is strong, executing now. Task 2 earns $0.50 against the same cost; the margin is too thin at current balance, deferring. Savings position remains untouched."

## Top Risks + Mitigations

| # | Risk | Severity | Mitigation |
|---|------|:--------:|------------|
| 1 | Income side empty — no external task payments | CRITICAL | Day 0: recruit 5 users via Telegram/Discord AND deploy a second agent on Arc that calls AgentTreasury via A2A — agent-to-agent payments count toward the 5 income events |
| 2 | Treasury reasoning is a 3-line if-else, not multi-factor | CRITICAL | Implement Claude structured reasoning with 4+ input variables (balance, pending income, USYC yield, task priority). Reasoning output streams visibly in demo. |
| 3 | Arc testnet wallet data too sparse for compelling intelligence demo | HIGH | Pre-seed 5-10 test wallets with realistic transaction histories. Keep a seeded demo wallet address for the demo. |
| 4 | USYC yield invisible on small demo balance | HIGH | Seed demo agent with $50 USDC. USYC yield on $50 over 12 days = ~$0.008 — visible. Show APY prominently. |
| 5 | arc-canteen CLI unfamiliar — integration delays Day 0 | HIGH | Day 0 mandatory: run first arc-canteen transaction before any code. No architecture decisions until CLI confirmed working. |
| 6 | MCP server + payment gate adds build complexity | MEDIUM | MCP scaffolding is ~100 lines with the official SDK. Share execution logic with REST API — same functions, different interface. Implement REST first, MCP wraps it. |

## Non-Negotiables (Must Be In Build)

- Circle Wallets API: agent owns its own keys and USDC balance (not a mock wallet or dev key)
- Circle Nanopayments SDK: every external API call = 1 real Nanopayment on Arc testnet (not mocked)
- USYC SDK: idle balance actively earning yield, APY rate visible in dashboard
- arc-canteen CLI: ALL Arc testnet interactions via arc-canteen — mandatory per hackathon brief §17
- Multi-factor treasury reasoning: balance + pending income + USYC rate + task priority → Claude decides which tasks to run
- External income events: minimum 5 task payments from 5 distinct external wallets (humans or agents)
- Execution trace: every task shows step-by-step trace with Arc transaction links as proof of work
- Agent Card at `/.well-known/agent.json`: machine-readable capability manifest for A2A discovery
- MCP server: HTTP/SSE transport so any Claude-powered agent can call AgentTreasury as a native tool
- Plain-text task intake: users and agents submit tasks in natural language, agent parses and routes
- Streaming reasoning output: Claude reasoning streams character-by-character in dashboard centre panel
- Arc explorer segment in demo: scroll through 12-day transaction history showing income + Nanopayment expenses

## Explicit Out-of-Scope

- Mainnet deployment — testnet only per hackathon rules
- Complex financial instruments beyond USYC — no yield strategies, no leverage
- Enterprise treasury dashboard — clean React dashboard with three panels is sufficient
- On-chain storage of reasoning text — reasoning visible in UI only, not stored on-chain
- Paymaster deep integration — basic implementation sufficient; don't spend build time here
- Multi-agent orchestration (AgentTreasury coordinating other agents) — it ACCEPTS tasks from other agents, it does not coordinate them

## Minority Dissent (Unresolved Concerns)

**TRAC dissent:** AlphaStream (FINAL 8.43) is superior on Traction. AgentTreasury's Traction at 7/10 requires active distribution effort that AlphaStream's 9/10 does not. If recruitment fails AND A2A callers don't materialise, the income side is hollow.

**Why it was not decisive:** Formula margin 0.79 (9.22 vs 8.43) — above the 0.5 noise threshold. AS + Innovation (50% combined weight) favour AgentTreasury. A2A pathway partially mitigates the recruitment risk. AlphaStream remains the correct fallback if income side is empty after Day 3.

---

*V2 winner (ReasonTrace, 8.87) excluded — Traction 6/10 structural weakness on 30%-weighted criterion.*
*Runner-up: AlphaStream (FINAL 8.43) — fallback trigger: income side empty after Day 3.*
*Second runner-up: MilestoneGuard (FINAL 6.77) — final fallback; targets 59M freelancers, two on-chain events per milestone.*
