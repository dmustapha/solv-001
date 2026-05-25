# Demo Video — Session Context
Date: 2026-05-25

---

## Core Framing (from WINNER-BRIEF — do not drift from this)

The hook is NOT about idle money or custody. It is about reasoning vs rules.

> "Agent treasuries exist — ElizaOS, Coinbase Agentic Wallets, and x402-based agents can all hold and spend crypto. But every current implementation runs on rules: accept all tasks above threshold X, rebalance when balance drops below Y. No agent uses an LLM to reason about its own financial decisions in real time."

> "The decisions are explained, not just executed."

**One-line positioning:** Every AI agent wallet today is an if-else statement. SOLV-001 is the first one that thinks.

---

## Competitor Intelligence — FLOAT by @kenn_ronin

- Same hackathon, same Arc + USYC stack
- "Yield middleware for idle USDC on Arc" — 6 lines of Solidity, library for devs to integrate
- GitHub: ronkenyv/float-yield-router (contributors: ronkenyv, dependabot, claude)
- Vertical format, ~2:45, strong Twitter engagement (51 likes, 27 comments)
- NO AI reasoning layer — rule-based sweep
- NO payment infrastructure (no x402, no EIP-3009, no MCP)
- This is a component. SOLV-001 is an economy.

Key differentiator: FLOAT makes idle capital useful. SOLV-001 reasons about whether to earn, spend, and compound at all.

---

## Video Production Lessons (from analyzing FLOAT video)

### What Float did well that we should steal:
1. **Word-by-word captions** — CapCut auto-captions, free tier, synced to narration
2. **One ambient music track the whole video** — don't switch tracks
3. **Raw terminal/live demo** — unedited, real wallet addresses, real chain ID, real tx output
4. **Closing card** — black background, 4-5 words max, large italic text ("Six lines. Idle dollars working.")
5. **Alternating structure** — animated scene → screen recording → animated scene (exactly what we planned)
6. **PiP selfie cam** — face in corner during screen recording sections, removed for animated scenes
7. **Problem visual before solution** — Float showed all 4 Arc primitive patterns before revealing the fix

### What Float used for animated scenes:
PowerPoint slides, NOT Remotion/After Effects. Dark backgrounds with stock blue light imagery, 3D shapes for diagrams, large text overlaid. Simple but effective.

### Our decision: Remotion (not PowerPoint)
Reason: SOLV-001's story needs dynamic elements PowerPoint can't do — the payment flow (EIP-3009 → Circle Gateway → wallet → USYC), the reasoning stream animating in, treasury numbers counting up. Also matches our amber/dark design system exactly.

---

## Script — Current State (revised for human tone)

### Structure (8 scenes, 2:50 target):
- Scene 1 (0:00–0:20): Animated hook
- Scene 2 (0:18–0:38): Animated architecture — three layers (INCOME / REASONING / TREASURY)
- Scene 3 (0:38–1:00): Screen — live dashboard
- Scene 4 (1:00–1:55): Screen — DEFER demo first (low balance + wallet_watch), then ACCEPT demo (counterparty_vet)
- Scene 5 (1:42–2:02): Screen + animated overlay — payment trace, expense ledger
- Scene 6 (2:02–2:24): Animated — three client paths (browser, REST, MCP)
- Scene 7 (2:24–2:38): Animated — USYC yield sweep
- Scene 8 (2:38–2:50): Screen + animated close

### Narration (human tone — revised, no em dashes, no parallel structure, hedging embedded):

**Scene 1:**
"AI agents can hold money now. A lot of them can reason too. But the part that manages what actually happens with that money, how it earns, where it gets spent, whether idle capital gets put to work, that's always been rules. SOLV-001 does on-chain financial work. Counterparty checks, contract analysis, watching wallets for unusual activity. It earns USDC from tasks, pays out through nanopayments when it needs on-chain data, and sweeps whatever's left into yield. That whole loop exists in other wallets today. The difference is every current implementation manages it with hardcoded thresholds. Sweep at balance X, top up ops at Y. SOLV-001 actually reasons over its own financial state before making any of those calls."

**Scene 2:**
"The way it's structured, the agent earns USDC by completing tasks people pay for, things like contract analysis, counterparty checks, that kind of thing. That income goes into a Circle programmable wallet. Then before any outgoing spend, the agent reads the task and makes an actual ACCEPT or DEFER call on whether it's worth the cost. And whatever's sitting idle above a threshold gets swept into USYC for yield. So there's a full financial loop happening, not just a payment demo."

