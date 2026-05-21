# Livetest Report

**URL:** https://solv-001.vercel.app
**Tested:** 2026-05-21T13:05:00Z
**Overall:** PASS

---

## Domain Results

| # | Domain | Status | Notes |
|---|--------|--------|-------|
| 1 | Core User Flows | PASS | Full SSE sequence confirmed: treasury_snapshot → reasoning_chunk* → reasoning_complete → trace* → complete |
| 2 | API Connectivity | PASS | 6 endpoints all 200 OK: /, /proof, /api/treasury, /api/agent-card, /api/tasks (SSE), /api/mcp |
| 3 | Visual Completeness | PASS | No broken images, no user-visible placeholder text; "undefined" in script hydration tags only |
| 4 | Form Functionality | PASS | Empty task → 400, invalid task_type → 400 with valid list, malformed JSON → 400 |
| 5 | Console Errors | PASS | 0 errors, 0 warnings on full page load |
| 6 | Auth Flows | PASS | demo_mode=true bypasses payment gate; "MetaMask not detected" guides users to demo mode |
| 7 | Mobile (375px) | WARN | No horizontal scroll; est. button height 30.5px < 44px touch target; 3-col layout cramped but usable |
| 8 | Post-PRD Additions | PASS | /api/mcp returns 3 tools; /api/admin/migrate auth-protected; "Try without wallet" demo checkbox present |

---

## Findings

### Critical Issues Fixed During Livetest (not carry-forward blockers)

1. **EXPENSE_WALLET_PRIVATE_KEY corrupted in Vercel** — trailing `\n` caused GatewayClient constructor to throw before the demo fallback could catch it. Additionally, a prior fix attempt prepended `y\n` (piped CLI prompt answer got mixed into value). Fixed via Vercel REST API PATCH to clean value.

2. **NEXT_PUBLIC_APP_URL missing from Vercel** — task-execution.ts fell back to `http://localhost:3000` for self-fetches inside Vercel serverless functions. Self-fetch to localhost fails (connection refused), causing SSE stream to error after `payment_received`. Fixed by adding `NEXT_PUBLIC_APP_URL=https://solv-001.vercel.app`.

3. **14 other env vars had trailing `\n`** — all CIRCLE_*, ARC_RPC_URL, SELLER_EOA_ADDRESS, POSTGRES_URL* had `\n` suffix from original CLI-set values. Fixed via Vercel REST API PATCH (all 16 vars in one pass).

4. **getGatewayClient() was outside try block in payForResource()** — constructor throw bypassed the demo fallback catch block entirely. Moved inside try block so fallback fires on any instantiation failure. Committed and deployed.

### Warnings (non-blocking)

- `est.` (estimate) button height 30.5px — below 44px mobile touch target guideline. CTA "run task" button is 54px (fine).
- Task history contains livetest-era error records ("Execution error: fetch...", "Execution error: invalid private key...") from pre-fix test runs. Permanent DB records — visible to judges but contextually explained by the USYC/testnet status on /proof.

### Critical Issues Remaining
None.

---

## SSE Stream Verification (post-fix)

```
treasury_snapshot →
reasoning_chunk (DECISION: ACCEPT) →
reasoning_chunk* (explanation, streaming) →
reasoning_complete { decision: "ACCEPT", reasoning_tokens: 504 } →
trace { type: "payment_received", +0.75 USDC [demo mode] } →
trace { type: "nanopayment", arc_tx_hash: "45b3aa0f...", cost_usdc: 0.005 } →
trace { type: "result", "Report delivered" } →
complete { result: "Contract at 0x9fdF...: 184 bytes bytecode. ERC-20/Teller pattern detected.", net_usdc: 0.745 }
```

---

## API Spot-check

| Endpoint | Status | Key Data |
|----------|--------|----------|
| GET / | 200 | Landing page, 3-col dashboard |
| GET /proof | 200 | Agent wallet, nanopayment ledger, Claude reasoning sample |
| GET /api/treasury | 200 | usyc_apy: 0.0485, total_tasks_completed: 36, total_income: $3.15 |
| GET /api/agent-card | 200 | 8 task types, prices, descriptions |
| POST /api/tasks (demo) | 200 SSE | Full stream, complete terminal event, net_usdc: 0.745 |
| POST /api/mcp | 200 SSE | 3 tools: run_task, get_treasury_status, estimate_task |

---

## Screenshots

- `screenshots/livetest-landing-1779366635.png` — desktop landing (pre-fix)
- `screenshots/livetest-mobile-1779366646.png` — mobile 375px (pre-fix)
- `screenshots/livetest-proof-1779366748.png` — /proof page
- `screenshots/livetest-presubmit-1779366875407.png` — form pre-submit
- `screenshots/livetest-stream-start-1779367004227.png` — streaming state (demo mode checked)
- `screenshots/livetest-stream-end-1779367029294.png` — post-completion state
- `screenshots/livetest-final-desktop-1779368347.png` — desktop post-fix
- `screenshots/livetest-final-mobile-1779368359.png` — mobile post-fix
- `screenshots/livetest-final-proof-1779368366.png` — /proof page post-fix
