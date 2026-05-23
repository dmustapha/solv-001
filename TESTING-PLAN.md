# solv-001 — Comprehensive Testing Plan
> Tests every transaction type from both Human UI and A2A channels.
> Run AFTER all P0 fixes are implemented.
> Last updated: 2026-05-22

---

## Prerequisites Before Any Test Can Run

These must be in place or tests will fail at the gate:

```
[ ] P0 fixes implemented: #1 (EIP-3009 recipient), #5 (wallet connect), #6 (chain detect), #7 (demo mode off)
[ ] NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS added to next.config.ts
[ ] ARC_USDC_ADDRESS env var set (currently undefined — breaks /v1/payments/settle body)
[ ] EXPENSE_WALLET_PRIVATE_KEY funded (confirmed: 19.5 USDC deposited)
[ ] A2A_CALLER_PRIVATE_KEY funded on Arc testnet with USDC
[ ] MetaMask (or test wallet) funded with Arc testnet USDC for human UI tests
[ ] App deployed to Vercel (or running locally with ngrok for Circle Gateway callbacks)
```

---

## Test Suite Structure

```
Suite 1 — Income Payment Gate (Category A)
Suite 2 — Data Service Expense Payments (Category B)
Suite 3 — Task Execution by Type
  3a — wallet_intelligence + counterparty_vet
  3b — contract_summary
  3c — conditional_payment + scheduled_disbursement
  3d — wallet_watch + contract_watch
  3e — general
Suite 4 — USYC Capital Management (Categories D + E)
Suite 5 — A2A Channel (all task types via REST)
Suite 6 — MCP Channel (run_task tool)
Suite 7 — Edge Cases + Rejection Paths
```

---

## Suite 1 — Income Payment Gate

Tests that EIP-3009 payment is accepted or correctly rejected before any task runs.

### T1.1 — Valid payment accepted (Human UI)
**Trigger:** Submit any task via UI with connected wallet + sufficient USDC balance
**Expected:**
- `verifyNanopayment()` returns `{ verified: true, tx_hash: "0x..." }`
- `tasks.income_tx_hash` contains a real Arc tx hash (starts with `0x`, length 66)
- Arc Explorer link for the tx resolves (not 404)
- Treasury event of type `income` inserted in `treasury_events`
- SSE stream starts: `treasury_snapshot` → `reasoning_chunk*` → `reasoning_complete`

**Verify in DB:**
```sql
SELECT income_tx_hash, income_usdc FROM tasks ORDER BY created_at DESC LIMIT 1;
-- income_tx_hash must start with 0x and be 66 chars
SELECT * FROM treasury_events WHERE type = 'income' ORDER BY created_at DESC LIMIT 1;
```

**Verify on-chain:**
- Open `https://explorer.arcnetwork.xyz/tx/{income_tx_hash}` — must load

---

### T1.2 — No wallet connected → clear error
**Trigger:** Submit task form without connecting wallet
**Expected:** "Connect Wallet" prompt, not a silent failure

---

### T1.3 — Wrong chain → chain switch prompt
**Trigger:** MetaMask on Ethereum mainnet, submit task
**Expected:** UI prompts to switch to Arc Testnet (chain ID 26), not a cryptic signature error

---

### T1.4 — Insufficient USDC balance → clear error
**Trigger:** Connected wallet has 0 USDC, submit $0.50 task
**Expected:** UI shows "Insufficient USDC balance" before prompting signature

---

### T1.5 — Payment authorization replay rejected
**Trigger:** Capture a valid signed auth from T1.1, POST /api/tasks again with same auth
**Expected:** Circle Gateway `/v1/payments/settle` rejects (nonce already used)
**HTTP:** 402 with error message about duplicate payment

---

### T1.6 — Expired payment authorization rejected
**Trigger:** Sign a payment with `validBefore = now - 1` (already expired)
**Expected:** `verifyNanopayment()` returns `{ verified: false, error: "Payment authorization expired..." }`
**HTTP:** 402

---

