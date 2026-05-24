# solv-001 — Testing Plan v3

**Target:** https://solv-001.vercel.app
**Chain:** Arc Testnet (chainId: 5042002 / 0x4cef52)
**USDC contract:** `0x3600000000000000000000000000000000000000`
**Agent wallet:** `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`
**Agent USDC balance at plan time:** $19.65 (confirmed via /api/treasury 2026-05-24)
**Baseline:** v2 plan all passed; v1 plan 107/107

---

## What's New Since v2

These features did NOT exist in v2 and need full test coverage:

1. **Dashboard UI machine** — card grid → composing → loading → complete/terminal/error → viewing overlay
2. **Wallet persistence** — localStorage + silent `eth_accounts` reconnect on reload
3. **Wallet-filtered history** — each user sees only their own tasks (by payer_wallet)
4. **Clickable history rows** — load full task result + trace from DB overlay
5. **TaskResultView adaptive rendering** — short/sectioned/long text display variants
6. **ACCEPT/DEFER/REJECT decision badge** — rgba colors (not CSS variable hex-alpha)
7. **Deferred task result persistence** — watch/scheduled result stored before deferTask()
8. **isJsonBlob guard** — JSON state blobs suppressed in history snippets
9. **Status label overrides** — "monitoring" (blue) for wallet/contract watch; "scheduled" (violet) for scheduled types
10. **/status page** — global view, non-clickable rows, TreasuryPanel + TaskHistoryPanel
11. **Multi-chain wallet intelligence** — 5 mainnet chains queried in parallel
12. **Transaction links on dashboard** — income/expense Arc Explorer links in history rows

**Regression baseline:** v2 plan (100+ cases) — all must still pass.

---

## Budget Check

At $19.65 USDC with ~5 paid task runs at $0.30–$0.75 each:
- 5 tasks x $0.75 max = $3.75 max spend
- Safe margin: $15+ remaining after all tests
- USDC balance is NOT a constraint for this test run

---

## Section N1 — Dashboard UI Machine

Tests the 7-state UI flow introduced in the dashboard redesign.

### N1.1 — Idle state: card grid visible without wallet
**Setup:** Fresh browser, no wallet connected, navigate to /dashboard
**Expected:**
- 8 task type cards visible in 2-column grid
- Each card shows task name, price ($0.10–$0.75), and description
- Cards are disabled/dimmed: hint text says "Connect wallet to use"
- No textarea visible
**Verify:** DOM has 8 card buttons. No `<textarea>` in DOM.

### N1.2 — Idle → composing: card click shows textarea
**Setup:** Wallet connected on Arc Testnet
**Action:** Click "Wallet Intelligence" card
**Expected:**
- Task type cards hidden
- Textarea appears with placeholder specific to wallet_intelligence
- Back button (←) visible in header area
- Price shown in composing header ("$0.50")
- Textarea has focus (cursor blinking)
**Verify:** State = "composing". `<textarea>` has `autoFocus` applied.

### N1.3 — Composing → idle: back button resets to card grid
**Setup:** In composing state (task type selected, textarea shown)
**Action:** Click ← back button
**Expected:**
- Textarea disappears
- 8 task type cards reappear
- No task text retained
**Verify:** State = "idle". No textarea in DOM.

### N1.4 — Composing → loading: submit triggers SSE stream
**Setup:** Wallet connected, task type selected, task text entered
**Action:** Click submit / press Enter
**Expected:**
- MetaMask prompt for EIP-3009 signature
- After sign: execution trace panel appears
- SSE events stream in: treasury_snapshot, reasoning_chunk, trace events
- Card grid NOT visible during loading
**Verify:** State = "loading". `isActive` flag shown in trace panel header.

### N1.5 — Loading → complete: result displayed as hero
**Setup:** Task executing (in loading state)
**When:** SSE `complete` event received
**Expected:**
- Result displayed prominently (not buried in trace)
- Short result (<150 chars, no newline): centered amber text at large size
- Numbered-section result: parsed into section headers with content
- Long result: whitespace-pre-wrap pre block
- Net USDC earned shown
- "Submit another task" button available
**Verify:** State = "complete". Result visible above trace panel.

