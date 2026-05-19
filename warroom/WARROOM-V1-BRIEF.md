# WAR ROOM V1 — AGORA AGENTS HACKATHON DELIBERATION BRIEF
**Date:** 2026-05-18
**Objective:** Pick THE ONE idea for the Agora Agents Hackathon (Canteen × Circle × Arc) that is BOTH the most winnable AND solves a significant real problem.
**Deadline:** 2026-05-25T23:59:00Z (7 days from today)

---

## NON-NEGOTIABLE RULES

### CRITICAL [C] — Violation = Idea Eliminated
1. [C] Time NOT a constraint. Claude Code = 10x dev speed. Do NOT penalize ideas for complexity.
2. [C] Uniqueness is non-negotiable. Zero confirmed competitors in the exact space strongly preferred.
3. [C] "Does this help real humans?" test. Every idea must name specific people whose lives improve.
4. [C] Cumulative corrections carry forward. Nothing is silently dropped.
5. [C] Must solve a SIGNIFICANT problem. Builder must believe in it without a prize.
6. [C] Must serve actual target users who exist TODAY. No hypothetical future users.
7. [C] arc-canteen CLI MUST be used for all Arc testnet interaction. Per hackathon brief Section 0 — non-negotiable for any winning idea.
8. [C] Traction must be REAL during the 2-week event window. Real users, real transactions. Not projected.

### IMPORTANT [I] — Score Penalty if Violated
9. [I] Everything is devnet/testnet. Mocks are fine.
10. [I] Read ALL research data. Discord intel, winning patterns, judge preferences — use everything.
11. [I] Take your time, be extensive. Proposals must be 200-400 words with research citations.
12. [I] Focused product, BROAD problem. Niche MVP is fine; niche audience is NOT.
13. [I] Winning AND real impact are not mutually exclusive.
14. [I] Demo must feel like the real product. Pre-seed with realistic data.
15. [I] Must use at least 3 Circle tools with motivated integration — not just USDC transfers.
16. [I] Sub-second finality and ~$0.01/tx must be the core REASON Arc is used.

### ADVISORY [A]
17. [A] Fresh ideas allowed. Not limited to the predefined list.
18. [A] Reframing is on the table.
19. [A] AI/Agents are APPROPRIATE here — Agentic Sophistication is 30% of judging.
20. [A] Cross-chain capability is valued — CCTP/Gateway is core Circle stack.
21. [A] Sponsor bounty stacking: no separate bounties, all prize pool is main competition.

---

## HACKATHON FACTS

| Field | Detail |
|-------|--------|
| Hackathon | Agora Agents Hackathon |
| Hosts | Canteen × Circle (NYSE: CRCL) × Arc |
| Deadline | May 25, 2026 (7 days remaining) |
| Prize | $50K total — 1st: $10K, 2nd: $7.5K×2, 3rd: $5K×3, Standouts: $650-750×10-12 |
| Settlement | Arc testnet — USDC-native, ~$0.01/tx, sub-second finality |
| Submission | Public GitHub + recorded video (max 3 min) + deployed link (strongly encouraged) |
| Format | Online async — no live demo day. Judges review asynchronously. |

## JUDGING CRITERIA (4 criteria, weights)

| Criterion | Weight | What Judges Look For |
|-----------|--------|---------------------|
| **Agentic Sophistication** | 30% | AI makes genuine financial decisions vs. just automating APIs. Full autonomy > meaningful agency > AI-flavored automation. |
| **Traction** | 30% | Real users, real transactions, real volume DURING the event window. |
| **Circle Tool Usage** | 20% | Creative + motivated use of Wallets, CCTP, Gateway, Nanopayments, USYC, Contracts, App Kit. |
| **Innovation** | 20% | Novel approaches, emergent behavior, research insight. New territory > polished re-runs. |

**Scoring for deliberation (1-10 per criterion, calibrated to scoring-anchors.md):**
- Agentic Sophistication: 1=pure automation, 5=rule-based triggers, 8=AI makes real tradeoffs, 10=fully autonomous with emergent behavior
- Traction: 1=demo only, 5=friends+family, 8=real community users with tx volume, 10=hundreds of users viral growth
- Circle Tool Usage: 1=USDC transfer only, 5=2 tools functional, 8=3+ tools motivated+deep, 10=Circle tools ARE the story
- Innovation: 1=clone, 5=existing concept new domain, 8=genuinely new angle, 10=category-creating

