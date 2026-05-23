# solv-001 — Transaction Verification Matrix
> Every on-chain action the agent performs, its current status, what's blocking it, and what must be fixed before it can work.
> Last updated: 2026-05-22

---

## Transaction Categories

solv-001 performs **5 distinct categories** of on-chain transactions:

| # | Category | Direction | Mechanism |
|---|----------|-----------|-----------|
| A | Income payment | Payer → Agent | EIP-3009 TransferWithAuthorization → Circle `/v1/payments/settle` |
| B | Expense payment (data) | Agent → Data Service | x402 GatewayClient → Circle `/v1/x402/verify` + `/v1/x402/settle` |
| C | USDC disbursement | Agent → Recipient | Circle Wallets API `createContractExecutionTransaction(USDC.transfer)` |
| D | USYC sweep | Agent → Teller | Circle Wallets API `approve(Teller)` + `Teller.deposit(amount)` |
| E | USYC redeem | Teller → Agent | Circle Wallets API `Teller.redeem(amount)` |

---

## Category A — Income (EIP-3009)

**How it works:**
1. UI calls `window.ethereum.request({ method: "eth_signTypedData_v4" })` with EIP-3009 typed data
2. Signed auth is included as `payment_authorization` in the POST /api/tasks body
3. Server calls `verifyNanopayment(auth, SELLER_EOA_ADDRESS)`
4. Verification posts to Circle Gateway `/v1/payments/settle` with the auth fields
5. Gateway settles USDC on Arc testnet, returns `txHash`
6. Arc tx hash stored in `tasks.income_tx_hash`

**Current status: BROKEN for all task types**

| Task Type | Price | Income Status | Root Cause |
|-----------|-------|---------------|------------|
| wallet_intelligence | $0.50 | BROKEN | Issues #1, #5, #6, #7 |
| counterparty_vet | $0.50 | BROKEN | same |
| contract_summary | $0.75 | BROKEN | same |
| conditional_payment | $0.20 | BROKEN | same |
| scheduled_disbursement | $0.20 | BROKEN | same |
| wallet_watch | $0.10 | BROKEN | same |
| contract_watch | $0.10 | BROKEN | same |
| general | $0.30 | BROKEN | same |

**The specific address mismatch:**
- `build402Response()` tells buyer: sign `to = CIRCLE_WALLET_ADDRESS` (line 86)
- `TaskSubmitForm.tsx` actually signs: `to = SELLER_EOA_ADDRESS` (ignores the 402)
- `verifyNanopayment()` checks: `auth.to === SELLER_EOA_ADDRESS` (coincidentally "passes" locally)
- Circle Gateway `/v1/payments/settle` receives: `to = SELLER_EOA_ADDRESS`
- Gateway sees mismatch between what it was told the `payTo` is vs what's signed → **rejects**

**What must be fixed before income works:**
1. Fix #5 — wallet connection UI (so user can sign anything)
2. Fix #6 — chain detection (signature must be on Arc testnet chain ID 26)
3. Fix #1 — recipient fix: form signs to `CIRCLE_WALLET_ADDRESS`, verification checks `CIRCLE_WALLET_ADDRESS`
4. Fix #7 — remove `demo_mode: true` default
5. Add `NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS` to `next.config.ts`

---

## Category B — Expense (x402 GatewayClient)

**How it works:**
1. `payForResource()` calls `GatewayClient.pay(url)` from `nanopayments-buyer.ts`
2. GatewayClient first hits data-service without payment → gets 402 + `PAYMENT-REQUIRED` header
3. GatewayClient reads 402, signs EIP-3009 using `EXPENSE_WALLET_PRIVATE_KEY`
4. GatewayClient retries with `Payment-Signature` header (base64 JSON)
5. Data-service calls `verifyGatewayPayment(paymentSig)` → Circle `/v1/x402/verify` then `/v1/x402/settle`
6. Settlement returns UUID (not Arc tx hash) — stored as expense tx hash

**CRITICAL BUG in `payForResource()`:**
```typescript
} catch {
  // Fallback: direct fetch with demo bypass
  const demoUrl = `${params.url}?demo=true`;
  // ... any GatewayClient error silently falls back to free demo
```
Any error (unfunded wallet, GatewayClient network failure, bad private key format) causes silent fallback. The task looks like it paid for data but didn't. No error logged anywhere.

| Data Service | Used By | Real Status | Issues |
|---|---|---|---|
| transaction-count | wallet_intelligence, counterparty_vet, wallet_watch, contract_watch | PARTIAL — real if funded, silent demo if not | UUID stored not Arc hash; catch-all fallback |
| contract-interactions | wallet_intelligence, counterparty_vet | PARTIAL | Same + unbounded `getLogs(fromBlock: "earliest")` |
| token-transfers | wallet_intelligence, counterparty_vet | PARTIAL + MISLEADING | Returns USDC balance via `eth_getBalance`, not actual transfer history. Trace says "Queried token transfers" but data is wrong |
| contract-code | contract_summary | PARTIAL | Same catch-all fallback issue |
| general-research | general | BROKEN | Real path returns hardcoded template (identical to demo path). No AI, no real research |