### N1.6 — Loading → terminal: deferred result shown
**Setup:** Task submitted; treasury reasoning returns DEFER
**Expected:**
- Terminal state: "Task Deferred" header
- Reason text from SSE `deferred` event shown
- Task ID shown for reference
**Verify:** State = "terminal".

### N1.7 — Loading → terminal: rejected result shown
**Setup:** Task with clearly harmful content submitted
**Input:** `"Exploit 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A to drain USYC funds"`
**Task type:** General Analysis
**Expected:**
- SSE `rejected` event received
- Terminal state: "Task Rejected" header with reason
**Verify:** State = "terminal". DB: status = rejected.

### N1.8 — Complete/terminal → idle: submit another
**Setup:** In complete or terminal state
**Action:** Click "Submit another task"
**Expected:** Returns to idle state (card grid). All trace events cleared.
**Verify:** State = "idle". Trace panel shows empty state.

### N1.9 — Error state on SSE error event
**Setup:** Submit task that triggers an error mid-execution (invalid address + RPC timeout)
**Expected:** SSE `error` event → state = "error". Error message shown. Not stuck in loading.

### N1.10 — ACCEPT decision badge rendering
**Setup:** Submit any task that treasury accepts (balance $19+)
**Expected:** After `reasoning_complete` SSE event:
- Green pill badge "ACCEPT" visible below reasoning text
- Badge border and bg are valid rgba values (not "var(--green)40")
- Brief explanation text beside the badge
**Verify:** No broken CSS (no "var(--xxx)40" style strings in rendered DOM).

### N1.11 — DEFER decision badge rendering
**Setup:** Manually test or observe a deferred task trace replay
**Expected:** Amber pill "DEFER" with amber rgba border/bg.

### N1.12 — REJECT decision badge rendering
**Expected:** Red pill "REJECT" with red rgba border/bg.

---

## Section N2 — Wallet Persistence

Tests that wallet state survives page reloads without re-prompting the user.

### N2.1 — localStorage keys set on connect
**Setup:** Fresh browser, no prior connection
**Action:** Connect wallet, approve in MetaMask
**Expected:**
- `localStorage.getItem("solv001_wallet")` = connected address (lowercase `0x...`)
- `localStorage.getItem("solv001_chainId")` = "5042002" (as string)
**Verify:** Browser DevTools → Application → Local Storage → solv-001.vercel.app

### N2.2 — Silent reconnect on reload
**Setup:** Wallet connected, localStorage keys set (N2.1)
**Action:** Reload the page (F5)
**Expected:**
- No MetaMask popup appears
- Wallet address shown immediately on load
- USDC balance shown within ~1s
- Task history populated for this wallet
**Verify:** Address visible without any user action. DevTools: no `wallet_requestAccounts` call.

### N2.3 — localStorage cleared on disconnect
**Setup:** Wallet connected
**Action:** Disconnect wallet (click disconnect or revoke in MetaMask)
**Expected:**
- `solv001_wallet` removed from localStorage
- `solv001_chainId` removed from localStorage
- UI shows "Connect Wallet" state
- Task history shows "Connect wallet to see your history"

### N2.4 — accountsChanged event triggers update
**Setup:** Wallet A connected
**Action:** Switch to wallet B in MetaMask (no page reload)
**Expected:**
- Address updates in UI immediately
- USDC balance updates to wallet B's balance
- Task history refreshes to show wallet B's tasks
- localStorage updated to wallet B's address

### N2.5 — chainChanged event triggers update
**Setup:** On Arc Testnet
**Action:** Switch to Ethereum Mainnet in MetaMask
**Expected:**
- UI detects wrong chain
- "Switch to Arc Testnet" prompt appears
- Task submission disabled

