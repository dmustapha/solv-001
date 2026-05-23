# solv-001 — Master Issue List
> Senior dev audit. 36 issues across all facets. Researched + prescribed fixes. Implementation pending.
> Last updated: 2026-05-22

---

## Context

- **Zombie task fix (done)**: Added `AND created_at > NOW() - INTERVAL '5 minutes'` to both `getActiveTaskCount()` and `getAllTimeStats().pending_income`. Committed + pushed. a2a-auto-caller restarted and confirmed working.
- **Hard requirement**: Demo mode must be removed everywhere. Real EIP-3009 payment must be used in all flows (dashboard, A2A, MCP).
- **Payment architecture**:
  - **Income** (body-based): `payment_authorization: EIP3009Auth` → `verifyNanopayment()` → Circle `/v1/payments/settle`
  - **Expense** (header-based): `Payment-Signature` header → `verifyGatewayPayment()` → Circle `/v1/x402/verify` + `/v1/x402/settle`

---

## P0 — Demo blockers / core correctness

### #1 — EIP-3009 recipient mismatch (CRITICAL)
**File:** `src/components/TaskSubmitForm.tsx`
**Bug:** Signs `to: NEXT_PUBLIC_SELLER_EOA_ADDRESS` but the 402 response contains `payTo: CIRCLE_WALLET_ADDRESS` — different addresses. Real payments fail signature verification.
**Fix:**
1. Add `NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS` to `next.config.ts` env exposure
2. Update `TaskSubmitForm.tsx`:
   ```typescript
   const sellerAddress = process.env.NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS as `0x${string}`;
   ```
3. Verify `build402Response()` in `nanopayments-seller.ts` returns the Circle wallet address as `payTo`

---

### #2 — `max_tokens: 200` causes silent DEFER
**File:** `src/lib/treasury-reasoning.ts`
**Bug:** Claude's reasoning is capped at 200 tokens. If reasoning is complex, the response truncates mid-way. The decision regex fails, `finalDecision` stays `null`, and the task gets DEFER'd automatically (route.ts:165).
**Fix:** Raise to 500–800 tokens:
```typescript
max_tokens: 600,
```
Also add a `stop_reason` check — if `stop_reason === "max_tokens"`, log a warning instead of silently deferring.

---

### #3 — `waitForTransactionHash()` blocks for 60 seconds
**File:** `src/lib/circle-wallets.ts`
**Bug:** Polls 20 times × 3s = 60s max. On Vercel Hobby (60s limit), this exhausts the entire serverless budget, causing the SSE response to be cut mid-stream.
**Fix:**
1. Reduce poll budget: 10 × 2s = 20s max
2. On timeout, don't throw — return `null` and let callers handle gracefully
3. Long-term: use a durable job queue (Upstash QStash or Inngest) to offload `waitForTransactionHash()` out of the request lifecycle

---

### #4 — UUID/demo hashes rendered as Arc Explorer links
**File:** `src/components/TaskHistoryPanel.tsx`, `src/components/TaskTracePanel.tsx`
**Bug:** All `tx_hash` values are rendered as `${arcUrl}/tx/${hash}` links, including Circle UUIDs (`"c5d1f..."`), demo hashes (`"demo-payment-xxx"`), and real Arc hashes (`"0x..."`). Clicking a UUID on the Explorer returns 404.
**Fix:** Add a guard before rendering:
```typescript
function isArcHash(hash: string): boolean {
  return hash.startsWith("0x") && hash.length === 66;
}
// Render link only if isArcHash(hash); otherwise render plain monospace text
```

---

### #5 — No wallet connection UI
**File:** `src/components/TaskSubmitForm.tsx`, `src/app/page.tsx` or shared layout
**Bug:** The form calls `window.ethereum` but there is no Connect Wallet button, no account state management, and no feedback when MetaMask is not installed. The form silently fails.
**Fix:**
1. Add wagmi + ConnectKit (or RainbowKit), or a manual minimal implementation:
   ```typescript
   const [account, setAccount] = useState<string | null>(null);
   async function connect() {
     const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
     setAccount(addr);
   }
   ```
