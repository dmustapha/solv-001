# Feature Observables — solv-001
<!-- File: /Users/MAC/agora-agents/solv-001/FEATURE-OBSERVABLES.md -->
<!-- Generated: 2026-05-19 | Phase 4C-4 -->

Each observable is a verifiable test that proves the feature works, not just that it exists.

---

## F-001 — Task Payment Gate (P0)

**Feature:** 402 Nanopayments gate on POST /api/tasks — no valid EIP-3009 auth = rejected
**Observable:** Request without payment_authorization returns HTTP 402 (not 200, not 500)
**Test command:**
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://<DEPLOYED_URL>/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"task":"test","task_type":"research","payer_wallet":"0x1234000000000000000000000000000000000000"}'
```
**Expected output:** `402`
**Sentinel fail:** Response is `200` (gate bypassed) or `500` (implementation error)
**Verified by:** `test_payment_gate_rejects_missing_auth`

---

## F-002 — Treasury Reasoning Claude Decision (P0)

<!-- [CRITIQUE E-5] Fixed decision type: was BUY/SELL/DEFER/REJECT, correct type is ACCEPT/DEFER/REJECT per src/types/index.ts -->
**Feature:** Claude produces ACCEPT/DEFER/REJECT decision with reasoning text (not a fallback stub)
**Observable:** `decision.decision` field is one of "ACCEPT", "DEFER", or "REJECT", and `decision.reasoning` is non-empty and does NOT match `/(unavailable|fallback|mock|error)/i`
**Test command:**
```bash
curl -s https://<DEPLOYED_URL>/api/treasury/status | jq '.last_decision' | \
  jq 'select(.decision == "ACCEPT" or .decision == "DEFER" or .decision == "REJECT") | .reasoning' | \
  grep -vEi 'unavailable|fallback|mock|error' | head -c 100
```
**Expected output:** Non-empty reasoning text (e.g., `"Current balance 5.20 USDC exceeds...`)
**Sentinel fail:** `decision` is not one of ACCEPT/DEFER/REJECT, `reasoning === null`, `reasoning === "Claude API unavailable"`, or pattern match
**Verified by:** `test_treasury_reasoning_produces_real_decision`

---

## F-003 — Task Execution Generates Real Nanopayment Expense (P0)

**Feature:** Every executed task records at least one Nanopayment expense with a real Arc tx hash
**Observable:** Completed task record has `arc_tx_hash` that is non-null and does NOT equal `0x0`
**Test command:**
```bash
curl -s "https://<DEPLOYED_URL>/api/tasks?limit=1&status=completed" | \
  jq '.[0].arc_tx_hash' | grep -v '"0x0"' | grep -v 'null'
```
**Expected output:** `"0x<64-hex-chars>"`
**Sentinel fail:** `arc_tx_hash === "0x0"` (demo bypass never replaced) or `arc_tx_hash === null`
**Verified by:** `test_task_completion_has_arc_tx`

---

## F-004 — Circle Wallet Balance Is Live (P0)

**Feature:** Treasury status returns a real Circle developer-controlled wallet balance (not a hardcoded number)
**Observable:** `balance_usdc` changes after a payment is received (before ≠ after)
**Test command:**
```bash
BEFORE=$(curl -s https://<DEPLOYED_URL>/api/treasury/status | jq '.balance_usdc')
# submit a paid task, then:
AFTER=$(curl -s https://<DEPLOYED_URL>/api/treasury/status | jq '.balance_usdc')
echo "Before: $BEFORE  After: $AFTER"
[ "$BEFORE" != "$AFTER" ] && echo "PASS" || echo "FAIL — balance did not change"
```
**Expected output:** `PASS` (balance after > balance before)
**Sentinel fail:** `balance_usdc === 0` always, or before === after after confirmed payment
**Verified by:** `test_circle_wallet_balance_updates_on_payment`

---

## F-005 — USYC APY Read Works Without Allowlisting (P0)

**Feature:** Treasury status always shows a non-zero USYC APY read from the Teller contract
**Observable:** `usyc_apy_bps` > 0 in treasury status response
**Test command:**
```bash
curl -s https://<DEPLOYED_URL>/api/treasury/status | jq '.usyc_apy_bps'
```
**Expected output:** Integer > 0 (e.g., `485` for 4.85% APY)
**Sentinel fail:** `usyc_apy_bps === 0` or `usyc_apy_bps === null` (Teller ABI or RPC failed)
**Verified by:** `test_usyc_apy_reads_from_teller`

---

## F-006 — USYC Idle Sweep Runs or Skips Gracefully (P1)