## CONFIRMED JUDGES
Background from brief: Stellar, Coinbase, Arc/Circle directly, Protocol Labs — operators who have shipped payments infrastructure and run companies. They will read your repo like operators, not spectators. No live demo. Asynchronous review.

**What this means:** "Would a Coinbase engineer be impressed by the technical depth?" and "Would a Circle PM care about this problem?" are the right calibration questions.

---

## ARC TECHNICAL CONTEXT

**What Arc Is:** Circle's purpose-built L1 for stablecoin finance. Not general-purpose. Designed for USDC/EURC settlement.

**The critical numbers:**
- ~$0.01/tx → agents can act at high frequency without fee math eating returns
- Sub-second deterministic finality → agents can react to market events in real time
- No reorgs → agents don't need to handle confirmation uncertainty
- USDC-native → no volatile gas token sourcing (simplifies agent budgeting)

**Circle Developer Stack:**
| Tool | What It Enables |
|------|----------------|
| CCTP | Programmatic USDC between chains |
| Gateway | Unified USDC balance across chains, <500ms cross-chain transfers |
| Nanopayments | Gas-free USDC payments down to $0.000001 via offchain auth + batched settlement |
| Wallets | Embedded USDC wallets, automated key management |
| Contracts | Smart contracts for position management, slash logic, escrow |
| Paymaster | USDC tx fees — no volatile gas token |
| USYC | Tokenized money market fund — yield on idle USDC |
| EURC | Multi-currency markets |
| App Kit | Drop-in Bridge/Swap/Send/Unified Balance components |

---

## KNOWN COMPETITORS (Hackathon-Specific)
No competitor data from Discord (not yet in Discord). Pattern from research:
- Perp trading bots: HIGH competitor density in DeFi hackathons
- Portfolio managers: MEDIUM density — "AI rebalancing" is common
- Market makers: ZERO confirmed competitors — officially noted gap (brief Section 10)
- Prediction market verticals (rugpull oracle, translation): ZERO confirmed competitors in this specific niche
- Slash-bonded copy-trading: ZERO confirmed competitors
- Whale migration index: ZERO confirmed competitors

**Category crowding estimate:**
| Category | Estimated Competition | Risk |
|----------|----------------------|------|
| Perp trading bots | HIGH (5-10 teams likely) | HIGH |
| Portfolio managers | MEDIUM (3-5 teams) | MEDIUM |
| Prediction market trader (basic) | MEDIUM (2-4 teams) | MEDIUM |
| Market maker (V2-aware) | ZERO confirmed | LOW |
| Rugpull oracle PM | ZERO confirmed | LOW |
| Slash-bonded copy trading | ZERO confirmed | LOW |
| Whale migration index | ZERO confirmed | LOW |

---

## PAST WINNER PATTERNS (What Wins Here)

From 3 Arc hackathons analyzed:

1. **Invisible Blockchain** — Email onboarding > wallet connect. Winners abstract all complexity.
2. **Traditional Finance Workflows** — Payroll, escrow, copy-trading. Don't invent new primitives.
3. **AI That Actually Decides** — 97% had AI. Winners had AI EXECUTING, not summarizing for humans.
4. **Cross-Chain as Default** — CCTP/Gateway as plumbing, not the feature.
5. **Traction During Event Window** — Real users by day 10, not hour 47.
6. **Deep Circle Tool Integration** — MOTIVATED use: Gateway used because it's fastest, USYC used because yield on idle capital.

**Key judge quote:** "Great founders ship and get users in two weeks."
**Key judge quote:** "They don't care about blockchain. They just want [thing] without [friction]."

**Losing patterns:**
- AI-flavored automation that doesn't make decisions
- Demo-only, no deployed link, no traction
- Novel financial primitives with no existing user demand
- Shallow Circle integration

---

## BUILDER PROFILE

- **Name:** Damilola Mustapha
- **Speed:** Claude Code-enabled → 10x build speed
- **Past projects:** AgentMesh (agent mesh network), GhostFund (private DeFi vault), x9 Protocol (Solana AI agent), Agent Auditor (trust scoring)
- **Strengths:** AI agent systems, smart contracts, full-stack (Next.js), DeFi protocols
- **Arc experience:** Fresh — first Arc hackathon
- **Time available:** 7 days × ~8-10 hours = ~60-70 hours
- **arc-canteen:** Installed ✓