### T1.7 — Wrong recipient → rejected
**Trigger:** POST /api/tasks with `payment_authorization.to` pointing to a random address
**Expected:** `verifyNanopayment()` rejects with "recipient mismatch"
**HTTP:** 402

---

### T1.8 — Payment amount too low
**Trigger:** Sign authorization for $0.01 but task_type requires $0.50
**Expected:** Circle Gateway rejects at settlement step (amount mismatch)
**HTTP:** 402

---

## Suite 2 — Data Service Expense Payments

Tests that GatewayClient actually pays for each data service endpoint and gets real data back.

### T2.1 — transaction-count: real payment + real data
**Trigger:** Submit `wallet_intelligence` task with valid address (e.g., `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A`)
**Expected:**
- GatewayClient.pay() succeeds (no catch block triggered)
- `Payment-Signature` header sent to data-service
- `verifyGatewayPayment()` calls Circle `/v1/x402/verify` → `isValid: true`
- Circle `/v1/x402/settle` settles → returns transaction UUID
- Data returned: `{ address, count: N }` where N > 0 for a real address
- Trace event: `arc_tx_hash` is a UUID (acceptable — Circle Gateway expense txs return UUIDs)
- `treasury_events` expense record inserted

**Verify in DB:**
```sql
SELECT description, arc_tx_hash, cost_usdc FROM trace_events
WHERE task_id = '{task_id}' AND type = 'nanopayment' ORDER BY timestamp;
-- Should have 3 rows for wallet_intelligence
-- arc_tx_hash will be a UUID format (this is known and acceptable for now)
```

---

### T2.2 — contract-interactions: real payment
**Same task:** `wallet_intelligence` on an address with known interactions
**Expected:** `interaction_count` > 0 for a contract address; `getLogs()` completes without error

---

### T2.3 — token-transfers: data is USDC balance (document discrepancy)
**Note:** This endpoint currently returns `usdc_balance` via `eth_getBalance`, not transfer history.
**Expected:** Returns `{ address, usdc_balance: N }` — document that this is a balance read, not transfer history
**Post-fix expected:** Returns actual ERC-20 Transfer event log entries

---

### T2.4 — contract-code: EOA vs contract detection
**Trigger:** Submit `contract_summary` for:
  - An EOA address (e.g., a fresh wallet) → expects `{ code: "0x", is_contract: false }`
  - A contract address (e.g., USYC `0xe9185...`) → expects `code.length > 2`
**Expected:** Both return real Arc RPC data, not demo stub values

---

### T2.5 — general-research: real AI response (after #8 fix)
**Trigger:** Submit `general` task with query: "What is the current USYC APY on Arc testnet?"
**Expected:** Response is a real AI-generated answer, not `"Research on Arc testnet: ... no major anomalies detected."`

---

### T2.6 — GatewayClient fallback NOT triggered (regression)
**Verify:** After removing the silent catch-all fallback, any GatewayClient error must surface as a task failure with `status = 'failed'`, not silently complete as a demo task.
**Trigger:** Temporarily set `EXPENSE_WALLET_PRIVATE_KEY` to an invalid value, submit task
**Expected:** Task fails with error, not completes with `0x0000...` expense hash

---

## Suite 3 — Task Execution by Type

### 3a — wallet_intelligence + counterparty_vet

#### T3a.1 — Known active wallet
**Task:** `"Analyze wallet 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A"`
**Expected result string contains:**
- Transaction count > 0
- Balance amount
- Risk classification ("Active history" or "Limited history")
- 3 expense nanopayments logged in trace_events
- `status = 'complete'`

#### T3a.2 — Fresh wallet (limited history)
**Task:** `"Analyze wallet 0x0000000000000000000000000000000000000001"`
**Expected:** "Limited history — proceed with caution" in result

#### T3a.3 — No address in task text
**Task:** `"Analyze my wallet"` (no 0x address)
**Expected:** Falls back to `DEMO_WALLET_01` env var address, still completes

---

### 3b — contract_summary