**Feature:** Completed tasks trigger USYC sweep attempt; if not allowlisted, error is swallowed silently
**Observable:** Task execution completes (status === "completed") even when sweep throws; no 500 in task response
**Test command:**
```bash
# With USYC_ALLOWLISTED=false in env
curl -s -X POST https://<DEPLOYED_URL>/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-Payment-Authorization: <valid_auth>" \
  -d '{"task":"test","task_type":"research","payer_wallet":"<wallet>"}' | jq '.status'
```
**Expected output:** `"queued"` or `"completed"` (never `"failed"` due to sweep error)
**Sentinel fail:** Response contains `"USYC sweep failed"` error bubbled to caller
**Verified by:** `test_usyc_sweep_fails_silently_when_not_allowlisted`

---

## F-007 — Live SSE Trace Streams Real Claude Reasoning (P0)

**Feature:** POST /api/tasks returns a ReadableStream that emits reasoning tokens in real time
**Observable:** SSE stream contains at least 3 distinct `data:` events before the `[DONE]` sentinel
**Test command:**
```bash
curl -s -N -X POST https://<DEPLOYED_URL>/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-Payment-Authorization: <valid_auth>" \
  -d '{"task":"test","task_type":"research","payer_wallet":"<wallet>"}' | \
  grep "^data:" | head -5
```
**Expected output:** 3+ lines matching `^data:` with non-empty JSON payloads
**Sentinel fail:** Single `data: [DONE]` with no preceding events (streaming not working)
**Verified by:** `test_sse_stream_emits_reasoning_tokens`

---

## F-008 — A2A Agent Discovery via agent.json (P1)

**Feature:** /.well-known/agent.json is publicly accessible and contains required A2A fields
**Observable:** GET /.well-known/agent.json returns 200 with JSON containing `name`, `capabilities`, `wallet_address`, and `task_endpoint`
**Test command:**
```bash
curl -s https://<DEPLOYED_URL>/.well-known/agent.json | \
  jq 'select(.name != null and .capabilities != null and .wallet_address != null and .task_endpoint != null) | "PASS"'
```
**Expected output:** `"PASS"`
**Sentinel fail:** 404, or any required field is null/missing
**Verified by:** `test_agent_card_accessible_and_valid`

---

## F-009 — MCP Server Exposes Tool Calls (P1)

**Feature:** MCP server accepts initialize and tools/list via HTTP/SSE transport
**Observable:** POST /mcp with `{"jsonrpc":"2.0","method":"tools/list","id":1}` returns tool list containing `submit_task`
**Test command:**
```bash
curl -s -X POST https://<DEPLOYED_URL>/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' | \
  jq '.result.tools[].name' | grep "submit_task"
```
**Expected output:** `"submit_task"`
**Sentinel fail:** 404, method not found, or `submit_task` absent from tool list
**Verified by:** `test_mcp_tools_list_includes_submit_task`

---

## F-010 — Spend Limit Enforcement (P0)

**Feature:** Task executions above `MAX_TASK_EXPENSE_USDC` are rejected before any external call
**Observable:** Requesting a task type priced above the limit returns HTTP 402 with `max_expense_exceeded` reason
**Test command:**
```bash
# Set MAX_TASK_EXPENSE_USDC=0.001 temporarily, attempt a research task priced at 0.02
curl -s -o /dev/null -w "%{http_code}" -X POST https://<DEPLOYED_URL>/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-Payment-Authorization: <valid_auth>" \
  -d '{"task":"expensive","task_type":"execution","payer_wallet":"<wallet>"}'
```
**Expected output:** `402`
**Sentinel fail:** `200` (limit not enforced) or task executes and bills external API
**Verified by:** `test_spend_limit_rejects_over_max`

---

## F-011 — arc-canteen CLI Responds to Agent Commands (P0)

**Feature:** arc-canteen CLI spawned from Task Execution Engine returns real Arc data (not empty/error)
**Observable:** Running `arc-canteen wallet-info <TEST_ADDRESS>` via the API returns JSON with `balance` field
**Test command:**
```bash
curl -s -X POST https://<DEPLOYED_URL>/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-Payment-Authorization: <valid_auth>" \
  -d '{"task":"Check wallet balance of 0x3600000000000000000000000000000000000000","task_type":"research","payer_wallet":"<wallet>"}' | \
  jq '.result' | grep -i "balance"
```
**Expected output:** Result string containing `balance` keyword from arc-canteen output
**Sentinel fail:** Result is `null`, `"arc-canteen not found"`, or `"command failed"`
**Verified by:** `test_arc_canteen_integration_returns_data`