### N2.6 — Wrong chain on reload
**Setup:** localStorage has Arc chainId, but MetaMask switched to mainnet since last session
**Action:** Reload
**Expected:** Silent reconnect succeeds but chain mismatch UI shown. User prompted to switch.

### N2.7 — walletRef stale closure: interval always reads current wallet
**Setup:** Connect wallet A, wait for first task fetch interval (15s)
**Action:** Mid-interval, switch to wallet B
**Expected:** Next interval fetch hits `/api/tasks?wallet=<walletB>` not walletA
**Verify:** Network tab: task fetch URL contains wallet B's address after switch.

---

## Section N3 — Wallet-Filtered History

Tests that each user only sees their own tasks.

### N3.1 — History empty state for new wallet
**Setup:** Connect wallet that has never submitted a task
**Expected:** "No tasks yet" empty state shown in history panel
**Verify:** GET /api/tasks?wallet=<address> returns empty array.

### N3.2 — History shows only this wallet's tasks
**Setup:** Connect wallet A, which has 3 past tasks
**Expected:** Exactly 3 tasks shown in history (not 200+ global tasks)
**Verify:** All shown tasks have payer_wallet = wallet A's address.

### N3.3 — History updates after task completion
**Setup:** Wallet connected with N existing tasks
**Action:** Submit and complete one task
**Expected:** History panel shows N+1 tasks after completion
**Verify:** 15s poll or immediate refetch shows new task.

### N3.4 — No wallet: history shows "Connect wallet" state
**Setup:** No wallet connected
**Expected:** History panel shows "Connect wallet to see your history" message
**Not expected:** Empty array state or "No tasks yet"

### N3.5 — GET /api/tasks?wallet= filters correctly
```bash
curl "https://solv-001.vercel.app/api/tasks?wallet=0xYourAddress"
```
**Expected:** Only tasks where `payer_wallet = 0xYourAddress`.
**Verify:** All returned tasks match the wallet filter.

### N3.6 — GET /api/tasks (no wallet param) returns global list
```bash
curl "https://solv-001.vercel.app/api/tasks"
```
**Expected:** Up to 50 most recent tasks from all wallets (global view used by /status page).

---

## Section N4 — Clickable History Rows + Viewing Overlay

Tests that clicking a history item loads the full result and trace.

### N4.1 — Click task row opens overlay
**Setup:** Wallet connected, at least 1 completed task in history
**Action:** Click a task row in history
**Expected:**
- Overlay panel opens (ViewingOverlay)
- Full task result shown (not truncated snippet)
- Full trace events loaded from DB
- TaskResultView renders result adaptively
**Verify:** Network request to `GET /api/tasks/{taskId}` fired on click.

### N4.2 — Overlay shows trace events for historical task
**Setup:** Task with 3 nanopayment trace events
**Action:** Click that task in history
**Expected:** All 3 trace events visible in overlay (not just those from current session)
**Verify:** Trace events fetched from DB, not from in-memory SSE stream state.

### N4.3 — Overlay shows correct status label
**Setup:** A task with status "deferred" and task_type "wallet_watch"
**Action:** Click it in history
**Expected:** Status label shows "monitoring" (blue) in overlay, not "deferred" (amber)

### N4.4 — Overlay close button works
**Setup:** Overlay open
**Action:** Click close / X button
**Expected:** Overlay closes. Dashboard returns to previous state (idle/complete).

### N4.5 — History rows on /status have no click affordance
**Navigate to:** https://solv-001.vercel.app/status
**Expected:**
- All task rows visible (global view)
- No cursor-pointer on hover
- No background change on hover
- Clicking does nothing (no overlay opens)
**Verify:** `onClick` prop is undefined on TaskRow when globalView=true.

---

## Section N5 — TaskResultView Adaptive Rendering

Tests the three rendering modes of the result component.

