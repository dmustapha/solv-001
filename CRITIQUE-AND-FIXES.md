# solv-001 — Critique & Fix Plan
Generated: 2026-05-25

---

## FIX STATUS — Verified 2026-05-25

All 9 fixes confirmed implemented in codebase.

| # | Issue | Status | Key evidence |
|---|-------|--------|-------------|
| 1 | Two-wallet architecture | ✅ Done | `circle-wallets.ts:97` topUpExpenseWallet(); `TreasuryState.expense_wallet_address/usdc` |
| 2 | Expenses are synthetic | ✅ Done | `task-execution.ts:181` payForResource() on wallet_intelligence; INTERNAL_CALL_SECRET bypass at :175 |
| 3 | REJECT post-payment | ✅ Done | `ReasoningDecision.decision: "ACCEPT" \| "DEFER"`; no REJECT branch in `tasks/route.ts` |
| 4 | MetaMask EIP-3009 signing | ✅ Done | `src/app/api/sign-demo/route.ts` — server-side TEST_PAYER_PRIVATE_KEY signer |
| 5 | USYC allowlisting | ✅ Done | `TreasuryState.usyc_status: "active" \| "pending"`; getUsycStatus() wired into treasury snapshot |
| 6 | Expense wallet invisible to reasoning | ✅ Done | `ReasoningContext.expense_wallet_usdc`; system prompt has DEFER rule for ops < $0.50 |
| 7 | Dashboard expenses mismatch | ✅ Done | Structurally fixed by #2: wallet_intelligence returns real Arc tx hash from nanopayment |
| 8 | Reasoning always ACCEPTs | ✅ Done | wallet_watch/contract_watch: `estimated_cost_usdc: 0.085` (15% margin); cron cycle warning in system prompt |
| 9 | Deferred task callbacks | ✅ Done | `cron/route.ts` fireCallback(); `db.ts` callback_url column; `insertTask` persists it |

---

## TWO-WALLET ARCHITECTURE

**Recommendation: Show both separately. Build the on-chain connection between them.**

The constraint is real and documented (nanopayments-buyer.ts:5-6): Circle Dev-Controlled Wallets
are custodial and cannot supply a raw private key, which GatewayClient requires for EIP-712 signing.
Hiding this will fail under any technical inspection.

Correct framing — two-account treasury:
- Revenue Account (CIRCLE_WALLET_ADDRESS): receives all client income, holds USYC position, is the
  agent's on-chain identity
- Operations Account (EXPENSE_WALLET EOA): funds Nanopayment expenses for data queries

What makes this coherent: implement topUpExpenseWallet(). After each task, if ops wallet < $2,
transfer $5 from Circle Wallet to EOA. Arc Explorer then shows the Revenue Account BOTH receiving
income AND sending periodic routing transfers to ops. Real companies operate this way.

Dashboard change: show both wallet addresses, individual balances, combined treasury total.

---

## REJECT SHOULD NOT EXIST POST-PAYMENT

REJECT as a post-payment outcome means "I took your money and won't do the work." Remove it.

Post-payment, only two valid states:
- ACCEPT: margin positive, balance sufficient, queue manageable — execute now
- DEFER: operating reserve would be breached, OR queue_depth > 5, OR ops wallet low — hold for later

REJECT remains valid only as a pre-payment HTTP gate:
- Unknown task_type → 400 (already handled)
- No payment → 402 (already handled)

These never reach the reasoning layer.

---

## THE 9 FIXES

### Issue 1 — Two-wallet architecture
Fix: Add topUpExpenseWallet() to the post-task sweep logic in tasks/route.ts.

  getExpenseBalance() → if < $2: transferUSDC({ toAddress: EXPENSE_WALLET_ADDRESS, amountUsdc: 5 })

Record as treasury event type "ops_topup" (treasury_events.type is TEXT, not an enum — no migration
needed). Add expense_wallet_address and expense_wallet_usdc fields to TreasuryState. Show both
wallet addresses on dashboard left panel.

---

### Issue 2 — Expenses are synthetic (no real Nanopayments during task execution)
Fix: Replace direct arc-canteen calls in executeWalletIntelligence and executeContractSummary with
payForResource calls to the agent's own /api/data-service/[type] endpoint.

  payForResource({
    url: `${appUrl}/api/data-service/transaction-count?address=${address}`,
    description: "Arc tx count query",
  })

GatewayClient handles the 402→sign→retry handshake. verifyGatewayPayment in the data-service route
settles via Circle Gateway. The returned { data, expense } includes the real Arc tx hash. Push to
expense_tx_hashes. Self-payment (expense EOA pays Circle Wallet) is circular but produces real Arc
transactions — judges can verify on Explorer.

