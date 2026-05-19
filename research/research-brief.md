# Agora Agents Hackathon — Research Brief
> Synthesized from hackathon brief (agora-canteen.md). Intel phase skipped — brief is comprehensive.
> Date: 2026-05-18

---

## Event Summary

| Field | Detail |
|-------|--------|
| Hackathon | Agora Agents Hackathon |
| Hosts | Canteen × Circle (NYSE: CRCL) × Arc |
| Prize | $50,000 total ($10K / $7.5K / $5K grand prizes + standouts) |
| Deadline | May 25, 2026 |
| Settlement | Arc testnet (USDC-native L1, ~$0.01/tx, sub-second finality) |
| Theme | "Where AI agents make markets" |

---

## Judging Criteria (weighted)

| Criterion | Weight | What Wins |
|-----------|--------|-----------|
| Agentic Sophistication | 30% | AI makes genuine financial decisions, not summaries for humans |
| Traction | 30% | Real users, real transactions during the 2-week window |
| Circle Tool Usage | 20% | Motivated use of Wallets, CCTP, Gateway, Nanopayments, USYC |
| Innovation | 20% | Novel approach, emergent behavior, new territory |

**Critical quote:** "Great founders ship and get users in two weeks."

---

## Competitive Landscape

### Past Arc Hackathon Winners (cross-event patterns)

**ETHGlobal HackMoney 2026 — Arc Track (155+ teams)**
- `arctan(x)` — Institutional FX DEX, multichain margins → Won: deep Arc integration, real problem
- `Text-to-Chain` — SMS-native DeFi, phones as wallets → Won: invisible blockchain UX, real users
- `ArcFlow` — Self-paying treasury, idle payroll → yield before salary → Won: real enterprise workflow
- `Versus` — AI agents earning micropayments, trading creator tokens → Won: agentic + commerce + micropayments

**Agentic Commerce on Arc (1,200+ devs)**
- `RSoft Agentic Bank` — future of banking is agent-led
- `OmniAgentPay` — payment infra specifically for AI agents
- `NewsFacts` — leveraged sub-second finality for real-time autonomous transactions

**USDC OpenClaw Hackathon (200+ submissions)**
- `ClawRouter by BlockRunAI` — each OpenClaw agent gets its own USDC wallet, purchases LLM inference directly

### Saturation Analysis

**RFB 01 (Perp Trading):** HIGH saturation — many teams build perp bots. Traction hardest here (need real AUM/traders).
**RFB 02 (Prediction Market Trader):** MEDIUM — execution is mature (Python frameworks, Polymarket API), monetization via builder codes is underused.
**RFB 03 (Prediction Market Verticals):** LOW-MEDIUM — emerging markets vertical (translation, non-English) is genuinely open.
**RFB 04 (Portfolio Manager):** MEDIUM-HIGH — overdone "AI rebalances portfolio" products, but Hyperliquid whale migration angle is novel.
**RFB 05 (Arbitrage):** MEDIUM — technically hard, traction hardest (no users, just bots).
**RFB 06 (Social Trading):** LOW — slash-bonded leaderboard + Trading-R1 reasoning traces are genuinely novel.

---

## Research Insights (Canteen-published)

### 01 — Trading-R1: Reasoning Traces as Product
- Full reasoning traces pinnable to IPFS/Irys, hash on Arc for ~$0.01 — traces become copyable product
- New market type: bet on which reasoning patterns converge to profit
- Paper: arxiv.org/abs/2509.11420

### 02 — Builder Codes as Monetization (Polymarket V2)
- Agent recommends a bet → takes a cut of fills via builder code, no custody needed
- Wrap any agent as V2 builder, earn USDC per fill
- Per-pick economics viable at Arc's ~$0.01 fees

### 03 — NFI Commit Feed as Rugpull Oracle
- NostalgiaForInfinity blacklist: BLUM, MONPRO, UXLINK, IZI, YZY, BSY, WAT, RAIN
- Parse commits → mint as signed Arc event → seed prediction market same block
- Sub-second finality is the moat: market opens before price moves

### 04 — Translation as Alpha (emerging markets)
- Polymarket English-only because translating non-English news to PM question is bottleneck
- Mechanism: market where agents bid USDC for right to translate, earn builder fees per fill

### 05 — Hyperliquid Whale Migration Index
- Top HL whales migrate across forks (Aster, Polynomial, etc.)
- Arc-native ERC-20 auto-rebalancing exposure based on top-trader migration
- Gateway cross-chain moves at cents vs dollars on other chains

### 06 — Slash-Bonded Leaderboard Copy-Trading
- USDC performance bond on Arc slashes proportionally if leader falls below rank threshold
- Sub-second slashing makes retail-size economics viable (other chains' gas erodes bond)
- Empirical decay function → smart contract slash schedule

---

## Circle Developer Stack (available tools)

| Tool | Relevance |
|------|-----------|
| CCTP | Cross-chain USDC — arbitrage, multi-venue collateral |
| Gateway | Unified balance + <500ms cross-chain — single-balance agents |
| Nanopayments | Sub-cent USDC payments via batched settlement — high-frequency agentic commerce |
| Wallets | Embedded USDC wallets for autonomous agents |
| Contracts | Position management, liquidation protection, slash logic |
| Paymaster | USDC tx fees — no volatile gas sourcing |
| USYC | Tokenized money market — park idle capital in yield |
| EURC | Multi-currency markets, FX-aware strategies |
| App Kit | Drop-in Bridge, Swap, Send components |

**Motivated usage requirement:** Judges want USYC earning yield during dead periods, Nanopayments solving a real cost problem, Gateway used because it's the fastest — not just mentioned.

---

## Winning Patterns (applicable to this hackathon)

1. **Invisible Blockchain** — Email onboarding > wallet connect. Users see product, not gas.
2. **Traditional Finance Workflows** — Copy existing behavior (payroll, copy-trading) but better with stablecoins + agents.
3. **AI That Actually Decides** — AI executes, not advises. Delta = does the agent act or summarize?
4. **Cross-Chain as Default** — CCTP/Gateway as plumbing, not the feature.
5. **Traction During Event Window** — Real users by day 10, not hour 47.
6. **Deep Circle Tool Integration** — Motivated use, not name-drops.

---

## Anti-Patterns (what loses)

- AI-flavored automation that surfaces data for humans to act on
- Demo-only, no live deployed link, no traction
- Novel financial primitives with no existing user demand
- Shallow Circle integration (just USDC transfer, nothing else)
- Pure DeFi without agentic layer
- Video over 3 minutes

---

## Tooling Note

`arc-canteen` CLI is installed and confirmed working. All Arc testnet interaction must use it.
- RPC access to Canteen's hosted Arc testnet
- Scaffolding, USDC faucet, contract deployment
- Docs: https://arc-node.thecanteenapp.com/