### N5.1 — Short result: centered amber hero text
**Trigger:** Submit task that returns a result < 150 chars with no newline
**Example result:** "Contract 0x9fdF... is an EOA, not a contract."
**Expected:** Result shown centered, amber color, large font (~18px), no scroll
**Verify:** CSS `text-align: center` and `color: var(--amber)` applied.

### N5.2 — Numbered section result: headers parsed
**Trigger:** Submit wallet_intelligence task (result typically has numbered sections)
**Example result:**
```
1. Transaction History: 45 transactions found...
2. Risk Assessment: Low risk...
3. DeFi Interactions: None detected...
```
**Expected:** Each numbered line rendered as a section header (bold/colored) with body text below
**Verify:** Regex `/^(\d+\.\s+[A-Z][A-Za-z\s]+:)/m` matches; DOM has section structure.

### N5.3 — Long plain text result: whitespace-pre-wrap
**Trigger:** Submit general task with a long free-form answer
**Expected:** Result in a `<pre>` or `whitespace-pre-wrap` block, scrollable if needed
**Not expected:** Text overflows container or wraps poorly.

### N5.4 — Result=null + JSON reasoning: "Monitoring Active" badge
**Setup:** Watch task with result set but reasoning is JSON state blob
**Expected:** History row shows no snippet (isJsonBlob guard fires); overlay shows monitoring status badge
**Verify:** No raw JSON visible to user anywhere.

### N5.5 — Result=null + text reasoning: italic agent reasoning
**Setup:** Task where result is null but reasoning is readable text
**Expected:** Overlay shows reasoning in italic as fallback display
**Not expected:** "No result available" when reasoning has content.

### N5.6 — No result, no readable reasoning: fallback message
**Expected:** "No result available" shown in overlay. No crash.

---

## Section N6 — Deferred Task Result Persistence

Verifies that watch/scheduled tasks have a usable result stored in DB before being deferred.

### N6.1 — wallet_watch result stored before defer
**Task:** `Watch wallet 0xBd3fa81B58Ba92a82136038B25aDec7066af3155 for any outbound transfers`
**Task type:** Wallet Watch ($0.10)
**Expected:**
- Task SSE stream receives `deferred` event (not `complete`)
- `tasks.status = 'deferred'` in DB
- `tasks.result` is NOT null — contains something like: "Monitoring wallet 0xBd3fa81B58Ba92a82136038B25aDec7066af3155. Baseline: N transactions on Arc testnet. Checked daily — new activity will trigger an alert."
**Verify:**
```sql
SELECT result, status FROM tasks
WHERE task_type = 'wallet_watch' ORDER BY created_at DESC LIMIT 1;
-- result must NOT be null
-- status must be 'deferred'
```

### N6.2 — contract_watch result stored before defer
**Task:** `Monitor contract 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A for Deposit events`
**Task type:** Contract Watch ($0.10)
**Expected:** Same as N6.1 — result field contains monitoring confirmation text

### N6.3 — scheduled_disbursement result stored before defer (future date)
**Task:** `Send $0.01 USDC to 0x000000000000000000000000000000000000dEaD in 24 hours`
**Task type:** Scheduled Disbursement ($0.20)
**Expected:**
- Claude parses future date, defers task
- `tasks.result` contains: "Scheduled: send $0.01 USDC to 0x...dEaD at [time]. Will execute via daily cron."
**Verify:** result NOT null before deferring.

### N6.4 — Watch task result visible in history row snippet
**Setup:** wallet_watch task from N6.1 in history
**Expected:** History row shows truncated result snippet (the monitoring confirmation text, not JSON state)
**Not expected:** JSON blob like `{"baseline_tx_count":N,"address":"0x..."}` shown as snippet

### N6.5 — Watch task shows "monitoring" label in history
**Setup:** wallet_watch or contract_watch task (deferred)
**Expected:** Status label in history row = "monitoring" (blue dot), not "deferred" (amber dot)

### N6.6 — Scheduled task shows "scheduled" label in history
**Setup:** scheduled_disbursement or conditional_payment task (deferred)
**Expected:** Status label = "scheduled" (violet dot)