2. Show `<button onClick={connect}>Connect Wallet</button>` before showing task form
3. Persist account via `window.ethereum.on("accountsChanged", ...)` listener
4. Show connected address + USDC balance in UI header

---

### #6 — No chain detection or Arc testnet enforcement
**File:** `src/components/TaskSubmitForm.tsx`
**Bug:** `createWalletClient` has no `chain` field. If the user's MetaMask is on Ethereum mainnet, the EIP-3009 signature is valid on mainnet but Circle Gateway rejects it (wrong chain ID in `v` field of signature).
**Fix:**
```typescript
const arcTestnet = defineChain({ id: 26, name: "Arc Testnet", ... });
const walletClient = createWalletClient({ chain: arcTestnet, transport: custom(window.ethereum) });

// Before signing, check chain:
const chainId = await walletClient.getChainId();
if (chainId !== 26) {
  await walletClient.switchChain({ id: 26 });
}
```
Define Arc testnet chain config centrally in `src/lib/chains.ts`.

---

### #7 — Demo mode removal
**Files:** `src/components/TaskSubmitForm.tsx`, `scripts/a2a-auto-caller.ts`, `src/app/api/mcp/route.ts`, `src/app/api/tasks/route.ts`
**Requirement:** Remove all demo mode paths once #1, #5, #6 are fixed.
1. `TaskSubmitForm.tsx`: Remove `demo_mode: true` default and checkbox
2. `route.ts`: Remove the `if (!demo_mode)` gate — payment is always required
3. `a2a-auto-caller.ts`: Replace `demo_mode: true` with real EIP-3009 signing using `A2A_CALLER_PRIVATE_KEY`
4. `mcp/route.ts`: Require `payment_authorization` field in `run_task` input schema
5. Add `A2A_CALLER_PRIVATE_KEY` to `.env.local` for the A2A auto-caller's signing wallet
6. Remove `executePayment()` demo path in `task-execution.ts` (lines 206–221)

---

## P1 — Correctness / functional gaps

### #8 — `general-research` returns hardcoded template
**File:** `src/app/api/data-service/[type]/route.ts` + `src/lib/task-execution.ts`
**Bug:** The `general-research` endpoint always returns `"Research complete. See task history for details."` — never a real answer.
**Fix:** Call Claude inside the data-service handler:
```typescript
// data-service/general-research:
const response = await anthropic.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 400,
  messages: [{ role: "user", content: `Blockchain research query: ${query}` }],
});
return Response.json({ summary: response.content[0].text });
```
Or use a cached web search via Tavily/Perplexity API.

---

### #9 — `conditional_payment` ignores the condition
**File:** `src/lib/task-execution.ts` (`executePayment()`)
**Bug:** The task text "Send 1 USDC to 0xABC if balance > 5" is never evaluated. The condition (`if balance > 5`) is never checked — the payment goes through unconditionally.
**Fix:**
1. Parse condition from task text: `/(if|when)\s+(.+)/i`
2. Fetch the subject's balance via `arc-canteen` or `getNativeBalance()`
3. Evaluate the condition before calling `executeContractCall()`
4. Emit a trace event: "Condition evaluated: balance=4.2 USDC, threshold=5 — NOT met. Payment skipped."

---

### #10 — `contract_summary` returns hardcoded "ERC-20/Teller pattern"
**File:** `src/lib/task-execution.ts` (`executeContractSummary()`)
**Bug:** Line 170 always outputs "ERC-20/Teller pattern detected" regardless of the actual bytecode.
**Fix:** Pass the bytecode to Claude for analysis:
```typescript
const claudeResponse = await anthropic.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 300,
  messages: [{ role: "user", content: `Analyze this Ethereum contract bytecode and describe its likely function and patterns:\n${code.slice(0, 2000)}` }],
});
const result = claudeResponse.content[0].text;
```

---

### #11 — `redeemUSYCIfNeeded()` never called
**File:** `src/lib/usyc.ts`, `src/app/api/tasks/route.ts`
**Bug:** The redeem function is implemented but never invoked. If USDC balance drops too low, the agent can't pay for expenses, even if it holds USYC.
**Fix:** After `sweepIdleUSDCtoUSYC()`, add:
```typescript
try {
  await redeemUSYCIfNeeded(); // redeem USYC → USDC if balance below operating reserve
} catch { /* non-critical */ }
```
Also define `MIN_USDC_THRESHOLD` (e.g., $2) as the trigger level.