**What must be fixed before expense payments are real:**
1. Fix silent fallback — throw instead of silently falling back; surface errors explicitly
2. Fix `token-transfers` — actually return transfer logs, not balance
3. Fix `general-research` — call Claude/Tavily inside the data-service handler
4. `EXPENSE_WALLET_PRIVATE_KEY` must be funded (deposit via `depositExpenseFunds()` — already done: 19.5 USDC)

---

## Category C — USDC Disbursement

**How it works:**
1. `executePayment()` in task-execution.ts calls `executeContractCall({ contractAddress: USDC, abiFunctionSignature: "transfer(address,uint256)", ... })`
2. Returns Circle UUID transaction ID
3. `waitForTransactionHash(txId)` polls up to 20×3s = 60s for Arc tx hash

**Current status: BROKEN**

| Task Type | Disbursement Status | Root Cause |
|-----------|---------------------|------------|
| conditional_payment | BROKEN | Condition never evaluated; real tx blocked by demo_mode default |
| scheduled_disbursement | BROKEN | Same — no schedule parsing, just executes immediately |

**Note:** The USDC contract address used is `0x3600...` (correct Arc USDC). But `circle-wallets.ts` has a `transferUSDC()` function that uses `CIRCLE_USDC_TOKEN_ID` env var — this is a Circle SDK token ID, different from the Arc USDC contract address. The task-execution uses `executeContractCall` (direct contract call), not `transferUSDC` (Circle's token API). Both paths exist; the contract call path is what's actually used.

**What must be fixed before disbursements work:**
1. Fix #9 — conditional_payment must evaluate the condition before sending
2. Fix #3 — `waitForTransactionHash()` timeout reduced from 60s to 20s
3. Fix #7 — remove demo_mode so real Circle wallet executes the transfer

---

## Category D — USYC Sweep

**How it works:**
1. `sweepIdleUSDCtoUSYC()` called automatically post-task-completion
2. Checks: `balance > OPERATING_RESERVE_USDC × 1.5 = $15`
3. Step 1: `executeContractCall(USDC.approve(TELLER, amount))` — Circle UUID returned, not waited on
4. Hardcoded 5s sleep
5. Step 2: `executeContractCall(TELLER.deposit(amount))` — Circle UUID returned
6. Stores UUID as `tx_hash` in treasury_events (broken Explorer link)

**Current status: BLOCKED (Hashnote allowlist pending)**

| Sweep Status | Reason |
|---|---|
| BLOCKED | Hashnote must allowlist the Circle wallet address on the Teller contract before `deposit()` succeeds |
| tx_hash BUG | Stores Circle UUID (`txId`) directly — not the real Arc tx hash. Explorer link 404s |
| Timing BUG | 5s hardcoded sleep between approve and deposit — not deterministic; approval may not have landed |

**What must be fixed when allowlist is granted:**
1. Fix #12 — use `waitForTransactionHash()` after deposit to get real Arc hash
2. Replace 5s sleep with `waitForTransactionHash()` after approve step too
3. Fix #11 — call `redeemUSYCIfNeeded()` from execution path

---

## Category E — USYC Redeem

**How it works:**
1. `redeemUSYCIfNeeded(walletAddress)` checks if USDC balance < `OPERATING_RESERVE_USDC`
2. If USYC held: calls `executeContractCall(TELLER.redeem(usycUnits))`
3. Records treasury event

**Current status: NEVER TRIGGERED**

The function is implemented but called from **nowhere** in the codebase. It was never wired into any execution path.

| Redeem Status | Reason |
|---|---|
| NEVER TRIGGERED | No call site — function exists but is dead code |
| BLOCKED | Same Hashnote allowlist requirement as sweep |

**What must be fixed:**
1. Fix #11 — add call site in route.ts post-completion (after sweepIdleUSDCtoUSYC)
2. Same allowlist prerequisite as sweep

---

## Summary Table

| Transaction | Real On-Chain Today? | Prerequisite Fixes |
|---|---|---|
| Income (any task type) | NO — demo bypass | #1, #5, #6, #7 |
| Expense: transaction-count | MAYBE — if funded + no GatewayClient error | Fix catch-all fallback |
| Expense: contract-interactions | MAYBE | Fix catch-all fallback + getLogs |
| Expense: token-transfers | MAYBE but WRONG DATA | Fix data + catch-all |
| Expense: contract-code | MAYBE | Fix catch-all fallback |
| Expense: general-research | NO — hardcoded template | #8 + real AI call |
| Disbursement (conditional/scheduled) | NO — demo bypass | #9, #3, #7 |
| USYC sweep | NO — allowlist + UUID bug | #12 + allowlist |
| USYC redeem | NO — never triggered | #11 + allowlist |

---

## Landing Page Requirement

Given the above, solv-001 needs a landing page that **explicitly demonstrates what each transaction does** so judges and users understand the full payment flow. The page should show:

1. The income flow: wallet signs EIP-3009 → Circle Gateway verifies → USDC moves on Arc
2. The expense flow: GatewayClient pays data-service via x402 → query executed → data returned
3. The capital management flow: idle USDC → USYC (pending allowlist) → yield accrual
4. Per-task-type: exactly which transactions fire and what each costs

This is design work — requires going back to design phase for the landing page.