---

## Section N7 — /status Page

### N7.1 — /status page loads correctly
**Navigate to:** https://solv-001.vercel.app/status
**Expected:**
- Left panel: TreasuryPanel with live treasury data
- Right panel: "All Tasks" global task history (not "Your Tasks")
- "← Dashboard" nav link in header
- "LIVE" green pulse dot in header
**Verify:** Page title/label says "Agent Status · All Wallets"

### N7.2 — Treasury panel shows all fields
**Expected fields visible:**
- USDC balance (should be ~$19.65)
- USYC balance
- USYC APY (should show ~4.85%)
- Operating reserve
- Total tasks completed (should be ~200)
- Total all-time income
**Verify:** All values non-null. usyc_apy > 0.

### N7.3 — Global task list on /status (all wallets)
**Expected:**
- Task list shows tasks from multiple different payer_wallet addresses
- No wallet filter applied (uses global /api/tasks)
- Tasks from all users visible
**Verify:** Network request to `/api/tasks` (no `?wallet=` param).

### N7.4 — /status task rows not clickable
**Action:** Hover over a task row on /status page
**Expected:** No background color change on hover; cursor stays default (not pointer)
**Action:** Click a task row
**Expected:** Nothing happens (no overlay, no navigation)

### N7.5 — /status polling intervals
**Expected:**
- TreasuryPanel refreshes every 10s
- Task list refreshes every 15s
**Verify:** Network tab: `/api/treasury` requests every 10s; `/api/tasks` every 15s.

### N7.6 — /status "← Dashboard" link navigates correctly
**Action:** Click "← Dashboard"
**Expected:** Navigates to /dashboard. Back browser button returns to /status.

### N7.7 — /dashboard "Agent Status →" link visible and works
**Navigate to:** /dashboard
**Expected:** "Agent Status →" link visible in header (hidden on small screens: `hidden sm:block`)
**Action:** Click it → navigates to /status

---

## Section N8 — Multi-Chain Wallet Intelligence

Tests that wallet_intelligence queries 5 mainnet chains in parallel.

### N8.1 — Multi-chain result includes all chains
**Task:** `Full intelligence profile of wallet 0xBd3fa81B58Ba92a82136038B25aDec7066af3155`
**Task type:** Wallet Intelligence ($0.50)
**Expected result includes references to at least:**
- Ethereum (or "mainnet")
- Base
- Arbitrum
- Optimism
- Polygon
**Or:** Summary table showing per-chain tx counts

### N8.2 — Multi-chain handles chain timeout gracefully
**Verify:** If one chain's RPC is slow/down, the other 4 chains still complete
**Expected:** Result shows partial data with note about unavailable chain, not a full task failure

### N8.3 — Multi-chain result is richer than single-chain
**Compare:** wallet_intelligence result vs a simple Arc-only trace
**Expected:** More comprehensive analysis mentioning DeFi patterns across chains

### N8.4 — Multi-chain uses Promise.allSettled (no all-or-nothing failure)
**Verify via result:** No "failed to fetch chain data" error when 1 of 5 chains is slow
**Mechanism:** Code uses `Promise.allSettled` so individual failures don't propagate

---

## Section N9 — Transaction Links on Dashboard

Tests income/expense Arc Explorer links in task history rows.

### N9.1 — Completed task shows "income ↗" link
**Setup:** A completed task with real income_tx_hash (not demo mode)
**Expected in history row:** "income ↗" link in green, linking to `https://explorer.arcnetwork.xyz/tx/{hash}`
**Verify:** `isArcTxHash(income_tx_hash)` = true for 0x-prefixed 66-char hashes

### N9.2 — Task with expense shows "expense ↗" link(s)
**Setup:** A completed task with expense_tx_hashes array populated
**Expected:** "expense ↗" link in amber for each expense hash (up to 2 shown)