---

### #12 — USYC sweep stores Circle UUID as tx_hash
**File:** `src/lib/usyc.ts`
**Bug:** `sweepIdleUSDCtoUSYC()` stores the Circle `transactionId` (UUID format) as `arc_link` / `tx_hash` in treasury_events. The Explorer link breaks.
**Fix:** Use `waitForTransactionHash()` after the sweep to get the real Arc hash, then store it:
```typescript
const arcHash = await waitForTransactionHash(txId);
await insertTreasuryEvent({ type: "sweep", amount_usdc, tx_hash: arcHash ?? undefined });
```

---

### #13 — Claude reasoning cost not tracked
**File:** `src/lib/treasury-reasoning.ts`
**Bug:** `reasoning_tokens` is returned but never used. The cost of calling Claude per task (roughly $0.003–0.015) is unaccounted in `cost_usdc`.
**Fix:**
```typescript
// In route.ts after reasoning completes:
const claudeCostUsdc = (finalDecision.reasoning_tokens / 1_000_000) * 3.0; // claude-sonnet input price
// Add to cost_usdc when completing the task
```

---

### #14 — No USDC balance display in task form
**File:** `src/components/TaskSubmitForm.tsx`
**Bug:** After wallet connection, the payer's USDC balance is never fetched or shown. Users don't know if they have enough to pay.
**Fix:** After connecting wallet, call `getBalance()` on the Arc USDC contract:
```typescript
const balance = await publicClient.readContract({
  address: ARC_USDC_ADDRESS,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [account],
});
setUsdcBalance(formatUnits(balance, 6));
```

---

