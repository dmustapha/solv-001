# WAR ROOM V3 — AGORA AGENTS HACKATHON DELIBERATION BRIEF
**Date:** 2026-05-19
**Objective:** Pick THE ONE idea for the Agora Agents Hackathon that is BOTH the most winnable AND solves a significant real problem. V3 mandate: the winner must have stronger self-evidencing traction than ReasonTrace (Traction 6/10 in V2).

---

## NON-NEGOTIABLE RULES

### CRITICAL [C] — Idea eliminated if violated
1. Time is not a constraint — scope achievable by solo dev in 7-10 days
2. arc-canteen CLI mandatory for ALL Arc testnet interactions (hackathon brief §0, §17)
3. Uniqueness — zero verified competitors in exact niche
4. Circle tools architecturally motivated (substitution test)
5. Real humans — name specific people with specific problem
6. Traction self-evidencing — on-chain by design, not staged/human-controlled
7. Demo shows real Arc transactions (Arc explorer segment mandatory)
8. Cumulative corrections carried forward
9. Significant problem + builder conviction test
10. Day-1 users exist TODAY

### IMPORTANT [I] — Score penalty if violated
11. Innovation ≥7/10 (V2 mandate)
12. Devnet/testnet only
13. Agentic sophistication is real (genuine reasoning loops)
14. Demo feels like real product

### ADVISORY [A]
15. Multi-track eligibility preferred
16. Post-hackathon path visible

### PER-HACKATHON
17. V3-MANDATE: Winner Traction score must exceed ReasonTrace's 6/10
18. No Section 10 mirrors (perp trading, market makers)
19. Nanopayments substitution test (if used)
20. arc-canteen Day 0 validation required

---

## HACKATHON FACTS
- Hackathon: Agora Agents Hackathon (Canteen × Circle × Arc)
- Hard Deadline: 2026-05-25T23:59:00Z (6 days remaining from today)
- Prize: $50,000 total
  - Circle Tool Integration: $20,000 (primary track)
  - Canteen Social: $5,000 (secondary)
  - Arc chain prizes: additional bounties
- Sponsors: Canteen, Circle, Arc
- Video requirement: 3 minutes
- Submission: forms.gle/hFPM2t4Jt1zGfqzM7

## JUDGING CRITERIA
| Criterion | Weight | Description |
|-----------|:------:|-------------|
| Agentic Sophistication | 30% | Does the AI genuinely decide, or merely automate? |
| Traction | 30% | Self-evidencing evidence of use during the hackathon window |
| Circle Tool Usage | 20% | Deep, architecturally necessary Circle integration |
| Innovation | 20% | New category? Or clone of existing approach? |

## THE BUILDER
- Damilola Mustapha (@capitanoo23)
- Solo developer
- Stack: Python/TypeScript, React/Next.js, Anthropic API
- Available credentials: ANTHROPIC_API_KEY ✓, EVM_PRIVATE_KEY ✓, TELEGRAM_BOT_TOKEN ✓

---

## ARC + CIRCLE CAPABILITIES

### Arc (the chain)
- USDC-native L1 with sub-second deterministic finality (~500ms)
- No reorgs — block-ordered events are permanent (critical for commit-reveal, identity, audit trails)
- ~$0.01/transaction (Nanopayments enable sub-cent per-step operations)
- Canteen ecosystem: social trading, prediction markets, agent economy
- arc-canteen CLI: MANDATORY for all testnet interactions (non-negotiable per brief §17)
- USYC natively available: tokenized T-bill yield, 4-5% APY, instant in/out

### Circle Developer Stack
- **Nanopayments SDK**: Sub-cent micropayments ($0.001+) per operation. The key differentiator for micro-monetization use cases. Substitution test: if removing Nanopayments destroys the business model, it passes.
- **Wallets API**: Programmable USDC custody. Agent identity + treasury management. Separate wallets per agent/role.
- **USYC SDK**: Tokenized yield on idle USDC. Defensive capital positioning.
- **Gateway**: Cross-chain USDC movement. Unified balance from ETH/Polygon/other chains.
- **Paymaster**: Gas abstraction — users/agents never touch native gas tokens.
- **CCTP**: Cross-chain USDC transfer protocol.
- **App Kit**: Frontend payment UI components.