### N9.3 — Demo mode tasks show no tx links
**Setup:** A task completed in demo mode (income_tx_hash is demo or null)
**Expected:** No income/expense links shown (isArcTxHash returns false for non-0x hashes)

### N9.4 — Arc Explorer link click doesn't navigate away (stops propagation)
**Setup:** History row with income link, row is clickable (not globalView)
**Action:** Click "income ↗" link
**Expected:** Opens in new tab; does NOT trigger row click (overlay does not open)
**Verify:** `e.stopPropagation()` fires on link container click.

### N9.5 — /status page also shows tx links
**Navigate to:** /status
**Expected:** Completed tasks with tx hashes show income/expense links (same as dashboard)

---

## Section N10 — SSE Stream + New UI State Integration

Tests that SSE events drive UI state correctly in the new architecture.

### N10.1 — treasury_snapshot arrives first, displays in trace
**Expected:** First SSE event = treasury_snapshot. Trace panel shows treasury context.

### N10.2 — reasoning_chunk events stream progressively
**Expected:** Each chunk appends to reasoning block. Cursor blink visible during streaming.
**Verify:** Multiple `reasoning_chunk` events visible in Network tab as they arrive.

### N10.3 — reasoning_complete shows decision badge
**Expected:** After all chunks, `reasoning_complete` event arrives with `{ decision, explanation }`
**UI:** Decision badge appears immediately. Cursor blink disappears.

### N10.4 — complete event triggers state transition
**Expected:** On `complete` SSE event:
- State changes from "loading" to "complete"
- Result stored in `activeResult` state
- TaskResultView renders result
- Net USDC shown

### N10.5 — deferred event triggers terminal state
**Expected:** On `deferred` SSE event:
- State changes to "terminal"
- terminalData populated with { task_id, reason }
- Terminal UI shows deferral info

### N10.6 — error event triggers error state
**Expected:** On `error` SSE event:
- State changes to "error"
- Error message displayed
- "Try again" option available

### N10.7 — Double fetch prevention: no duplicate task requests on mount
**Setup:** Wallet connected, page loads
**Expected:** Only ONE `/api/tasks?wallet=...` request fired on initial load (not two)
**Verify:** Network tab shows single initial fetch (interval useEffect does not duplicate it)

---

## Section N11 — Regression: Core Flow (from v2 baseline)

Key regression checks to ensure new code didn't break old behavior.

### RG.1 — 402 without payment auth still works
```bash
curl -X POST https://solv-001.vercel.app/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"task":"test","task_type":"general","payer_wallet":"0x1234"}'
```
**Expected:** HTTP 402 with x402 payment details in body.

### RG.2 — /api/treasury returns valid state
```bash
curl https://solv-001.vercel.app/api/treasury
```
**Expected:** All fields populated. `usdc_balance` > 0. `usyc_apy` = 0.0485.

### RG.3 — /api/agent-card returns 8 task types
```bash
curl https://solv-001.vercel.app/api/agent-card
```
**Expected:** All 8 task types with prices and descriptions.

### RG.4 — MCP tools/list returns 3 tools
```bash
curl -X POST https://solv-001.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```
**Expected:** `run_task`, `get_treasury_status`, `estimate_task` — exactly 3.

### RG.5 — Data service demo mode all 5 endpoints
```bash
for ep in transaction-count contract-interactions token-transfers contract-code general-research; do
  curl -s "https://solv-001.vercel.app/api/data-service/$ep?address=0x9fdF14c5B14173D74C08Af27AebFf39240dC105A&demo=true" | head -c 200
  echo
done
```
**Expected:** All 5 return HTTP 200 with demo data.

### RG.6 — /proof page loads
```bash
curl https://solv-001.vercel.app/proof
```
**Expected:** 200. Agent wallet address shown. Payment ledger visible.

### RG.7 — Rate limit (429 on 6th request in 60s)
**Setup:** Send 5 valid paid requests from same wallet. Send 6th.
**Expected:** 6th returns 429.