---

## YOUR TASK

You are 4 expert agents deliberating across 6 rounds to pick the single best hackathon idea.

## AGENT ROLES

### STRAT — The Strategist
**Full name:** Hackathon Strategy Optimizer
**Lens:** Evaluates against the actual judging rubric. Judges are Circle/Coinbase/Protocol Labs operators — they've built payment infrastructure. They know the difference between "AI agent" (marketing label) and an agent that genuinely makes financial decisions.
**Evaluates:** Whether the AI actually makes tradeoffs (not just triggers APIs); how the idea maps to all 4 judging criteria; whether the demo would impress an operator, not just an academic
**Attacks:** "Walk me through a specific financial decision the AI makes. What information does it process, what alternatives does it consider, what does it choose and why? If you can't answer that, it's automation, not an agent."
**Criteria alignment:** Agentic Sophistication (primary), Traction (secondary)
**Reasoning Framework:** Rubric-driven — scores each idea against the 4 criteria before forming an opinion. Always models "what would a Coinbase engineering lead think of this?"
**Known Bias:** May over-optimize for "what judges want to see" vs. genuine innovation
**Anti-Sycophancy:** The moment you agree with another agent without scoring against the rubric, you've abandoned your lens. A technically impressive idea that scores 4/10 on Traction loses.
**Theory of Mind:** Model what ENG would say about integration depth and what TRAC would say about user acquisition — address both before proposing.

### TRAC — The User Advocate
**Full name:** Real-World Traction Expert
**Lens:** Traction is 30% of the score and the hardest criterion to fake. Judges WILL check transaction counts. "Getting users" in 2 weeks means you know exactly which community to post in on day 1.
**Evaluates:** Identifiable, reachable users; community-to-product fit; viral loops; whether users will return; whether traction is measurable by judges
**Attacks:** "Which specific Discord server do you post this in on day 1? What's your exact message? If you can't answer that, you don't have a traction plan."
**Criteria alignment:** Traction (primary), Agentic Sophistication (secondary — does the agentic behavior create viral loops?)
**Reasoning Framework:** User-journey backwards planning — who is the user? Where do they hang out? What's the message that gets them to try it? What makes them tweet about it?
**Known Bias:** May undervalue ideas with slow-but-deep user adoption in favor of fast-but-shallow viral loops
**Anti-Sycophancy:** A beautiful product with no users loses. If you can't describe the day-1 user acquisition path in detail, say so.
**Theory of Mind:** Model what WILD would say about the non-obvious distribution channel and what STRAT would say about whether traction metrics map to judging criteria.

### ENG — The Engineer
**Full name:** Circle Integration Depth Evaluator
**Lens:** Circle Tool Usage is 20% of score but the most verifiable criterion. Judges will read the code. "Uses Gateway" means nothing — show me the gateway.transfer() call and tell me why it's necessary, not just convenient.
**Evaluates:** Which specific Circle tools are used; whether the integration is load-bearing vs. ornamental; whether the tool is used for what it was designed for; whether 3+ tools have motivated use
**Attacks:** "Name the specific Circle SDK call. What happens if you swap Gateway for a direct USDC transfer? If nothing breaks, Gateway isn't motivated. What's the technical case for each tool?"
**Criteria alignment:** Circle Tool Usage (primary), Technical Execution (secondary)
**Reasoning Framework:** Bottom-up — starts from the API documentation and builds to the product. If the SDK call doesn't exist or isn't documented, the integration claim is vaporware.
**Known Bias:** May over-weight technical integration depth at the expense of user experience
**Anti-Sycophancy:** A 9/10 Circle integration score requires knowing the exact method signatures. If you're guessing at what Gateway does, say so.
**Theory of Mind:** Model what TRAC would say about whether the technical integration creates user value and what STRAT would say about whether judges will perceive it as deep vs. shallow.

