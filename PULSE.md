# Project Pulse — solv-001
> Rolling context. Every skill reads on entry, appends on exit.
> Last updated: 2026-05-19T13:00:00Z by hackathon-critique

## Active Facts
<!-- Override table. Later skills correct earlier facts here. Max 20 rows. -->
| Fact ID | Skill | What Changed | Old → New |
|---------|-------|-------------|-----------|
| AF-01 | critique | Demo duration | "4 minutes" → "~3 minutes (195s, 7 scenes)" — old 10-scene script summed to 5 min, not 4 |
| AF-02 | critique | Paymaster status | Was mentioned as 4th Circle tool in demo → REMOVED. Paymaster is [UNVERIFIED] + redundant on Arc (USDC is native gas). Only 3 Circle tools in demo narrative. |
| AF-03 | critique | A2A auto-caller priority | Was "Risk 1 insurance" / Day 5 secondary → NOW "Day 2 primary feature". Generates 12+ A2A transactions/day from Day 2. |
| AF-04 | critique | F-002 decision type | Was "BUY/SELL/DEFER/REJECT" → correct type is "ACCEPT/DEFER/REJECT" per src/types/index.ts |
| AF-05 | critique | Judge 60-second UX | Was FRICTION (requires MetaMask + testnet USDC) → PASS via "Try Demo Task" button (demo_mode:true, no wallet needed) |
| AF-06 | url_preverify | Vercel project name | "agent-treasury" is TAKEN (different project on Base/Chainlink). Use "solv-001" → deploys to solv-001.vercel.app |

## Decisions Log
<!-- Architectural + priority decisions. Never pruned. Max 15 entries. -->
| # | Skill | Decision | Why | Affects |
|---|-------|----------|-----|---------|
| D-01 | critique | All 5 elevations approved by user | User replied "all" | PRD.md, FEATURE-OBSERVABLES.md |
| D-02 | critique | A2A auto-caller elevated to Day 2 primary feature | Traction 30% of score; agent-to-agent payments from Day 2 create self-sustaining traction by demo day | build, demo |
| D-03 | critique | demo_mode:true button surfaced as "Try Demo Task" | Judge 60s test must pass; TaskSubmitForm.tsx needs new button; backend already supports demo_mode flag | build (TaskSubmitForm.tsx) |
| D-04 | critique | Demo = 7 scenes, ~3 min | Brief recommends ≤3 min; original 10 scenes were 5 min | demo |

## Skill Sections
<!-- Each skill appends one section on exit. Newest at bottom. -->

---
### hackathon-critique — 2026-05-19T13:00:00Z
**Status:** COMPLETE
**Session(s):** 1

#### Done
- Evaluated competitive positioning: DIFFERENTIATED (meta-layer, no RFB competitor)
- Audited Circle tool depth: DEEP (16+ API calls across 4 tools, substitution test passes)
- Evaluated narrative arc: ADEQUATE → COMPELLING after 5 elevations applied
- Applied all 5 approved elevations to PRD.md and FEATURE-OBSERVABLES.md

#### Additions (not in PRD/Architecture)
- [USER] [NEW] "Try Demo Task" button (demo_mode:true) — eliminates judge wallet friction — lives in TaskSubmitForm.tsx (ARCHITECTURE.md already has demo_mode in TaskSubmission type; UI surface is new)

#### Deviations
- Telegram polling timed out; fell back to inline elevation selection. User approved "all" inline.

#### Verified Facts
- [VF-C1] Demo scenes summed to 300s (5 min), not 4 min as PRD claimed — counted from individual scene durations
- [VF-C2] Paymaster not in ARCHITECTURE.md component list + marked [UNVERIFIED] in .forge-state.json — confirmed false claim
- [VF-C3] F-002 decision type "BUY/SELL/DEFER/REJECT" contradicts src/types/index.ts ReasoningDecision.decision = "ACCEPT" | "DEFER" | "REJECT"
- [VF-C4] GatewayClient.pay() is [UNVERIFIED] per forge state — try/catch fallback in place, expense tx may be demo-mode silently

#### Assumptions
- [A-C1] demo_mode:true pathway in nanopayments-seller.ts works as designed without UNVERIFIED pay() — WILL-BREAK if nanopayments-seller.ts has strict auth-only mode
- [A-C2] A2A auto-caller can be built as a simple Node script with EIP-3009 signing — NICE-TO-HAVE validation before Day 2

#### Blockers for Downstream
- GatewayClient.pay() [UNVERIFIED] — wire skill must validate this on Day 2 before auto-caller depends on it
- USYC Teller ABI [ASSUMED] — must retrieve from Arc explorer on Day 1 (forge finding, still open)
- USYC allowlisting ticket must be submitted on Day 1 at circle.com/en/contact

#### Key Decisions
- [D-01] "Try Demo Task" button: new UI addition — build skill must add to TaskSubmitForm.tsx
- [D-02] A2A auto-caller: Day 2 primary deliverable — build skill must create this script as Task 2.X
- [D-03] Demo script: 7 scenes, ~3 min — demo skill must use the PRD.md Section 6 revised script

#### For Next Skill (url_preverify)
- No URL to preverify yet — project is pre-build. url_preverify may be fast/skip.
- After url_preverify: build skill should note the "Try Demo Task" button is a new UI component (TaskSubmitForm.tsx) not in original ARCHITECTURE.md. It requires a POST to /api/tasks with {demo_mode:true, task:"Vet wallet 0xDEMO01...", task_type:"wallet_intelligence", payer_wallet:"0x0000000000000000000000000000000000000000"}.
- Build skill should deploy A2A auto-caller as Day 2 task (after POST /api/tasks is live).
- GatewayClient.pay() must be validated as wire skill's first test — if it fails, fallback ?demo=true path is the confirmed alternative.

---
### build [CRASHED]
**Status:** RUNNING
**Note:** Auto-entry by pipeline-runner. Skill will replace this on completion.
**If this entry is not replaced:** skill crashed or was interrupted mid-run.

#### Blockers for Downstream
- Unknown — phase did not complete

---
### build [CRASHED]
**Status:** RUNNING
**Note:** Auto-entry by pipeline-runner. Skill will replace this on completion.
**If this entry is not replaced:** skill crashed or was interrupted mid-run.

#### Blockers for Downstream
- Unknown — phase did not complete

---
### build [CRASHED]
**Status:** RUNNING
**Note:** Auto-entry by pipeline-runner. Skill will replace this on completion.
**If this entry is not replaced:** skill crashed or was interrupted mid-run.

#### Blockers for Downstream
- Unknown — phase did not complete

---
### build — 2026-05-19T19:05:26Z [PRE-DISPATCH]
**Status:** RUNNING
**Note:** Auto-entry by pipeline-runner. Skill will replace this on completion.
**If this entry is not replaced:** skill crashed or was interrupted mid-run.

#### Blockers for Downstream
- Unknown — phase did not complete