**Scene 3:**
"This is the live dashboard. On the left panel you can see two wallet addresses. The top one is the Circle income wallet, that's where client payments land and where the USYC position lives. Below it is the ops wallet, a separate EOA that pays out for data queries through nanopayments. When the ops balance drops below two dollars, the income wallet automatically tops it up, which I think is actually one of the more interesting parts of the design. The treasury balance is pulling from Circle's API, and the task history on the right shows everything the agent has processed, including what it decided to do with each one."

**Scene 4:**
"So let me show you both outcomes. First I'm going to seed the wallet to about fifty cents and submit a wallet watch task. What happens is the agent gets the task description plus its full treasury state, and it has to reason through whether the economics actually work. You can see that stream here. It comes back with DEFER. The reasoning is that a wallet watch accumulates cost across multiple cron cycles, and with fifty cents in the wallet the numbers don't hold up. So it held the task and explained why, rather than just taking the money.

Now I top up the balance and submit a counterparty check on a wallet address I want to transact with. It's the same reasoning call under the hood, but this time the margin is healthy and the ops wallet is funded. It comes back ACCEPT and runs the analysis. You get a full profile back: on-chain activity, risk assessment, a clear recommendation on whether to proceed. The payment settled on-chain during the whole thing, and the trace has an Arc explorer link you can verify."

**Scene 5:**
"The payment side is interesting because the agent is on both sides of the transaction flow, but through two separate wallets. When a client pays, that's a gasless signed transfer that lands in the Circle income wallet. That's the agent's on-chain identity, the one that also holds the USYC position. When the agent pays out to fetch on-chain data for that counterparty check, that comes from a separate ops wallet. After each task, the income wallet checks whether the ops wallet needs topping up and sends across if it does. So if you pull up the Arc explorer for the income wallet, you see client payments flowing in and periodic routing transfers going out. Both sides are traceable on-chain."

**Scene 6:**
"There are three ways to use this agent, and they weren't all built at the same time. The MCP interface came later, when it became clear that other AI systems might want to hire SOLV-001 directly. From a browser you can do what I just showed. From another service you can call it via REST and it handles the payment handshake automatically. And if you're running your own LLM-based agent, you can connect it as an MCP tool and it negotiates the payment on your behalf."

**Scene 7:**
"And then there's the yield layer. Anything sitting in the income wallet above the operating reserve gets swept into USYC, which is Hashnote's tokenized money market fund on Arc. It earns yield on US Treasuries, so idle capital isn't just sitting there. The mechanism is fully built and the reasoning layer actually decides how much to sweep after each task, based on treasury health. We're still waiting on Circle's allowlisting approval for the USYC Teller on testnet, so the dashboard shows the position as pending right now. But the sweep logic is running, the exchange rate is pulling from chain, and when approval comes through it activates without any code changes. The reasoning also outputs a contribution rate, which is a small percentage of task income that goes back to the Arc faucet. How much depends on how healthy the treasury is, so it scales with the agent's actual financial position."

**Scene 8:**
"Everything you've seen is running live on Arc testnet. The payments settled on-chain, the treasury balance is live data from Circle's API. SOLV-001 is basically a proof that an AI agent can manage its own finances without anyone writing rules for it. It earns from tasks. Before each spend, it reasons through whether the cost makes sense. And whatever's sitting idle gets put to work in yield. None of that runs on hardcoded thresholds. If you want to try it yourself, the dashboard is at solv-001.vercel.app."

---

## Pending Changes to Script Before Running Demo-Video Skill

1. ~~**Scene 1 hook**~~ — **Resolved.** Current script opens with reasoning vs rules framing. No change needed.
2. **Scene 2** — still needs a quick problem-first visual beat (show rule-based if-else before revealing SOLV-001's architecture). Narration is fine, the animated scene design needs to open with the "status quo" frame.
3. **Closing card** — **Resolved.** Copy: **"Reasoning, not rules."** Black background, large italic text, 3 words. Scene 8 narration ends with the URL; card appears after fade.
4. **Format** — vertical 9:16. Dami narrates throughout. PiP selfie cam on screen recording sections (Scenes 3, 4, 5, 8).
5. **Music** — one ambient track, full video, narration sits clearly on top.
6. **Scene 4 demo prep** — before recording: seed balance to ~$0.50 via `/api/sign-demo`, submit wallet_watch to capture DEFER. Then top up and run counterparty_vet to capture ACCEPT. Record both in one uncut session.

---

## Human Tone Rules (from memory — apply to all narration)

- Full sentences with subordinate clauses
- Hedging: "probably", "I think", "what we found was", "the interesting thing is"
- Embedded reasoning — say WHY not just WHAT
- Uneven sentence lengths — no perfect parallel structure
- No em dashes as separators
- No bold-label-leading sentences
- No clean three-part parallels ("Built on X, powered by Y, reasoned by Z")
- Variation in formality — some casual, some technical