---

## KNOWN COMPETITORS (from research-brief.md)
| Category | Teams Estimated | Threat Level |
|----------|:--------------:|:------------:|
| Perp trading agents | 5-8 | HIGH |
| Polymarket V2 market makers | 3-5 | HIGH |
| Copy-trading / social trading | 2-4 | MEDIUM |
| Prediction market creators | 1-2 | LOW |
| AI reasoning audit | 0 | NONE (V2 winner category) |
| Agent identity/reputation | 0-1 | LOW |
| Signal marketplaces | 0 | NONE |
| Agent treasury | 0 | NONE |
| Freelancer payment escrow | 0-1 | LOW |

## CATEGORY SATURATION (per research-brief.md)
- HIGH saturation: perp trading, market maker, copy-trading, yield farming
- MODERATE saturation: prediction markets (supply side is less crowded)
- LOW saturation: agent infrastructure, micropayment B2C models, identity/reputation
- ZERO saturation: sub-cent signal marketplaces, agent treasury primitives

---

## PAST ARC WINNERS (from hackathon brief §11)
- **ClawRouter**: Gave AI agents USDC wallets for LLM inference payments. Won on Circle Tool Usage. Lesson: agent wallet primitives resonate with judges.
- **ArcFlow**: Corporate payroll yield via USYC while salary sits uninvested. Won on real-world problem clarity.
- **ReasonTrace (V2 winner)**: Commit-reveal reasoning audit via Nanopayments. Innovation 9/10, Traction 6/10.

---

## WINNING PATTERNS (from research-brief.md)
1. Chain-native anchors > feature bolted on. Ideas that collapse without the specific chain property score higher.
2. Self-evidencing traction beats staged demos. On-chain volume that accumulates naturally during the build period is strongest.
3. Nanopayments as business model (not payment rail) — judges reward innovative economic design.
4. USYC integration that transforms dead capital into productive capital resonates with circle judges.
5. Demo moment clarity: judges remember ideas with one visual moment that's impossible to confuse with any other idea.

## ANTI-PATTERNS (from research-brief.md)
- Decorative Circle integration (bolted on, passes no substitution test)
- Traction that requires a pre-existing user base the builder doesn't have
- Ideas that are structurally identical to Section 10 brief examples
- Vague "AI decides things" claims without a specific decision mechanism

---

## V2 RESULTS
**V2 Winner:** ReasonTrace (FINAL 8.87)
- AS: 9/10, Traction: 6/10, CTU: 8/10, Innovation: 9/10
- Mechanism: commit(SHA-256(reasoning)) via Nanopayment BEFORE action, reveal AFTER
- Won on AS + Innovation. Lost ground on Traction (6/10 on a 30%-weighted criterion).

**V2 Runner-up:** ReasonMarket hybrid (FINAL 8.42)
- Same commit-reveal mechanism applied to prediction market betting decisions
- Also Traction 7/10 — STRAT dissent noted this was the stronger traction story

**What corrections were made (cumulative):**
- V1 correction: Innovation cannot be the weak link — Innovation ≥7/10 required
- V1 correction: Uniqueness as primary filter — ideas other teams clone easily score lower
- V1 correction: Agentic sophistication claims must be backed by genuine reasoning loops
- V1 correction: Execution plays not enough — must push Innovation ≥7/10
- V3 mandate: Fix Traction weakness OR find new category with stronger self-evidencing traction

**Why we're re-running:** ReasonTrace's Traction score of 6/10 on a 30%-weighted criterion is a meaningful structural weakness. V3 explores whether we can find an idea where Traction is as strong as Innovation and Agentic Sophistication.

---

## YOUR TASK
You are 4 expert agents debating which idea to build for the Agora Agents Hackathon. Deliberate across 6 rounds. Use EVIDENCE from the research above. Every claim must cite specific research findings. Ideas must genuinely die in Round 3 — forced convergence is a quality failure.

### AGENT ROLES

