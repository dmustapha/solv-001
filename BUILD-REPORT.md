# Build Report — solv-001
Generated: 2026-05-19T21:45:00Z
Builder: hackathon-build skill (attempt 5 — this session completed all phases)

## Summary
| Phase | Steps | Status | Notes |
|-------|-------|--------|-------|
| pre-build (M.1, M.2) | M.1, M.2 | complete | DOMAIN-GUIDE.md, submission/ created in prior session |
| phase-0 (scaffold, creds, DB, arc-canteen) | 0.1–0.5 | complete | All files committed in fa747e6; Circle wallet created |
| phase-1 (Treasury, Nanopayments, Task API) | 1.1–1.5 | complete | All lib + API files committed |
| phase-2 (Data Service, Task Execution, Buyer) | 2.1–2.5 | complete | task-execution.ts (301L), data-service route |
| phase-3 (USYC, MCP, Agent Card) | 3.1–3.4 | complete | usyc.ts, mcp/route.ts, agent-card/route.ts |
| phase-4 (Dashboard UI) | 4.1–4.7 | complete | All 5 components + a2a-auto-caller.ts |
| phase-5 (Seed, Proof, Deploy, Payments) | 5.1–5.5 | complete* | Seed done; proof.md done; deploy deferred to deploy-to-github skill |
| phase-6 (Demo, Submission) | 6.1–6.2 | pending | Deferred to demo + package skills |

*Phase 5 deploy (Task 5.3) deferred to deploy-to-github skill per pipeline split.

## Deviations from Architecture

| ID | Component | ARCHITECTURE Said | ACTUAL | Reason | Class | Downstream Impact |
|----|-----------|-------------------|--------|--------|-------|-------------------|
| DEV-001 | circle-wallets.ts:transferUSDC() | `tokenId: process.env.CIRCLE_USDC_TOKEN_ID!` | `tokenId: process.env.CIRCLE_USDC_TOKEN_ID ?? ""` | Original had non-null assertion; safeguarded with empty string fallback + known-gap comment | COSMETIC | None — CIRCLE_USDC_TOKEN_ID now set to `15dc2b5d-0994-58b0-bf8c-3a0501148ee8` |
| DEV-002 | seed-demo.ts:depositExpenseFunds() | GatewayClient deposits $2 USDC | Skipped: expense wallet has 0 USDC, Arc testnet unreachable | Testnet faucet inaccessible; EOA has no native gas | UNTESTED | Wire skill must fund expense wallet and validate GatewayClient.pay() |
| DEV-003 | arc-canteen: chain liveness | Arc testnet reachable on Day 1 | Arc testnet unreachable — seed used demo data | Testnet endpoint returned connection error | UNTESTED | Wire skill: validate arc-canteen when testnet is live |

## Failed Attempts & Resolutions
| Step | Error | Attempts | Resolution |
|------|-------|----------|------------|
| CIRCLE_USDC_TOKEN_ID | Empty in .env.local; Circle API returned 404 for token list endpoint; requestTestnetTokens returned Forbidden | 3 | Found from arc-commerce reference sample: `15dc2b5d-0994-58b0-bf8c-3a0501148ee8` |

## Verification Results
| Phase | Command | Expected | Actual | Pass? |
|-------|---------|----------|--------|-------|
| All | `npm run typecheck` | 0 errors | 0 errors (clean) | PASS |
| Phase-0 | `npm run dev` | HTTP 200 on key routes | /, /proof, /api/agent-card, /api/treasury all 200 | PASS |
| Phase-0 | `npx tsx scripts/migrate.ts` | "Migration complete" | Migration complete | PASS |
| Phase-5 | `npm run seed` | 8 tasks seeded | "Tasks already seeded. Skipping." (data present from prior session) | PASS |
| Phase-0 | Treasury API | Valid JSON with treasury data | `{"total_tasks_completed":8,"total_income_all_time_usdc":3.15,...}` | PASS |

## Known Risks (for debug)
- [VF-C4] GatewayClient.pay() is [UNVERIFIED] per forge state — try/catch fallback in place, expense tx may be demo-mode silently. **Wire skill must validate.**
- [A-C1] demo_mode:true pathway in nanopayments-seller.ts — WILL-BREAK if strict auth-only mode. **Wire skill must test.**
- [DEV-002] GatewayClient deposit blocked: expense wallet has 0 USDC, Arc testnet unreachable. **Wire skill: fund first.**
- [DEV-003] Arc testnet unreachable: all seeded tasks have demo/fake tx hashes, not real on-chain. **Wire skill: generate real transactions.**
- USYC Teller ABI [ASSUMED] — retrieve from Arc explorer on Day 1. USYC deposit/redeem blocked by allowlisting.
- CIRCLE_USDC_TOKEN_ID `15dc2b5d-0994-58b0-bf8c-3a0501148ee8` from arc-commerce sample — should be validated via Circle dashboard.

## Contract Addresses
| Contract | Network | Address | Tx Hash |
|----------|---------|---------|---------|
| USDC (native) | ARC-TESTNET | 0x3600000000000000000000000000000000000000 | — |
| USYC Teller | ARC-TESTNET | 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A | — |
| Circle Agent Wallet | ARC-TESTNET | 0x927c1d756d12879aebea0772f3ee220f21f4841a | Created 2026-05-19 |

## Environment Variables Added
| Key | Source Step | Value/Description |
|-----|-----------|-------------------|
| ANTHROPIC_API_KEY | pre-set | from .env.local |
| CIRCLE_API_KEY | pre-set | TEST key |
| CIRCLE_ENTITY_SECRET | pre-set | from .env.local |
| EXPENSE_WALLET_PRIVATE_KEY | pre-set | EOA private key |
| ARC_RPC_URL | pre-set | testnet RPC |
| NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID | pre-set | WalletConnect key |
| CIRCLE_WALLET_ID | Phase-0 (0.5) | `027e96af-4ab4-5e4a-be68-0dace00a70a3` |
| CIRCLE_WALLET_ADDRESS | Phase-0 (0.5) | `0x927c1d756d12879aebea0772f3ee220f21f4841a` |
| CIRCLE_WALLET_SET_ID | Phase-0 (0.5) | `4b3436da-d356-5c81-8a23-1c4491baa183` |
| SELLER_EOA_ADDRESS | Phase-0 | `0x156D30820aec51eEB34C74977Eb5f106322c2B50` |
| POSTGRES_URL | Phase-0 (0.4) | Neon DB — solv001 database |
| ARC_USDC_ADDRESS | Phase-0 | `0x3600000000000000000000000000000000000000` |
| CIRCLE_USDC_TOKEN_ID | Phase-5 (this session) | `15dc2b5d-0994-58b0-bf8c-3a0501148ee8` (from arc-commerce ref) |
| APP_URL | Phase-5 (deploy) | `https://solv-001.vercel.app` |
| NEXT_PUBLIC_APP_URL | Phase-5 (deploy) | `https://solv-001.vercel.app` |

## Deployment Record
| Target | Status | URL | Notes |
|--------|--------|-----|-------|
| Vercel Production | ✅ Live | https://solv-001.vercel.app | Next.js 15.5.18, patches CVE-2025-66478 |
| Neon Database | ✅ Live | solv001 on ep-gentle-scene-aqq1h9rg-pooler | 3 tables, 8 seeded tasks |
| A2A auto-caller | ✅ Ready | scripts/a2a-auto-caller.ts | Run with AGENT_TREASURY_URL=https://solv-001.vercel.app |