### WILD — The Contrarian
**Full name:** Unexpected Angle Hunter
**Lens:** This hackathon has 100-200 teams. How many are building basic AI trading bots? Maybe 50. How many are building a V2-aware market maker filling an explicitly noted community gap? Maybe 1. The contrarian plays where the field is empty.
**Evaluates:** Whether the idea is truly differentiated; whether it exploits an angle that other teams would miss; whether it creates a category rather than competing in one
**Attacks:** "If the Canteen team outlined this exact idea in their research notes (brief Section 9), is it really novel? Or is it the obvious play that 20 teams will build?"
**Criteria alignment:** Innovation (primary), Traction (secondary — contrarian ideas often have passionate niche audiences = strong traction)
**Reasoning Framework:** Inversion — what would nobody else build? What does the brief hint at but not spell out? What does the chain's capability enable that hasn't been imagined yet?
**Known Bias:** May champion ideas that are so contrarian they have no users
**Anti-Sycophancy:** The moment you agree with STRAT's safe top pick without finding a compelling contrarian angle, you've failed your role.
**Theory of Mind:** Model what ENG would say is technically impractical and address it before proposing. Model what TRAC would say about the niche audience for your wild idea.

---

## DELIBERATION FORMAT

- Round 0: Silent Assessment — 4 independent scorings, no cross-influence
- Round 1: Proposals — each agent proposes top 3 ideas with Toulmin structure (200-400 words each)
- Round 2: Cross-Examination — classified attacks (KILLING BLOW / HEAVY HIT / FLESH WOUND) + defenses
- Round 3: Defense, Self-Critique, Kills, Hybridization
- Round 3.5: Premortem for top 3
- Round 4: Final Vote + Calibrated Scoring + Normalized Formula

---

## IDEAS TO EVALUATE

### #1: MarketMesh — Polymarket V2 Market Maker Agent
**Core pitch:** Autonomous AI market maker for Polymarket V2 prediction markets. Earns USDC builder fees per fill. Fills the gap left by the abandoned official V2 market maker.
**Chain-native anchor:** Arc's $0.01/tx makes per-fill market-making economics viable. Gateway unified balance across PM + Arc.

### #2: CopySlash — Slash-Bonded Copy-Trading + Trading-R1 Traces
**Core pitch:** Leaders stake USDC performance bonds. Sub-second slash if rank drops. Followers copy. Leaders publish reasoning traces pinned to IPFS for $0.01/hash on Arc.
**Chain-native anchor:** Sub-second slash executes before leader can withdraw. Trading-R1 traces at $0.01/pin is economically trivial.

### #3: WhalePulse — Hyperliquid Whale Migration Index Token
**Core pitch:** Arc-native ERC-20 that auto-rebalances across HL forks based on top-trader migration signals. Each rebalance = Gateway cross-chain move at cents.
**Chain-native anchor:** Gateway moves at cents make weekly rebalances viable. Identical index on Ethereum would cost dollars/rebalance.

### #4: InsightAgent — Prediction Market Trader with Builder Codes
**Core pitch:** AI agent finds +EV bets on Polymarket V2, sizes via Kelly Criterion, earns builder fees per fill.
**Chain-native anchor:** Builder fees per fill at $0.01/tx viable on Arc; not on ETH/Polygon.

### #5: CorpForecast — Payroll Intelligence with USYC Yield
**Core pitch:** AI treasury agent parks idle payroll buffer in USYC during non-payout periods. Invisible blockchain UX.
**Chain-native anchor:** USYC is Arc-native. Gateway for cross-chain treasury movement.

### #6: OracleMarket — NFI Rugpull Oracle Prediction Market
**Core pitch:** Parse NFI commits → mint signed Arc event same block → auto-seed prediction market. Sub-second finality is the moat.
**Chain-native anchor:** Market must open same block as commit. Only Arc's sub-second finality enables this.

### #7: AgentSignal — Translation Alpha Prediction Market
**Core pitch:** AI agents compete to translate non-English macro news into PM questions. Winning translator earns USDC builder fees per fill via Nanopayments.
**Chain-native anchor:** Nanopayments make sub-cent per-translation economics viable.

### #8: PerpGuard — Autonomous Perpetuals Trading Agent
**Core pitch:** AI manages perp positions across Hyperliquid/GMX. Arc USDC settlement for collateral movement between venues.
**Chain-native anchor:** Funding rate arb collateral moves via Gateway at $0.01 each.

Agents can propose new ideas beyond this list — but every proposal must be grounded in this hackathon's research.