### RG.8 — Zombie task cleanup on GET /api/tasks
**Expected:** `cleanupZombieTasks()` fires on each GET /api/tasks. Any stuck `executing` tasks > 10 min old become `failed`.

### RG.9 — task status progresses correctly in DB
**Action:** Submit a task and poll GET /api/tasks/{id} every 2s
**Expected status sequence:** pending → reasoning → executing → complete (or deferred/rejected)

### RG.10 — client_type stored correctly
- Submit via UI (no `client_type` in body) → DB shows `client_type = 'human'`
- Submit via curl with `"client_type": "agent"` → DB shows `client_type = 'agent'`

---

## Section N12 — Full End-to-End Paid Tasks (v3 specific)

One full real paid run for each key task type to validate the new implementation:

### E2E.1 — general (baseline cheapest task)
**Task:** `Compare the yield risk of USYC vs USDC for an AI treasury agent. Include liquidity concerns.`
**Price:** $0.30
**Verify:**
- SSE stream: treasury_snapshot → reasoning_chunk* → reasoning_complete (ACCEPT) → trace → complete
- Decision badge: ACCEPT in green
- Result: real Claude answer (not hardcoded template)
- History row appears after completion with correct snippet
- `income_tx_hash` in DB (real or demo depending on wallet)
- `net_usdc > 0`

### E2E.2 — wallet_intelligence (multi-chain test)
**Task:** `Full intelligence profile of 0xBd3fa81B58Ba92a82136038B25aDec7066af3155 — cross-chain activity, DeFi exposure, and risk classification`
**Price:** $0.50
**Verify:**
- Result mentions multiple chains
- 3 trace expense events (Arc RPC data service calls)
- History row shows "Wallet Intelligence" type label
- Result is sectioned (numbered sections → header rendering)

### E2E.3 — wallet_watch (deferred persistence test)
**Task:** `Watch wallet 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A for any new transactions on Arc Testnet`
**Price:** $0.10
**Verify:**
- SSE `deferred` event received
- State = "terminal" (deferral shown in UI)
- History row label = "monitoring" (blue), NOT "deferred" (amber)
- DB: `result IS NOT NULL` — monitoring confirmation text stored
- DB: `status = 'deferred'`
- History row snippet = monitoring text, NOT JSON blob

### E2E.4 — contract_summary (EOA vs contract detection)
**Task a (contract):** `Summarize contract 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A — is it safe for a treasury to interact with?`
**Task b (EOA):** `Summarize contract 0x000000000000000000000000000000000000dead`
**Price:** $0.75 each
**Verify task a:**
- `is_contract: true` in data-service response
- Result: contract analysis
- Bytecode length > 2
**Verify task b:**
- Result: "Address ... is an EOA, not a contract"
- No bytecode analysis attempted

---

## Section N13 — SSRF / Security Regression

### S.1 — SSRF callback_url blocked (internal hosts)
All must return 400:
```
http://localhost:3000/evil
https://127.0.0.1/webhook
https://192.168.1.1/data
https://10.0.0.1/steal
https://169.254.254.169/metadata
```

### S.2 — Valid public HTTPS callback accepted
`https://webhook.site/<uuid>` → accepted (task proceeds)

### S.3 — Malformed JSON body → 400 (no crash)

### S.4 — Unknown task_type → 400 (no crash)

### S.5 — Task text > 2000 chars → 400

---

## Test Execution Order

To avoid rate-limit collisions and ensure proper state:

**Phase 0 — No-cost smoke tests (no paid calls)**
- N7.1–N7.7 (status page)
- RG.1, RG.2, RG.3, RG.4, RG.5, RG.6 (regression curl checks)
- S.1–S.5 (security checks)
- N1.1 (idle state visual check)

**Phase 1 — Wallet + UI state tests (browser)**
- N1.2–N1.9 (UI machine — no payment needed for UI checks)
- N2.1–N2.7 (wallet persistence — one wallet connect)
- N3.1–N3.4 (history states — pre-payment)