Important: data-service rate-limits by IP (30/min). Add INTERNAL_CALL_SECRET header bypass for
self-calls from task-execution, otherwise tasks hit rate limits.

---

### Issue 3 — REJECT post-payment
Fix: Remove REJECT from streamTreasuryReasoning.

- Update TREASURY_SYSTEM_PROMPT: remove REJECT option, only ACCEPT or DEFER
- Update ReasoningDecision.decision type: "ACCEPT" | "DEFER"
- Remove the REJECT branch from tasks/route.ts (lines 220-226)
- Remove rejectTask call from that flow

DEFER reasoning: "DEFER only when confirmed balance minus operating reserve is insufficient to cover
estimated execution cost, OR queue_depth > 5. Explanation must reference specific numbers."

---

### Issue 4 — MetaMask EIP-3009 signing on Arc Testnet
Fix: Add /api/sign-demo endpoint. Server-side generates a signed EIP-3009 authorization using a
funded TEST_PAYER_PRIVATE_KEY stored in env.

  POST /api/sign-demo → { payment_authorization: EIP3009Auth }

In TaskSubmitForm.tsx: if MetaMask unavailable or Arc Testnet not configured, offer "Demo mode —
use test wallet" button. Calls /api/sign-demo, fills in payment_authorization. Removes MetaMask
RPC dependency for demos entirely.

---

### Issue 5 — USYC allowlisting
Two tracks:

Track A (operational): Contact Circle Developer Support before demo day. Ask specifically for USYC
Teller allowlisting on Arc testnet for CIRCLE_WALLET_ADDRESS. Use the hackathon support channel.

Track B (demo resilience): In sweepIdleUSDCtoUSYC(), catch the "not allowlisted" error and set a
status flag. Add usyc_status: "active" | "pending" to TreasuryState. Dashboard shows "USYC: $0.00
(pending Circle approval)" with APY still displayed from chain data. Judges see the mechanism,
understand the constraint, cannot penalize for Circle's approval timeline.

---

### Issue 6 — Expense wallet invisible to treasury reasoning
Fix: Make buildReasoningContext async, add expense wallet balance as input.

In tasks/route.ts, before buildReasoningContext:
  const expenseBalance = await getExpenseBalance().catch(() => ({ usdc: 99 }));

Add to ReasoningContext type:
  expense_wallet_usdc: number;

Add to reasoning prompt:
  - Operations wallet balance (pays data query fees): $${ctx.expense_wallet_usdc.toFixed(2)}

Add to TREASURY_SYSTEM_PROMPT: "DEFER if operations wallet < $0.50 — data query payments cannot
be made."

---

### Issue 7 — Dashboard expenses don't match Arc Explorer
Structurally fixed by Issue 2 (real Nanopayments produce real tx hashes). Additionally:

Add expense_wallet_address to dashboard left panel below income wallet. When a judge opens Arc
Explorer for the expense wallet, they see real Nanopayment outflows. When they open the Circle
Wallet, they see real income inflows AND real ops top-up outflows. Full money story is on-chain.

---

### Issue 8 — Reasoning always ACCEPTs
Fix: Adjust wallet_watch and contract_watch estimated costs upward.

Current:  { price_usdc: 0.10, estimated_cost_usdc: 0.040 }  — 60% margin, always accepted
Change:   { price_usdc: 0.10, estimated_cost_usdc: 0.085 }  — 15% margin

When balance < $1.50, reasoning naturally DEFERs watch tasks. Demo scenario: seed $0.50 balance,
submit wallet_watch → reasoning DEFERs with real justification. Seed more income → ACCEPTS.

Also add to reasoning prompt: "For ongoing monitoring tasks (wallet_watch, contract_watch), factor
in that estimated cost may grow across multiple cron cycles."

---

### Issue 9 — Deferred task callbacks never fire
Fix: DB migration + cron route update.

Migration (add to scripts/migrate.ts):
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS callback_url TEXT;

db.ts insertTask: add callback_url parameter and persist it.
tasks/route.ts: pass callback_url to insertTask (currently dropped after request scope).
Task type + rowToTask: add callback_url field.

cron/route.ts: after completeTask() for deferred tasks:
  if (task.callback_url) {
    fetch(task.callback_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: task.id, result, status: "complete" }),
    }).catch(() => {});
  }

---

## REVENUE USE — OPEN QUESTION (see discussion)

Current planned uses:
1. USYC: idle capital earns 4.85% APY (needs allowlisting — Issue 5)
2. Ops top-up: Circle Wallet → EOA expense wallet when ops < $2 (Issue 1 fix)
3. A2A commissions: $0.001 back to calling agent after A2A task (under review — possibly too small)

Under discussion: what is the genuinely compelling, ecosystem-valuable use of revenue that goes
beyond passive yield and transaction noise? See session notes.