### #15 — Demo income not recorded in `treasury_events`
**File:** `src/app/api/tasks/route.ts`
**Bug:** When `demo_mode` is true, `income_tx_hash` is undefined and no treasury_event is inserted (lines 89–95 skip on `!income_tx_hash`). After removing demo mode this becomes moot, but currently demo runs produce zero income records.
**Fix (immediate):** Insert treasury event unconditionally with `tx_hash: undefined` for demo runs. After demo mode removal (#7), this is resolved automatically.

---

### #16 — A2A auto-caller uses demo mode (no real payment)
**File:** `scripts/a2a-auto-caller.ts`
**Bug:** Sends `demo_mode: true` — no payment authorization. Tasks run for free. Real income never recorded.
**Fix:**
1. Add `A2A_CALLER_PRIVATE_KEY` env var (the A2A caller's EOA private key)
2. Use viem to sign EIP-3009 `TransferWithAuthorization` before each task submission:
   ```typescript
   const auth = await signEIP3009({
     privateKey: process.env.A2A_CALLER_PRIVATE_KEY,
     from: callerAddress,
     to: circleWalletAddress,
     value: taskPriceUsdc * 1_000_000,
     validAfter: 0n,
     validBefore: BigInt(Math.floor(Date.now() / 1000) + 3600),
     nonce: randomBytes(32),
   });
   // Submit with payment_authorization: auth (no demo_mode)
   ```

---

### #17 — MCP `run_task` doesn't require payment
**File:** `src/app/api/mcp/route.ts`
**Bug:** The `run_task` tool sends `payment_authorization: undefined` when the field is omitted. The server receives no payment. Tasks run free for any MCP caller.
**Fix:**
1. Make `payment_authorization` a required field in the `run_task` input schema
2. Return a structured error if missing: `{ error: "payment_authorization required", code: 402 }`
3. Set `client_type: "agent"` always (MCP callers are agents)
4. Document the EIP-3009 signing flow in the MCP tool description

---

## P2 — UX / reliability

### #18 — SSE reader not cancelled on unmount
**File:** `src/components/Dashboard.tsx`
**Bug:** The `ReadableStreamDefaultReader` from the SSE fetch is never cancelled when the component unmounts or when a new task is submitted. Multiple concurrent readers accumulate.
**Fix:**
```typescript
useEffect(() => {
  const controller = new AbortController();
  // pass controller.signal to fetch
  return () => controller.abort();
}, [activeSubmission]);
```

---

### #19 — SSE parser doesn't handle chunk boundaries
**File:** `src/components/Dashboard.tsx`
**Bug:** SSE `data:` lines can span multiple `read()` chunks. Parsing `chunk.split("\n")` naively can split a JSON payload across two reads, causing `JSON.parse()` to throw.
**Fix:** Maintain a buffer:
```typescript
let buffer = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n\n");
  buffer = lines.pop()!; // keep incomplete last segment
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const event = JSON.parse(line.slice(6));
      // handle event
    }
  }
}
```

---

### #20 — Reasoning panel shows events in inverted order
**File:** `src/components/TaskTracePanel.tsx`
**Bug:** The reasoning text is rendered below the trace events, even though it happened first. The timeline is confusing.
**Fix:** Display sections in chronological order: Treasury snapshot → Reasoning → Trace events → Result. Alternatively use a unified timeline with timestamps.

---

### #21 — Task estimate is stale for dynamic pricing
**File:** `src/app/api/tasks/estimate` (if implemented) + frontend
**Bug:** Pricing is hardcoded in `TASK_PRICING` constants. The estimate shown to users never reflects actual treasury state (e.g., if the agent is low on USDC and might DEFER, the user doesn't know before paying).
**Fix:** Add a pre-flight check endpoint: `GET /api/tasks/preflight?task_type=X` that returns `{ will_accept: boolean, reason: string, price_usdc: number }` based on current treasury state. Show this in the UI before the user signs.

---

### #22 — No error feedback on failed task submission
**File:** `src/components/Dashboard.tsx`
**Bug:** If the POST /api/tasks fails (network error, 402, 400), the error is silently swallowed. The user sees no feedback.
**Fix:** Add explicit error state and display:
```typescript
} catch (err) {
  setSubmissionError(err instanceof Error ? err.message : "Task submission failed");
}
// In JSX: {submissionError && <div className="error">{submissionError}</div>}
```

---

### #23 — Zombie tasks visible in task history
**File:** `src/lib/db.ts` (`listTasks()`), `src/components/TaskHistoryPanel.tsx`
**Bug:** `listTasks(50)` returns all tasks including 28 zombies stuck in `reasoning`/`executing`. These show as "In Progress" forever in the UI.
**Fix (SQL migration):** Run once:
```sql
UPDATE tasks
SET status = 'deferred', reasoning = 'Timed out — serverless request expired'
WHERE status IN ('pending', 'reasoning', 'executing')
AND created_at < NOW() - INTERVAL '10 minutes';
```
**Fix (ongoing):** Add `listTasks()` filter option to exclude old in-progress tasks, or surface them distinctly in the UI with a "Timed out" badge.

---

### #24 — `key={i}` array index anti-pattern
**File:** `src/components/TaskTracePanel.tsx`, `src/components/TaskHistoryPanel.tsx`
**Bug:** Using array index as React key causes incorrect reconciliation when items are prepended or reordered.
**Fix:** Use stable IDs: `key={event.id}` or `key={task.id}`.

---

### #25 — No error state in UI components
**File:** `src/components/TreasuryPanel.tsx`, `src/components/TaskHistoryPanel.tsx`
**Bug:** If the `GET /api/tasks` or treasury fetch fails, components silently show empty state.
**Fix:** Add loading/error states:
```typescript
const [error, setError] = useState<string | null>(null);
// In catch: setError("Failed to load tasks")
// In JSX: {error && <p className="text-red-400">{error}</p>}
```

---

### #26 — Connected wallet address not displayed after connection
**File:** `src/components/TaskSubmitForm.tsx`
**Bug:** After wallet connect (#5 fix), the user's wallet address should be visible in the header to confirm they're connected.
**Fix:** Display truncated address and chain name after connection:
```typescript
<span>{account.slice(0, 6)}...{account.slice(-4)} · Arc Testnet · {usdcBalance} USDC</span>
```

---

### #27 — Execution errors stored as `deferred` status
**File:** `src/app/api/tasks/route.ts` (line 235)
**Bug:** When task execution throws (`catch (err)`), the task is stored with `status = 'deferred'` and `reasoning = 'Execution error: ...'`. Deferred and errored tasks are indistinguishable.
**Fix:**
1. Add `failed` to the `TaskStatus` union type in `src/types/index.ts`
2. Add `failTask(id, reason)` in `db.ts`:
   ```typescript
   await sql`UPDATE tasks SET status = 'failed', reasoning = ${reason} WHERE id = ${id}`;
   ```
3. Call `failTask()` in the catch block instead of `deferTask()`

---

## P3 — Security / stability

### #28 — SSRF protection is incomplete
**File:** `src/app/api/tasks/route.ts` (lines 36–45)
**Bug:** The `callback_url` check blocks `localhost` and `127.x` but misses:
- IPv6 loopback (`::1`, `[::1]`)
- Internal cloud metadata (`169.254.169.254` — AWS/GCP IMDS)
- RFC1918 `10.x.x.x` subnets
- DNS rebinding attacks (hostname resolves to internal IP after validation)
**Fix:**
```typescript
const BLOCKED = ["localhost", "0.0.0.0", "::1"];
const BLOCKED_PREFIXES = ["127.", "192.168.", "10.", "172.16.", "169.254."];
if (BLOCKED.includes(parsed.hostname) || BLOCKED_PREFIXES.some(p => parsed.hostname.startsWith(p))) {
  return Response.json({ error: "callback_url must be a public https URL" }, { status: 400 });
}
// Enforce HTTPS only (no HTTP):
if (parsed.protocol !== "https:") { ... }
```

---

### #29 — Five critical dependencies pinned to `"latest"`
**File:** `package.json`
**Bug:** `@anthropic-ai/sdk`, `@circle-fin/developer-controlled-wallets`, `@circle-fin/x402-batching`, `@modelcontextprotocol/sdk`, `@vercel/postgres` are all `"latest"`. A breaking release of any of these silently breaks production on next deploy.
**Fix:** Pin to current versions after confirming they work:
```json
"@anthropic-ai/sdk": "^0.39.0",
"@circle-fin/developer-controlled-wallets": "^3.x.x",
...
```
Run `npm list <package>` to get current installed versions.

---

### #30 — No task text length validation
**File:** `src/app/api/tasks/route.ts`
**Bug:** Unlimited-length `task` strings accepted. A 10MB task string causes: OOM in Claude reasoning, slow DB writes, and potential timeout.
**Fix:**
```typescript
if (task.length > 2000) {
  return Response.json({ error: "task must be 2000 characters or fewer" }, { status: 400 });
}
```

---

### #31 — Admin migration endpoint permanently exposed
**File:** `src/app/api/admin/migrate/route.ts`
**Bug:** The migration endpoint is gated only by `ADMIN_SECRET` — a shared secret in an env var. If exposed or leaked, anyone can run arbitrary migrations.
**Fix:** Disable the endpoint entirely in production (`NODE_ENV === "production"` → return 404). Migrations should run via `scripts/migrate.ts` or the Vercel Postgres dashboard, not a live HTTP endpoint.

---

### #32 — `expense_tx_hashes` array cast is unsafe
**File:** `src/lib/db.ts` (`completeTask()`, line 93)
**Bug:** `${params.expense_tx_hashes as unknown as string}` — casting an array to string produces `"0xabc,0xdef"` in PostgreSQL, not a proper TEXT[] array.
**Fix:**
```typescript
expense_tx_hashes = ${JSON.stringify(params.expense_tx_hashes)}::text[]
// Or use sql.array():
expense_tx_hashes = ${sql.array(params.expense_tx_hashes)}
```

---

### #33 — No database indexes on frequently queried columns
**File:** Schema (migrate.ts or Postgres dashboard)
**Bug:** All queries on `tasks` scan the full table: `WHERE status IN (...)`, `ORDER BY created_at DESC`, `WHERE completed_at >= CURRENT_DATE`. With 1000+ tasks, these become slow.
**Fix (one-time SQL):**
```sql
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trace_events_task_id ON trace_events(task_id);
CREATE INDEX IF NOT EXISTS idx_treasury_events_type_created ON treasury_events(type, created_at);
```

---

## Architecture — Structural gaps

### #34 — Serverless + long SSE = fundamental mismatch
**Context:** Vercel serverless has a 60s (Hobby) / 300s (Pro) request timeout. The SSE stream runs inside the serverless function. Tasks with `waitForTransactionHash()` polling + Claude reasoning can hit 60–90s.
**Fix options:**
1. **Upgrade to Vercel Pro** (300s limit — buys time)
2. **Use Upstash QStash or Inngest**: Accept task synchronously, push to durable queue, return `task_id` immediately. Client polls `GET /api/tasks/{id}` for status.
3. **Vercel Edge Functions**: No timeout limit but no Node.js APIs (no `crypto`, no Circle SDK). Not straightforward.
4. **Recommended for hackathon**: Upgrade to Pro + reduce `waitForTransactionHash()` timeout (#3) + add `failed` status (#27) for tasks that don't complete within budget.

---

### #35 — Self-calling pattern wastes two function invocations
**Context:** `executeWalletIntelligence()` calls `payForResource()` which calls `fetch(${baseUrl}/api/data-service/...)` — the same Vercel deployment. This uses 2 cold-start function slots and 2× the timeout budget.
**Fix:** Extract data-service logic into importable functions in `src/lib/data-service/`:
```typescript
// Instead of HTTP self-call:
import { getTransactionCount } from "@/lib/data-service/transaction-count";
const result = await getTransactionCount(address);
// Still log the nanopayment expense internally
```
The nanopayment expense tracking can still be done without the HTTP round-trip.

---

### #36 — No rate limiting on any public endpoint
**Context:** `POST /api/tasks`, `POST /api/mcp`, `GET /api/data-service/*` are all publicly callable with no rate limit. A bot can drain the agent's USDC balance in seconds by spamming expense endpoints.
**Fix:** Add Upstash Redis rate limiting (free tier available):
```typescript
import { Ratelimit } from "@upstash/ratelimit";
const ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m") });
const { success } = await ratelimit.limit(payer_wallet ?? ip);
if (!success) return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
```
Alternative: Vercel's built-in DDoS protection + KV store rate limiting.

---

## Implementation Order

```
Phase 1 (prerequisites for real payment):
  #5  → Wallet connection UI
  #6  → Chain detection + Arc testnet switching
  #1  → EIP-3009 recipient mismatch fix
  #14 → USDC balance display

Phase 2 (remove demo mode):
  #7  → Remove demo_mode everywhere
  #16 → A2A real payment signing
  #17 → MCP payment requirement

Phase 3 (correctness):
  #2  → max_tokens fix
  #3  → waitForTransactionHash timeout
  #4  → UUID hash link guard
  #27 → Failed task status
  #8  → general-research real AI
  #9  → conditional_payment condition check
  #10 → contract_summary real Claude analysis

Phase 4 (UX):
  #18 → SSE AbortController
  #19 → SSE chunk buffer
  #22 → Error feedback
  #20 → Reasoning panel order
  #23 → Zombie task SQL cleanup
  #26 → Connected wallet display

Phase 5 (infrastructure):
  #33 → DB indexes (one-time SQL)
  #32 → Array cast fix
  #29 → Pin dependencies
  #36 → Rate limiting
  #28 → Complete SSRF
  #31 → Disable admin endpoint in prod

Phase 6 (architecture):
  #34 → Serverless + SSE — upgrade to Pro or durable queue
  #35 → Eliminate self-calling pattern
  #11 → redeemUSYCIfNeeded call site
  #12 → USYC real tx hash
  #13 → Claude cost tracking
```

---

## One-time SQL to run now

```sql
-- Clean up 28 zombie tasks
UPDATE tasks
SET status = 'deferred', reasoning = 'Timed out — serverless request expired'
WHERE status IN ('pending', 'reasoning', 'executing')
AND created_at < NOW() - INTERVAL '10 minutes';

-- Add DB indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trace_events_task_id ON trace_events(task_id);
CREATE INDEX IF NOT EXISTS idx_treasury_events_type_created ON treasury_events(type, created_at);
```