#### T3b.1 — Known contract
**Task:** `"Summarize contract 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C"` (USYC)
**Expected result (after #10 fix):**
- Real Claude analysis of bytecode patterns
- Not: "ERC-20/Teller pattern detected" (hardcoded)
- `is_contract: true` in data-service response

#### T3b.2 — EOA address
**Task:** `"Summarize contract 0x0000000000000000000000000000000000000001"`
**Expected result:** "Address ... is an EOA, not a contract"

#### T3b.3 — No address in task text
**Task:** `"Summarize the main USDC contract"`
**Expected:** Falls back to `USYC_ADDRESS_PLACEHOLDER`, still completes

---

### 3c — conditional_payment + scheduled_disbursement

#### T3c.1 — Condition met: payment executes
**Task:** `"Send 0.01 USDC to 0x{recipient} if balance > 0"` (condition always true)
**Expected (after #9 fix):**
- Condition parsed and evaluated
- `executeContractCall(USDC.transfer)` called
- `waitForTransactionHash()` returns real Arc hash
- Trace event with real Arc tx hash (starts with 0x)
- Treasury expense event with tx_hash recorded
- `result`: "Sent 0.01 USDC to 0x{recipient}. Arc tx: 0x..."

#### T3c.2 — Condition not met: payment skipped
**Task:** `"Send 1000 USDC to 0x{recipient} if balance > 999999"`
**Expected (after #9 fix):**
- Condition parsed, balance fetched, threshold not met
- No transfer executed
- Trace: "Condition evaluated: balance=X, threshold=999999 — NOT met. Payment skipped."
- `status = 'complete'`, result explains skip

#### T3c.3 — Missing address or amount → parse error result
**Task:** `"Send some USDC somewhere"`
**Expected:** Result: "Could not parse payment destination or amount from task description."
**No on-chain tx executed**

#### T3c.4 — Disbursement verifiable on Arc Explorer
**After T3c.1 succeeds:** Open `https://explorer.arcnetwork.xyz/tx/{expense_tx_hash}` — must show USDC transfer

---

### 3d — wallet_watch + contract_watch

#### T3d.1 — Watch task completes with baseline snapshot
**Task:** `"Watch wallet 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A for activity"`
**Expected:**
- 1 expense nanopayment (transaction-count for baseline)
- Result includes baseline tx count
- `status = 'complete'`
- Note: actual ongoing monitoring is not implemented — test acknowledges this limitation

#### T3d.2 — Watch task without address
**Task:** `"Watch this address for changes"` (no 0x)
**Expected:** Result: "No address found in task — monitoring not started."
**Status:** `complete`, cost: 0

---

### 3e — general

#### T3e.1 — Research query with real AI (after #8 fix)
**Task:** `"Research DeFi yield strategies for stablecoin treasuries on Arc testnet"`
**Expected:** Real Claude-generated summary, not the hardcoded template
**Expense:** 1 nanopayment for general-research endpoint

#### T3e.2 — General task result stored correctly
**Verify in DB:**
```sql
SELECT result, cost_usdc FROM tasks WHERE task_type = 'general' ORDER BY created_at DESC LIMIT 1;
-- result should not contain "no major anomalies detected"
-- cost_usdc should be > 0
```

---

## Suite 4 — USYC Capital Management

These tests require Hashnote allowlist approval. Mark as PENDING until then.

### T4.1 — USYC position read (can run now)
**Trigger:** `GET /api/treasury` or load the dashboard
**Expected:** `usyc_balance`, `usyc_usdc_value`, `usyc_apy` all populated from live Teller contract reads
**Verify:** `usyc_apy` ≈ 4.85% (live from `annualYield()` view function)

### T4.2 — Sweep triggers at correct threshold (PENDING allowlist)
**Trigger:** Agent completes a task while USDC balance > $15 (OPERATING_RESERVE × 1.5)
**Expected:**
- `sweepIdleUSDCtoUSYC()` fires automatically post-completion
- `USDC.approve(TELLER, amount)` tx submitted and confirmed before deposit
- `TELLER.deposit(amount)` tx submitted
- Treasury event type `sweep` with real Arc tx hash (after #12 fix)
- `usyc_balance` increases on next read

### T4.3 — Redeem triggers when USDC low (PENDING allowlist)
**Setup:** Drain USDC to below $10 (OPERATING_RESERVE)
**Expected:**
- `redeemUSYCIfNeeded()` fires (after #11 fix wires it in)
- `TELLER.redeem(usycUnits)` executed
- USDC balance restored above reserve
- Treasury event type `redeem` recorded

### T4.4 — No sweep when below threshold
**Setup:** USDC balance = $11 (above reserve but below $15 sweep threshold)
**Expected:** `sweepIdleUSDCtoUSYC()` returns early, no tx submitted

---

## Suite 5 — A2A Channel (REST)

Tests the A2A caller script with real payments (after #16 fix: `A2A_CALLER_PRIVATE_KEY` signing).

### T5.1 — A2A signs real EIP-3009 and task completes
**Trigger:** Run a2a-auto-caller.ts with real signing enabled (not demo_mode)
**Expected:**
- POST /api/tasks includes `payment_authorization` object (not `demo_mode: true`)
- Server verifies and settles income payment
- `client_type = 'agent'` stored in tasks table
- SSE stream drained: final `complete` event logged
- Income recorded in treasury_events

**Verify:**
```sql
SELECT id, task_type, client_type, status, income_tx_hash FROM tasks
WHERE client_type = 'agent' ORDER BY created_at DESC LIMIT 5;
-- client_type = 'agent'
-- income_tx_hash starts with 0x
```

### T5.2 — A2A contract_summary with real USYC address
**Task:** `"Summarize the USYC teller contract at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A"`
**Expected:** Same as T3b.1 but via A2A channel

### T5.3 — A2A general research
**Task:** `"Research current DeFi stablecoin yield strategies for idle treasury capital"`
**Expected:** Real Claude response (after #8 fix)

### T5.4 — A2A with callback_url
**Trigger:** POST /api/tasks with `callback_url: "https://webhook.site/{your-uuid}"`
**Expected:**
- Task completes via SSE
- POST fires to callback_url with `{ task_id, result, reasoning }`
- Webhook.site receives payload

### T5.5 — A2A callback_url with internal host rejected
**Trigger:** POST with `callback_url: "http://localhost:3000/evil"`
**Expected:** 400 "callback_url must be a public https URL"

### T5.6 — A2A rate limit (after #36 fix)
**Trigger:** Send 15 tasks in 1 minute from same payer_wallet
**Expected:** 11th+ request returns 429

---

## Suite 6 — MCP Channel

### T6.1 — estimate_task tool
**Call:** `estimate_task({ task_type: "wallet_intelligence" })`
**Expected:** `{ price_usdc: 0.50, estimated_cost_usdc: 0.015, margin_pct: "97.0%" }`

### T6.2 — get_treasury_status tool
**Call:** `get_treasury_status({})`
**Expected:** JSON with `usdc_balance`, `usyc_usdc_value`, `usyc_apy`, `total_tasks_completed`

### T6.3 — run_task requires payment_authorization (after #17 fix)
**Call:** `run_task({ task_type: "general", task_description: "test", payer_wallet: "0x..." })` without payment_authorization
**Expected:** Error response: "payment_authorization required" (code 402)

### T6.4 — run_task with valid payment_authorization
**Call:** `run_task({ ..., payment_authorization: {EIP3009 signed auth} })`
**Expected:**
- Task queued, SSE drained inside MCP handler
- Returns: "Task complete. Result: ... Net: $X USDC."
- `client_type = 'agent'` in DB

### T6.5 — MCP server name is solv-001 (after cosmetic fix)
**Verify:** MCP server announces `name: "solv-001"` not `"agent-treasury"`

---

## Suite 7 — Edge Cases + Rejection Paths

### T7.1 — Claude reasoning DEFER (treasury overloaded)
**Setup:** Set queue_depth artificially high or test with very low balance
**Expected:**
- Claude reasons and outputs `DECISION: DEFER`
- Task status = `'deferred'`
- SSE sends `{ type: "deferred", data: { task_id, reason } }`
- Client receives 200 with SSE (not 402)

### T7.2 — Claude reasoning REJECT (invalid task)
**Task:** Submit `task_type = "wallet_intelligence"` with task text that Claude deems unviable
**Expected:**
- Task status = `'rejected'`
- SSE sends `{ type: "rejected", data: { task_id, reason } }`

### T7.3 — max_tokens hit does NOT cause silent DEFER (after #2 fix)
**Verify:** If reasoning hits max_tokens, a warning is logged but the task is not auto-deferred with the generic "Reasoning incomplete" message

### T7.4 — Invalid task_type rejected immediately
**Trigger:** POST /api/tasks with `task_type: "make_me_rich"`
**Expected:** 400 `{ error: "Unknown task_type: 'make_me_rich'. Valid types: ..." }`

### T7.5 — Task text too long rejected (after #30 fix)
**Trigger:** POST with `task` field > 2000 characters
**Expected:** 400 `{ error: "task must be 2000 characters or fewer" }`

### T7.6 — Execution error results in 'failed' status (after #27 fix)
**Trigger:** Cause an execution error (e.g., Arc RPC times out with no fallback)
**Expected:**
- `tasks.status = 'failed'`
- `tasks.reasoning` contains the error message
- NOT `status = 'deferred'` (current wrong behavior)

### T7.7 — Zombie task cleanup SQL ran (one-time)
**Before tests:** Run the cleanup SQL:
```sql
UPDATE tasks SET status = 'deferred', reasoning = 'Timed out — serverless request expired'
WHERE status IN ('pending', 'reasoning', 'executing')
AND created_at < NOW() - INTERVAL '10 minutes';
```
**Verify:** `SELECT COUNT(*) FROM tasks WHERE status IN ('pending','reasoning','executing') AND created_at < NOW() - INTERVAL '10 minutes';` returns 0

### T7.8 — SSE stream closes cleanly on unmount (after #18 fix)
**Trigger:** Submit a task, then navigate away before it completes
**Expected:** No open reader dangling; next task submission creates a fresh SSE connection

### T7.9 — 402 returned when no payment_authorization and not demo mode
**Trigger:** POST /api/tasks with no `payment_authorization` field (demo mode off)
**Expected:** 402 response with `PAYMENT-REQUIRED` header containing base64 x402 payment requirements

---

## Verification Checklist — What "Passing" Looks Like

For each completed task, a full pass means:

```
[ ] tasks.status = 'complete'
[ ] tasks.income_tx_hash starts with '0x' and is 66 chars (not UUID, not null)
[ ] tasks.income_tx_hash resolves on Arc Explorer
[ ] tasks.expense_tx_hashes is a proper PostgreSQL array (not comma-separated string)
[ ] trace_events has 1+ nanopayment rows for the task
[ ] treasury_events has income + expense rows
[ ] tasks.cost_usdc > 0 (actual data service costs logged)
[ ] tasks.net_usdc = income_usdc - cost_usdc (positive margin)
[ ] tasks.result is a real answer (not a hardcoded template)
[ ] tasks.client_type = 'human' | 'agent' (correct classification)
```

---

## Test Execution Order

```
Phase 0 — Run zombie cleanup SQL
Phase 1 — Verify prerequisites (env vars, wallet funded, chain accessible)
Phase 2 — Suite 1 (income gate) — must pass before anything else is meaningful
Phase 3 — Suite 2 (expense payments) — verify data-service x402 works independently
Phase 4 — Suite 3 (each task type) — full end-to-end per task
Phase 5 — Suite 7 (edge cases) — verify rejection paths
Phase 6 — Suite 4 (USYC) — T4.1 now; T4.2–T4.4 after allowlist
Phase 7 — Suite 5 (A2A) — after P0 + #16 fixes
Phase 8 — Suite 6 (MCP) — after #17 fix
```