**SOPH — Sophistication Gauge**
- Full name: Sophistication Gauge
- Lens: "Does the AI genuinely decide, or does it merely automate?"
- Evaluates: reasoning loop quality, decision architecture, whether AI is the bottleneck or decorative
- Attacks: mechanical wrappers, sequential API calls labeled as "AI reasoning," vague "AI decides" claims
- Criteria alignment: Agentic Sophistication (30%)
- Known bias: may undervalue simple-but-working ideas in favor of architecturally complex ones
- Anti-sycophancy: MUST disagree when other agents claim an idea has "genuine AI reasoning" without specifying the decision function

**TRAC — Traction Oracle**
- Full name: Traction Oracle
- Lens: "Can this generate real, organic, self-evidencing traction in 14 days?"
- Evaluates: on-chain evidence accumulation, organic vs. staged volume, day-1 user accessibility
- Attacks: traction that requires a pre-existing audience, staged demos where builder controls both sides, developer tools with slow adoption curves
- Criteria alignment: Traction (30%)
- Known bias: may undervalue innovation in favor of proven-category ideas with clearer traction
- Anti-sycophancy: MUST call out staged traction even when the idea is otherwise strong

**CIRC — Circle Integration Depth**
- Full name: Circle Integration Depth
- Lens: "Does this use Circle tools in ways that are architecturally necessary, not decoratively bolted on?"
- Evaluates: substitution test (would the idea collapse without each Circle tool?), number of tools used, how deeply each integrates
- Attacks: Gateway added for no reason, USYC bolted on as a feature, Nanopayments used where any transfer would do
- Criteria alignment: Circle Tool Usage (20%)
- Known bias: may overvalue ideas with many Circle tools even when some integrations are superficial
- Anti-sycophancy: MUST apply substitution test to every Circle tool claimed — "would removing this break the core value?"

**WILD — X-Factor Scout**
- Full name: X-Factor Scout
- Lens: "Will judges remember this in 6 months? Does it create a new category?"
- Evaluates: demo memorability, category novelty, competitive uniqueness, the "wow" moment
- Attacks: ideas that are clever but forgettable, ideas in crowded categories with marginal differentiation
- Criteria alignment: Innovation (20%)
- Known bias: may overvalue demo spectacle over real-world utility and feasibility
- Anti-sycophancy: MUST distinguish between "impressive demo" and "genuinely new category" — these are not the same

### DELIBERATION FORMAT
- Round 0: Silent Assessment (4 subagents, independent scoring, no inter-agent communication)
- Round 1: Each agent proposes top 3 ideas (Toulmin-structured, 200-400 words each) → PAUSE for user
- Round 2: Sub-round 2A (attacks: KILLING BLOW / HEAVY HIT / FLESH WOUND) + Sub-round 2B (defenses)
- Round 3: Defense, self-critique of own top pick, kills (≥3 must die), hybridization only if KILLING BLOW demands it → PAUSE for user
- Round 3.5: Premortem for top 3 surviving ideas
- Round 4: Final vote (1st=3pts, 2nd=2pts, 3rd=1pt) + criteria scoring + YC PQ + normalized formula

### SCORING FORMULA
FINAL = (Norm_Vote × 0.30) + (Weighted_Criteria_Avg × 0.50) + (Norm_YC_PQ × 0.20) + Bonuses
- Norm_Vote = (vote_points / 12) × 10
- Weighted_Criteria_Avg = sum(criterion_score × weight) [AS 30%, Traction 30%, CTU 20%, Innovation 20%]
- Norm_YC_PQ = (YC_PQ_score / 6) × 10 [minimum YC_PQ of 3 to proceed]
- Bonuses: zero verified competitors (+1.0), demo indistinguishable from real product (+1.0)

### IDEAS TO EVALUATE (in random order for Round 0)
1. AgentID — Universal agent identity and reputation registry on Arc
2. RegimeShift — AI agent that detects market regimes and auto-rebalances to USYC
3. AlphaStream — AI trading signal marketplace powered by Nanopayments
4. AgentTreasury — Self-funding autonomous agent treasury primitive
5. MilestoneGuard — AI-verified freelancer milestone payments on Arc

Agents may propose hybrids in Round 3 if they directly resolve a KILLING BLOW. New ideas outside this list require justification against the prior_warroom_repeat exclusion list.