**Phase 2 — First paid task: E2E.1 (general $0.30)**
- E2E.1 (observe full SSE flow, decision badge, history update)
- N1.10–N1.12 (verify badge rendering from E2E.1 result)
- N3.3 (history updates after completion — confirm from E2E.1)
- N10.1–N10.7 (SSE events — verify from E2E.1 stream)
- N9.1–N9.3 (tx links — check history row from E2E.1)
- N5.1–N5.3 (result rendering modes)
- N4.1–N4.5 (click row overlay)

**Phase 3 — Wallet watch task: E2E.3 ($0.10)**
- E2E.3 (deferred task)
- N6.1, N6.4, N6.5 (deferred persistence + label)
- N1.6 (terminal state)
- N5.4 (isJsonBlob guard)

**Phase 4 — Wallet intelligence: E2E.2 ($0.50)**
- E2E.2 (multi-chain)
- N8.1–N8.4 (multi-chain checks)
- N5.2 (numbered section rendering)

**Phase 5 — Contract summary: E2E.4a + E2E.4b ($0.75 x2)**
- E2E.4a + E2E.4b (contract vs EOA)
- N3.2 (wallet-filtered history now has 5 tasks)
- N9.4 (stop propagation on tx link click)

**Phase 6 — Edge cases + regression**
- RG.7 (rate limit — 5 rapid calls then 429)
- RG.8–RG.10
- N3.5–N3.6 (API filter verification)
- N6.2, N6.3, N6.6 (contract_watch + scheduled defer labels)
- N7.3–N7.5 (/status polling verification)
- N11 regression checks (confirm nothing broke)

---

## Pass/Fail Criteria

For each test:
- **PASS:** Expected behavior observed exactly
- **WARN:** Minor deviation, not blocking (note and continue)
- **FAIL:** Expected behavior NOT observed — document exact actual behavior + stop if P0

**P0 blockers (stop testing immediately):**
- Payment gate broken (no 402 returned without auth)
- SSE stream not starting
- DB writes failing (tasks not persisted)
- Wallet connect completely broken

**P1 issues (document, fix, retest):**
- Decision badge CSS broken
- Wrong status labels (deferred shown instead of monitoring)
- Watch task result null in DB
- History showing other wallets' tasks

---

## Verification Checklist

After full run, confirm:

```
[ ] 8 task type cards visible in idle state
[ ] Textarea appears only after card selection
[ ] Back button returns to card grid
[ ] Wallet address survives page reload (no popup)
[ ] localStorage keys solv001_wallet + solv001_chainId set
[ ] Task history shows only connected wallet's tasks
[ ] History row click opens overlay with full result + trace
[ ] /status rows not clickable (no cursor-pointer)
[ ] ACCEPT badge = green rgba (not var(--green)40)
[ ] DEFER badge = amber rgba
[ ] REJECT badge = red rgba
[ ] wallet_watch task: result NOT null in DB
[ ] wallet_watch history label = "monitoring" (blue)
[ ] scheduled task history label = "scheduled" (violet)
[ ] JSON state blob NOT visible as snippet in history
[ ] Multi-chain result mentions >1 chain
[ ] income ↗ link appears on completed tasks with real tx hash
[ ] /status page TreasuryPanel shows USDC ~$19+ and apy ~4.85%
[ ] /status polling: treasury every 10s, tasks every 15s
[ ] All 5 data service demo endpoints return 200
[ ] MCP tools/list returns exactly 3 tools
[ ] 402 without payment auth returns payment requirements
[ ] 429 on 6th request within 60s window
[ ] SSRF callback_url blocked for localhost/private IPs
[ ] net_usdc > 0 for at least one completed task
[ ] total_tasks_completed increments after each task
```

---

*Total new test cases: 90+ (Sections N1–N13)*
*Regression baseline: v2 plan (100+ cases) — spot-checked via Section N11 + RG.*
*Agent USDC budget: $19.65 — estimated spend: ~$2.40 for all paid E2E runs.*
