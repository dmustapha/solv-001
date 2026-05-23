# solv-001 — Fix Plan (Locked In)
> Exact code changes for all 36 issues. No implementation yet — review and approve each phase before building.
> Last updated: 2026-05-22

---

## How to read this document

Each fix shows:
- **File + line** — exact location
- **Before** — current broken code
- **After** — replacement code
- **Why** — one line on the mechanism

---

## P0 — Breaks Core Functionality (implement first)

---

### Fix #1 — EIP-3009 recipient mismatch

**Files:** `src/components/TaskSubmitForm.tsx:36,65,75` + `src/lib/nanopayments-seller.ts:33`

**Root cause:** Form signs `to = SELLER_EOA_ADDRESS`. The 402 response says `payTo = CIRCLE_WALLET_ADDRESS`. Circle Gateway is told to expect payment at Circle wallet but receives a signature for the EOA — it rejects.

**Note:** `next.config.ts` already exposes `NEXT_PUBLIC_AGENT_WALLET_ADDRESS = process.env.CIRCLE_WALLET_ADDRESS`. No new env var needed.

**TaskSubmitForm.tsx — change recipient in signature:**
```typescript
// BEFORE (line 36):
const sellerAddress = process.env.NEXT_PUBLIC_SELLER_EOA_ADDRESS as `0x${string}`;

// AFTER:
const sellerAddress = process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS as `0x${string}`;
// This is CIRCLE_WALLET_ADDRESS — where income actually lands
```

**TaskSubmitForm.tsx — message + return object (lines 65, 75):**
No change needed — `sellerAddress` variable is already used in both places. Only the source of the variable changes.

**nanopayments-seller.ts — verification checks Circle wallet, not EOA:**
```typescript
// BEFORE (line 33):
if (auth.to.toLowerCase() !== sellerAddress.toLowerCase()) {

// AFTER:
const circleWallet = process.env.CIRCLE_WALLET_ADDRESS!;
if (auth.to.toLowerCase() !== circleWallet.toLowerCase()) {
```

**Also fix — `token` field in settle body is undefined when `ARC_USDC_ADDRESS` env var not set (line 55):**
```typescript
// BEFORE:
token: process.env.ARC_USDC_ADDRESS,

// AFTER:
token: process.env.ARC_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000",
```

---

### Fix #2 — `max_tokens: 200` causes silent DEFER

**File:** `src/lib/treasury-reasoning.ts:56`

**Root cause:** At 200 tokens, a verbose reasoning response truncates mid-sentence. The regex `DECISION:\s*(ACCEPT|DEFER|REJECT)` fails to match, `finalDecision` defaults to DEFER.

```typescript
// BEFORE:
max_tokens: 200,

// AFTER:
max_tokens: 600,
```

**Also add truncation warning in route.ts after streaming completes:**
```typescript
// In route.ts, after the streamTreasuryReasoning loop:
if (!finalDecision) {
  // BEFORE: silent default
  finalDecision = { decision: "DEFER" as const, explanation: "Reasoning incomplete.", reasoning_tokens: 0 };

  // AFTER: log the truncation, don't silently defer
  console.warn(`[task:${taskId}] Treasury reasoning returned no decision — possible max_tokens truncation`);
  finalDecision = { decision: "DEFER" as const, explanation: "Treasury reasoning truncated before decision. Task deferred automatically.", reasoning_tokens: 0 };
}
```

---

### Fix #3 — `waitForTransactionHash()` blocks 60s inside SSE handler

**File:** `src/lib/circle-wallets.ts:96-98`

**Root cause:** 20 attempts × 3s = 60s max. Vercel Hobby plan kills functions at 60s. The SSE response gets cut.

```typescript
// BEFORE:
const maxAttempts = 20;
for (let i = 0; i < maxAttempts; i++) {
  await new Promise(r => setTimeout(r, 3000));

// AFTER:
const maxAttempts = 8;  // 8 × 2s = 16s max — leaves plenty of budget
for (let i = 0; i < maxAttempts; i++) {
  await new Promise(r => setTimeout(r, 2000));
```

**Also:** on timeout, return `null` (already does this — no change needed there). Callers handle `null` gracefully by storing `undefined` tx_hash.

---

### Fix #4 — UUID/demo hashes rendered as Arc Explorer links

**Files:** `src/components/TaskHistoryPanel.tsx:89-108` + `src/components/TaskTracePanel.tsx:91-112`

**Add shared guard function — place in `src/lib/utils.ts` (create if not exists):**
```typescript
export function isArcTxHash(hash: string | undefined | null): boolean {
  return typeof hash === "string" && hash.startsWith("0x") && hash.length === 66;
}
```

**TaskHistoryPanel.tsx — income hash link (line 89):**
```typescript
// BEFORE:
{task.income_tx_hash && (
  <a href={`${arcUrl}/tx/${task.income_tx_hash}`} ...>income ↗</a>
)}

// AFTER:
{isArcTxHash(task.income_tx_hash) && (
  <a href={`${arcUrl}/tx/${task.income_tx_hash}`} ...>income ↗</a>
)}
{task.income_tx_hash && !isArcTxHash(task.income_tx_hash) && (
  <span className="text-[10px] text-[#16C97A]/40">income (pending)</span>
)}
```

**TaskHistoryPanel.tsx — expense hashes (line 99):**
```typescript
// BEFORE:
{task.expense_tx_hashes.slice(0, 2).map((hash, i) => (
  <a key={i} href={`${arcUrl}/tx/${hash}`} ...>expense ↗</a>
))}

// AFTER:
{task.expense_tx_hashes.slice(0, 2).map((hash) => (
  isArcTxHash(hash)
    ? <a key={hash} href={`${arcUrl}/tx/${hash}`} ...>expense ↗</a>
    : <span key={hash} className="text-[10px] text-[#E09820]/40">expense (uuid)</span>
))}
```

**TaskTracePanel.tsx — trace event hash links (lines 91-112):**
Same pattern — wrap both `<a>` elements with `isArcTxHash(event.arc_tx_hash)` guard. If not a real hash, render the UUID as plain `[{hash.slice(0,8)}]` without an anchor.

---

### Fix #5 — No wallet connection UI

**File:** `src/components/TaskSubmitForm.tsx`

**Replace the top of the component with wallet state management:**

```typescript
// Add at top of component (after existing useState declarations):
const [account,      setAccount]      = useState<`0x${string}` | null>(null);
const [usdcBalance,  setUsdcBalance]  = useState<number | null>(null);
const [connecting,   setConnecting]   = useState(false);

// Add connect function:
async function connectWallet() {
  if (!(window as Window & { ethereum?: unknown }).ethereum) {
    setError("MetaMask not installed. Install it to pay with real USDC.");
    return;
  }
  setConnecting(true);
  try {
    const walletClient = createWalletClient({
      chain:     arcTestnet,  // imported from @/lib/chains (see Fix #6)
      transport: custom((window as unknown as { ethereum: Parameters<typeof custom>[0] }).ethereum),
    });
    const [addr] = await walletClient.requestAddresses();
    setAccount(addr);
    // Fetch USDC balance after connect
    const bal = await fetchUSDCBalance(addr);
    setUsdcBalance(bal);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Wallet connection failed");
  } finally {
    setConnecting(false);
  }
}

// Add disconnect:
function disconnectWallet() {
  setAccount(null);
  setUsdcBalance(null);
}
```

**In JSX — before the form, add wallet connection block:**
```tsx
{!account ? (
  <button
    type="button"
    onClick={connectWallet}
    disabled={connecting}
    className="w-full text-[12px] font-mono py-2 border border-[#18202E] hover:border-[#00C8FF]/30 text-[#00C8FF] rounded-sm transition-all"
  >
    {connecting ? "connecting..." : "Connect Wallet"}
  </button>
) : (
  <div className="flex items-center justify-between text-[11px] font-mono text-[#60788A] px-0.5">
    <span className="text-[#D6E0EC]">{account.slice(0, 6)}...{account.slice(-4)}</span>
    <span className="text-[#16C97A]">{usdcBalance !== null ? `${usdcBalance.toFixed(2)} USDC` : "..."}</span>
    <button onClick={disconnectWallet} className="text-[#60788A] hover:text-[#F04858] transition-colors">
      disconnect
    </button>
  </div>
)}
```

**Remove `demoMode` state and checkbox entirely** (part of Fix #7).

**Guard form submit — only allow if wallet connected:**
```typescript
if (!account) { setError("Connect your wallet first"); return; }
```

---

### Fix #6 — No chain detection or enforcement

**Create `src/lib/chains.ts` (new file):**
```typescript
import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id:   26,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.arcnetwork.xyz"] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.arcnetwork.xyz" },
  },
});

// Arc testnet USDC — same address used by usyc.ts and data-service
export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as `0x${string}`;
```

**Note:** `src/lib/usyc.ts` already defines `arcTestnet` identically — after creating `chains.ts`, import from there in both `usyc.ts` and `TaskSubmitForm.tsx` to avoid duplication.

**In `connectWallet()` (inside Fix #5), add chain check after getting address:**
```typescript
const chainId = await walletClient.getChainId();
if (chainId !== 26) {
  try {
    await walletClient.switchChain({ id: 26 });
  } catch {
    setError("Please switch to Arc Testnet in your wallet (chain ID 26) to continue.");
    return;
  }
}
```

**Add USDC balance fetch helper:**
```typescript
import { createPublicClient, http, formatUnits } from "viem";
import { arcTestnet, ARC_USDC_ADDRESS } from "@/lib/chains";

const erc20BalanceAbi = [{
  name: "balanceOf", type: "function",
  inputs: [{ name: "account", type: "address" }],
  outputs: [{ name: "", type: "uint256" }],
  stateMutability: "view",
}] as const;

async function fetchUSDCBalance(address: `0x${string}`): Promise<number> {
  const client = createPublicClient({ chain: arcTestnet, transport: http() });
  const raw = await client.readContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20BalanceAbi,
    functionName: "balanceOf",
    args: [address],
  });
  return parseFloat(formatUnits(raw as bigint, 6));
}
```

**Also wire chain in `createWalletClient` inside `buildPaymentAuth()`:**
```typescript
// BEFORE:
const walletClient = createWalletClient({
  transport: custom(...),
});

// AFTER:
const walletClient = createWalletClient({
  chain:     arcTestnet,
  transport: custom(...),
});
```

---

### Fix #7 — Remove demo mode entirely

**`src/components/TaskSubmitForm.tsx`:**
- Delete `const [demoMode, setDemoMode] = useState(true);`
- Delete the demo mode checkbox JSX block (lines 155-166)
- Delete the demo mode branch in `handleSubmit` (lines 88-92)
- Delete `"Enable demo mode to test without a wallet."` from MetaMask error (replace with: `"MetaMask not installed."`)
- Submit button label: `run task — $${pricing.price_usdc} USDC` always (no conditional)

**`src/app/api/tasks/route.ts`:**
```typescript
// BEFORE (lines 56-76):
if (!demo_mode) {
  if (!payment_authorization) {
    return build402Response(...);
  }
  // verify...
}

// AFTER: payment is always required — remove the demo_mode gate entirely:
if (!payment_authorization) {
  return build402Response({ price_usdc: pricing.price_usdc, task_type, requestUrl: req.url });
}
const sellerAddress = process.env.SELLER_EOA_ADDRESS!;
let verification: Awaited<ReturnType<typeof verifyNanopayment>>;
try {
  verification = await verifyNanopayment(payment_authorization, sellerAddress);
} catch {
  return Response.json({ error: "Malformed payment authorization" }, { status: 402 });
}
if (!verification.verified) {
  return Response.json({ error: `Payment verification failed: ${verification.error}` }, { status: 402 });
}
income_tx_hash = verification.tx_hash;
```

**Also remove from route.ts:**
- The `demo_mode` destructure from body
- The `demo_mode ?` ternary in `getAgentWallet` call (line 112)
- The `demo_mode` pass-through to `executeTask`

**`scripts/a2a-auto-caller.ts`:** See Fix #16.

**`src/app/api/mcp/route.ts`:**
```typescript
// BEFORE (line 92):
demo_mode: !a.payment_authorization,

// AFTER: remove this line entirely
```

**`src/lib/task-execution.ts`:**
- Remove `demoMode?` parameter from `executeTask()` signature
- Remove `executePayment()` demo path (lines 206-221)
- Remove `demoMode` pass-through in switch cases

---

## P1 — Correctness Gaps

---

### Fix #8 — `general-research` returns hardcoded template

**File:** `src/app/api/data-service/[type]/route.ts:150-158`

```typescript
// BEFORE:
case "general-research": {
  const body  = await req.json().catch(() => ({}));
  const query = (body as { query?: string }).query ?? "";
  return {
    query,
    summary: `Research on Arc testnet: "${query}" — no major anomalies detected...`,
  };
}

// AFTER:
case "general-research": {
  const body  = await req.json().catch(() => ({}));
  const query = (body as { query?: string }).query ?? "";
  if (!query) return { query: "", summary: "No query provided." };

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages:   [{ role: "user", content: `You are a blockchain research assistant for Arc testnet. Answer this query concisely (2-4 sentences): ${query}` }],
  });
  const summary = response.content[0].type === "text" ? response.content[0].text : "Research complete.";
  return { query, summary };
}
```

**Note:** Using claude-haiku-4-5 here (cheapest) since this is an internal data-service query. Cost is ~$0.00025 per call, negligible vs the $0.01 charge.

---

### Fix #9 — `conditional_payment` ignores the condition

**File:** `src/lib/task-execution.ts:190-250` (`executePayment()`)

**Add condition parsing and evaluation before the transfer:**
```typescript
// Add after extracting toAddress and amount (before the demoMode block):

// Parse condition from task text
const conditionMatch = task.task.match(/(?:if|when)\s+(?:balance\s*[><=]+\s*[\d.]+|.+)/i);

if (conditionMatch) {
  // Check current USDC balance of the from-address
  const currentBalance = await getNativeBalance(task.payer_wallet as `0x${string}`);
  const balanceUsdc    = Number(currentBalance) / 1e6;

  // Parse threshold: "if balance > 5" → operator ">" threshold 5
  const thresholdMatch = conditionMatch[0].match(/(>|<|>=|<=|==)\s*([\d.]+)/);
  if (thresholdMatch) {
    const [, operator, thresholdStr] = thresholdMatch;
    const threshold = parseFloat(thresholdStr);
    const conditionMet =
      operator === ">"  ? balanceUsdc > threshold :
      operator === ">=" ? balanceUsdc >= threshold :
      operator === "<"  ? balanceUsdc < threshold :
      operator === "<=" ? balanceUsdc <= threshold :
      operator === "==" ? balanceUsdc === threshold : true;

    if (!conditionMet) {
      const reason = `Condition not met: balance=${balanceUsdc.toFixed(4)} USDC, threshold${operator}${threshold}. Payment skipped.`;
      await emitAndRecord(task.id, { task_id: task.id, type: "result", description: reason, timestamp: new Date() }, sendTrace);
      return { result: reason, cost_usdc: 0, expense_tx_hashes: [] };
    }

    await emitAndRecord(task.id, {
      task_id: task.id, type: "result",
      description: `Condition met: balance=${balanceUsdc.toFixed(4)} USDC ${operator} ${threshold}. Proceeding with payment.`,
      timestamp: new Date(),
    }, sendTrace);
  }
}

// then continue with existing transfer logic...
```

---

### Fix #10 — `contract_summary` hardcoded "ERC-20/Teller pattern detected"

**File:** `src/lib/task-execution.ts:167-170`

```typescript
// BEFORE:
const result = code === "0x"
  ? `Address ${address} is an EOA, not a contract.`
  : `Contract at ${address}: ${Math.floor(code.length / 2)} bytes bytecode. ERC-20/Teller pattern detected.`;

// AFTER:
let result: string;
if (code === "0x" || code.length <= 2) {
  result = `Address ${address} is an EOA (externally owned account), not a smart contract.`;
} else {
  const byteLen = Math.floor((code.length - 2) / 2);
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const claudeRes = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages:   [{
      role:    "user",
      content: `Analyze this Ethereum contract bytecode and describe what it likely does (function selectors, patterns you recognize). Be concise — 2-3 sentences max.\n\nBytecode (first 500 hex chars):\n${code.slice(0, 500)}`,
    }],
  });
  const analysis = claudeRes.content[0].type === "text" ? claudeRes.content[0].text : "Analysis unavailable.";
  result = `Contract at ${address}: ${byteLen} bytes. ${analysis}`;
}
```

---

### Fix #11 — `redeemUSYCIfNeeded()` never called

**File:** `src/app/api/tasks/route.ts:217-221`

```typescript
// BEFORE:
try {
  await sweepIdleUSDCtoUSYC();
} catch {
  // Sweep failure is non-critical
}

// AFTER:
try {
  await sweepIdleUSDCtoUSYC();
} catch { /* sweep failure — may not be allowlisted yet */ }

try {
  await redeemUSYCIfNeeded(wallet.address);
} catch { /* redeem failure — may not be allowlisted yet */ }
```

**Also add import at top of route.ts:**
```typescript
import { getUSYCPosition, sweepIdleUSDCtoUSYC, redeemUSYCIfNeeded } from "@/lib/usyc";
```

**Note:** `wallet.address` is already in scope from the earlier `getAgentWallet()` call. Pass it through to the result set or re-derive from the cached wallet object.

---

### Fix #12 — USYC sweep stores Circle UUID as tx_hash

**File:** `src/lib/usyc.ts:140-151`

```typescript
// BEFORE:
const txId = await executeContractCall({
  contractAddress:      TELLER_ADDRESS,
  abiFunctionSignature: "deposit(uint256)",
  abiParameters:        [sweepAmountUnits],
});

await insertTreasuryEvent({
  type:       "sweep",
  amount_usdc: sweepAmount,
  tx_hash:    txId,  // ← Circle UUID
  arc_link:   `${arcTestnet.blockExplorers.default.url}/tx/${txId}`,
});

// AFTER:
const approveId = await executeContractCall({
  contractAddress:      USDC_ADDRESS,
  abiFunctionSignature: "approve(address,uint256)",
  abiParameters:        [TELLER_ADDRESS, sweepAmountUnits],
});

// Wait for approval to confirm on-chain before depositing
const approveHash = await waitForTransactionHash(approveId);
// approveHash may be null if slow — proceed anyway, deposit may still work

const depositId = await executeContractCall({
  contractAddress:      TELLER_ADDRESS,
  abiFunctionSignature: "deposit(uint256)",
  abiParameters:        [sweepAmountUnits],
});
const depositHash = await waitForTransactionHash(depositId);

await insertTreasuryEvent({
  type:        "sweep",
  amount_usdc: sweepAmount,
  tx_hash:     depositHash ?? approveHash ?? undefined,
  arc_link:    depositHash ? `${arcTestnet.blockExplorers.default.url}/tx/${depositHash}` : undefined,
});
```

**Remove** the hardcoded 5s sleep between approve and deposit (replaced by `waitForTransactionHash`).

**Add import:**
```typescript
import { executeContractCall, waitForTransactionHash } from "./circle-wallets";
```
(already imported — no change needed)

---

### Fix #13 — Claude inference cost not tracked

**File:** `src/app/api/tasks/route.ts` — after reasoning completes

```typescript
// After the streamTreasuryReasoning loop, add:
const CLAUDE_SONNET_INPUT_PRICE_PER_M  = 3.00;   // $3.00 per 1M input tokens
const CLAUDE_SONNET_OUTPUT_PRICE_PER_M = 15.00;  // $15.00 per 1M output tokens

// finalDecision.reasoning_tokens is total (input + output)
// Use an 80/20 split as approximation (prompt is always longer than response)
const reasoning_tokens = finalDecision.reasoning_tokens;
const approxInputTokens  = Math.floor(reasoning_tokens * 0.8);
const approxOutputTokens = Math.floor(reasoning_tokens * 0.2);
const claudeCostUsdc = (approxInputTokens  / 1_000_000 * CLAUDE_SONNET_INPUT_PRICE_PER_M) +
                       (approxOutputTokens / 1_000_000 * CLAUDE_SONNET_OUTPUT_PRICE_PER_M);

// Store for use in cost_usdc calculation when completing the task:
// Pass claudeCostUsdc into executeTask() or add it to final cost_usdc:
const net_usdc = pricing.price_usdc - cost_usdc - claudeCostUsdc;
await completeTask({
  ...params,
  cost_usdc: cost_usdc + claudeCostUsdc,
  net_usdc,
});

// Also insert as a treasury expense event:
await insertTreasuryEvent({ type: "expense", amount_usdc: claudeCostUsdc });
```

---

### Fix #14 — No USDC balance display

Covered in Fix #5 (`fetchUSDCBalance()` called after wallet connect, displayed alongside task price in the wallet info row).

The balance should also refresh after each task completes:
```typescript
// In Dashboard.tsx handleTaskSubmit, after task completion:
if (event.type === "complete" || event.type === "deferred" || event.type === "rejected") {
  setIsSubmitting(false);
  fetchTasks();
  fetchTreasury();
  // Refresh payer USDC balance
  if (account) {
    fetchUSDCBalance(account).then(setUsdcBalance).catch(() => {});
  }
}
```

---

### Fix #15 — Demo income never written to treasury_events

Resolved automatically by Fix #7 (demo mode removed). Once all submissions require real EIP-3009, income always produces a real tx_hash and always gets a treasury_event.

No separate code change needed beyond Fix #7.

---

### Fix #16 — A2A auto-caller needs real payment

**File:** `scripts/a2a-auto-caller.ts`

**Replace the call function with real EIP-3009 signing:**

```typescript
import { privateKeyToAccount, signTypedData } from "viem/accounts";
import { parseUnits } from "viem";
import { randomBytes } from "crypto";
import type { EIP3009Auth } from "../src/types/index.js";

const CALLER_PRIVATE_KEY = process.env.A2A_CALLER_PRIVATE_KEY as `0x${string}`;
const CIRCLE_WALLET      = process.env.CIRCLE_WALLET_ADDRESS   as `0x${string}`;
const ARC_USDC_ADDRESS   = "0x3600000000000000000000000000000000000000" as `0x${string}`;

async function buildEIP3009Auth(priceUsdc: number): Promise<EIP3009Auth> {
  const account     = privateKeyToAccount(CALLER_PRIVATE_KEY);
  const price       = parseUnits(priceUsdc.toFixed(6), 6);
  const now         = BigInt(Math.floor(Date.now() / 1000));
  const validAfter  = now - 60n;
  const validBefore = now + 3600n;
  const nonce       = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;

  const signature = await account.signTypedData({
    domain: {
      name:              "USD Coin",
      version:           "2",
      chainId:           26,
      verifyingContract: ARC_USDC_ADDRESS,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from",        type: "address" },
        { name: "to",          type: "address" },
        { name: "value",       type: "uint256" },
        { name: "validAfter",  type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce",       type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from:        account.address,
      to:          CIRCLE_WALLET,
      value:       price,
      validAfter,
      validBefore,
      nonce,
    },
  });

  return {
    from:        account.address,
    to:          CIRCLE_WALLET,
    value:       price.toString(),
    validAfter:  validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
    signature,
  };
}

async function call() {
  const t         = TASKS[Math.floor(Math.random() * TASKS.length)];
  const priceUsdc = TASK_PRICING[t.task_type as keyof typeof TASK_PRICING]?.price_usdc ?? 0.30;

  try {
    const auth = await buildEIP3009Auth(priceUsdc);
    const res  = await fetch(`${AGENT_URL}/api/tasks`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        ...t,
        payer_wallet:          auth.from,
        payment_authorization: auth,
        client_type:           "agent",
        // NO demo_mode field
      }),
    });
    console.log(`[${new Date().toISOString()}] A2A call: ${t.task_type} — HTTP ${res.status}`);
    // ... drain SSE as before
  } catch (err) { ... }
}
```

**Add to `.env.local`:**
```
A2A_CALLER_PRIVATE_KEY=0x{32-byte private key for A2A caller wallet funded with Arc USDC}
```

---

### Fix #17 — MCP `run_task` silently runs free

**File:** `src/app/api/mcp/route.ts`

**Update tool schema to require payment_authorization:**
```typescript
// In tools array, update run_task inputSchema:
{
  name:        "run_task",
  description: "Submit a paid task to solv-001. Requires a signed EIP-3009 payment authorization.",
  inputSchema: {
    type:     "object",
    required: ["task_type", "task_description", "payer_wallet", "payment_authorization"],
    properties: {
      task_type:             { type: "string", enum: Object.keys(TASK_PRICING) },
      task_description:      { type: "string" },
      payer_wallet:          { type: "string", description: "Payer's Arc testnet address (0x...)" },
      payment_authorization: { type: "object", description: "Signed EIP-3009 TransferWithAuthorization" },
      max_cost_usdc:         { type: "number" },
    },
  },
},
```

**In run_task handler:**
```typescript
case "run_task": {
  const a = args as Record<string, unknown>;

  // Guard: payment_authorization is required
  if (!a.payment_authorization) {
    return {
      content: [{ type: "text", text: JSON.stringify({
        error: "payment_authorization is required",
        code:  402,
        hint:  "Sign a TransferWithAuthorization (EIP-3009) for the task price and include it here.",
      }) }],
      isError: true,
    };
  }

  const res = await fetch(`${appUrl}/api/tasks`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      task:                  a.task_description,
      task_type:             a.task_type,
      payer_wallet:          a.payer_wallet,
      payment_authorization: a.payment_authorization,
      client_type:           "agent",
      // NO demo_mode
    }),
  });
  // ... rest unchanged
```

---

## P2 — Reliability and Polish

---

### Fix #18 — SSE reader not cancelled on unmount

**File:** `src/components/Dashboard.tsx:54-96`

```typescript
const handleTaskSubmit = useCallback(async (payload: Record<string, unknown>) => {
  setIsSubmitting(true);
  setTraceEvents([]);
  setReasoning("");

  const controller = new AbortController();  // ADD

  const res = await fetch("/api/tasks", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
    signal:  controller.signal,  // ADD
  }).catch(err => {
    if (err.name === "AbortError") return null;
    throw err;
  });

  if (!res || !res.ok || !res.body) {
    // ADD: surface the error message
    if (res && !res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setSubmissionError(body.error ?? `Request failed (${res.status})`);
    }
    setIsSubmitting(false);
    return;
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();

  try {
    // ... SSE loop (see Fix #19 for chunk buffer fix)
  } finally {
    reader.releaseLock();
    controller.abort();  // ADD: clean up on any exit path
    setIsSubmitting(false);
  }
}, [fetchTasks, fetchTreasury]);
```

---

### Fix #19 — SSE parser drops events spanning chunk boundaries

**File:** `src/components/Dashboard.tsx:68-94`

```typescript
// Replace the inner while loop:
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });

  // Split on double-newline (SSE event boundary)
  const parts = buffer.split("\n\n");
  buffer = parts.pop()!;  // keep incomplete last segment

  for (const part of parts) {
    for (const line of part.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as SSEEvent;
        // ... handle event types as before
      } catch { /* malformed line */ }
    }
  }
}
```

---

### Fix #20 — Reasoning panel renders below trace events (inverted chronology)

**File:** `src/components/TaskTracePanel.tsx:56-70`

```tsx
// BEFORE: trace events first, then reasoning block at bottom
{traceEvents.map((event, i) => <TraceRow key={i} event={event} />)}
{reasoning && (
  <div className="mt-4">...</div>
)}

// AFTER: reasoning first (it happens before trace events), then trace events
{reasoning && (
  <div className="mb-4">
    <div className="text-[10px] uppercase tracking-widest text-[#9060E8]/60 mb-2">Reasoning</div>
    <div className="text-[#D6E0EC]/70 leading-relaxed whitespace-pre-wrap bg-[#09050F] border border-[#9060E8]/15 rounded-sm p-3 text-[11px]">
      {reasoning}
      {isActive && traceEvents.length === 0 && <span className="animate-pulse text-[#9060E8]">▌</span>}
    </div>
  </div>
)}
{traceEvents.map((event) => <TraceRow key={event.id ?? event.description} event={event} />)}
```

---

### Fix #21 — Stale estimate when task type changes

**File:** `src/components/TaskSubmitForm.tsx:127-135`

```typescript
// BEFORE:
onChange={e => setTaskType(e.target.value as TaskType)}

// AFTER:
onChange={e => {
  setTaskType(e.target.value as TaskType);
  setEstimate(null);  // clear stale estimate
}}
```

---

### Fix #22 — No error feedback on failed task submission

**File:** `src/components/Dashboard.tsx` + `src/components/TaskSubmitForm.tsx`

**In Dashboard.tsx — add error state:**
```typescript
const [submissionError, setSubmissionError] = useState<string | null>(null);

// Pass down to form:
<TaskSubmitForm
  onSubmit={handleTaskSubmit}
  isSubmitting={isSubmitting}
  submissionError={submissionError}
/>
```

**In TaskSubmitForm.tsx — display error from parent:**
```typescript
interface Props {
  onSubmit:        (payload: Record<string, unknown>) => void;
  isSubmitting:    boolean;
  submissionError?: string | null;
}

// In JSX, after existing error display:
{props.submissionError && (
  <p className="text-[11px] text-[#F04858] font-mono">{props.submissionError}</p>
)}
```

---

### Fix #23 — Zombie tasks visible in history

**One-time SQL (run in Vercel Postgres dashboard or via migrate endpoint):**
```sql
UPDATE tasks
SET status = 'deferred',
    reasoning = 'Timed out — serverless request expired before completion'
WHERE status IN ('pending', 'reasoning', 'executing')
AND created_at < NOW() - INTERVAL '10 minutes';
```

**Ongoing filter in `db.ts` `listTasks()`:**
```typescript
// BEFORE:
const result = await sql`
  SELECT * FROM tasks ORDER BY created_at DESC LIMIT ${limit}
`;

// AFTER:
const result = await sql`
  SELECT * FROM tasks
  WHERE status NOT IN ('pending', 'reasoning', 'executing')
     OR created_at > NOW() - INTERVAL '10 minutes'
  ORDER BY created_at DESC
  LIMIT ${limit}
`;
```

---

### Fix #24 — `key={i}` array index anti-pattern

**Files:** `src/components/TaskTracePanel.tsx:56` + `src/components/TaskHistoryPanel.tsx:98`

```typescript
// TaskTracePanel.tsx:
// BEFORE: key={i}
// AFTER:  key={event.id ?? `${event.task_id}-${event.type}-${event.timestamp.toString()}`}

// TaskHistoryPanel.tsx expense hashes:
// BEFORE: key={i}
// AFTER:  key={hash}   (hash is unique enough for this list)
```

---

### Fix #25 — No error state on component failure

Covered by Fix #22 (Dashboard-level error propagation).

For individual panel fetch failures:
```typescript
// In Dashboard.tsx fetchTasks():
} catch (err) {
  // silently ignore — stale data is OK for polling
  // Optionally: setFetchError(err) if you want to show a stale-data warning
}
```

No additional code change required beyond Fix #22.

---

### Fix #26 — Connected wallet address not displayed

Covered by Fix #5 — the wallet connection UI block shows:
```
0x1234...5678  |  4.20 USDC  |  disconnect
```
No separate change needed.

---

### Fix #27 — Execution errors stored as `deferred` status

**`src/types/index.ts` — add `failed` to TaskStatus:**
```typescript
// BEFORE:
export type TaskStatus =
  | "pending" | "reasoning" | "executing"
  | "complete" | "deferred" | "rejected";

// AFTER:
export type TaskStatus =
  | "pending" | "reasoning" | "executing"
  | "complete" | "deferred" | "rejected" | "failed";
```

**`src/lib/db.ts` — add failTask():**
```typescript
export async function failTask(id: string, reason: string): Promise<void> {
  await sql`
    UPDATE tasks SET status = 'failed', reasoning = ${reason}, completed_at = now()
    WHERE id = ${id}
  `;
}
```

**`src/app/api/tasks/route.ts:232-235` — use failTask in catch block:**
```typescript
// BEFORE:
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  send({ type: "error", data: msg });
  await deferTask(taskId, `Execution error: ${msg}`);
}

// AFTER:
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  send({ type: "error", data: msg });
  await failTask(taskId, `Execution error: ${msg}`);
}
```

**`src/components/TaskHistoryPanel.tsx` — add failed color:**
```typescript
const STATUS_COLOR: Record<string, string> = {
  complete:  "#16C97A",
  deferred:  "#E09820",
  rejected:  "#F04858",
  failed:    "#F04858",  // ADD — same red as rejected
  executing: "#4B8BF0",
  reasoning: "#9060E8",
  pending:   "#60788A",
};
```

---

## P3 — Security and Production Hardening

---

### Fix #28 — SSRF filter incomplete

**File:** `src/app/api/tasks/route.ts:39`

```typescript
// BEFORE:
if (![...].includes(parsed.protocol) || parsed.hostname === "localhost" ||
    parsed.hostname.startsWith("127.") || parsed.hostname.startsWith("192.168.") ||
    parsed.hostname === "0.0.0.0") {

// AFTER:
const BLOCKED_HOSTS    = new Set(["localhost", "0.0.0.0", "::1", "[::1]"]);
const BLOCKED_PREFIXES = ["127.", "10.", "172.16.", "172.17.", "172.18.", "172.19.",
                          "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
                          "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
                          "192.168.", "169.254."];

const isInternal = BLOCKED_HOSTS.has(parsed.hostname) ||
  BLOCKED_PREFIXES.some(p => parsed.hostname.startsWith(p));

if (parsed.protocol !== "https:" || isInternal) {
  return Response.json({ error: "callback_url must be a public https URL" }, { status: 400 });
}
```

**Note:** Also enforces HTTPS-only (removes `http:` from allowed protocols).

---

### Fix #29 — Dependencies pinned to `"latest"`

**File:** `package.json`

**Run `npm list` to get current installed versions, then pin:**
```bash
npm list @anthropic-ai/sdk @circle-fin/developer-controlled-wallets @circle-fin/x402-batching @modelcontextprotocol/sdk @vercel/postgres 2>/dev/null | grep -E "(@anthropic|@circle|@model|@vercel)"
```

**Replace in package.json (use actual installed versions):**
```json
"@anthropic-ai/sdk":                       "^0.39.0",
"@circle-fin/developer-controlled-wallets": "^3.x.x",
"@circle-fin/x402-batching":               "^1.x.x",
"@modelcontextprotocol/sdk":               "^1.x.x",
"@vercel/postgres":                        "^0.x.x"
```

---

### Fix #30 — No task description length validation

**File:** `src/app/api/tasks/route.ts:31` (after the missing-fields check)

```typescript
// AFTER existing required-field check:
if (task.length > 2000) {
  return Response.json(
    { error: "task description must be 2000 characters or fewer" },
    { status: 400 },
  );
}
```

---

### Fix #31 — Admin migrate endpoint permanently exposed

**File:** `src/app/api/admin/migrate/route.ts:5`

```typescript
// ADD at top of POST handler, before any other logic:
if (process.env.ENABLE_MIGRATE_ENDPOINT !== "true") {
  return Response.json({ error: "Not found" }, { status: 404 });
}
```

**Usage:** Set `ENABLE_MIGRATE_ENDPOINT=true` in Vercel env vars temporarily, run migration, then delete the env var. The endpoint returns 404 in all normal circumstances.

---

### Fix #32 — `expense_tx_hashes` unsafe array cast

**File:** `src/lib/db.ts:93`

```typescript
// BEFORE:
expense_tx_hashes = ${params.expense_tx_hashes as unknown as string},

// AFTER:
expense_tx_hashes = ARRAY[${params.expense_tx_hashes.join(",")}]::text[],
```

**Better approach using @vercel/postgres array syntax:**
```typescript
// Construct as a PostgreSQL array literal:
const hashArray = `{${params.expense_tx_hashes.map(h => `"${h}"`).join(",")}}`;
// Then:
expense_tx_hashes = ${hashArray},
```

**Or use the safest approach — serialize to JSON then cast:**
```typescript
expense_tx_hashes = ${JSON.stringify(params.expense_tx_hashes)}::jsonb::text[],
```

---

### Fix #33 — No database indexes

**Run via admin/migrate endpoint or Vercel Postgres dashboard:**
```sql
-- Speeds up: getActiveTaskCount(), getAllTimeStats(), listTasks(), webhook status checks
CREATE INDEX IF NOT EXISTS idx_tasks_status_created
  ON tasks(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_created_at
  ON tasks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_completed_at
  ON tasks(completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- Speeds up: getTraceEvents() — called per task in the proof page
CREATE INDEX IF NOT EXISTS idx_trace_events_task_id
  ON trace_events(task_id, timestamp ASC);

-- Speeds up: getTodayStats(), treasury event queries
CREATE INDEX IF NOT EXISTS idx_treasury_events_type_created
  ON treasury_events(type, created_at DESC);
```

---

## Architecture — Post-Hackathon (noted, not blocking demo)

---

### #34 — Serverless + long SSE mismatch

**Short-term fix (in scope for hackathon):**
- Fix #3 reduces `waitForTransactionHash` to 16s max
- Remove demo mode eliminates the fake-fast path
- Upgrade to Vercel Pro (300s limit) before demo day

**Long-term:** Migrate to Inngest or Trigger.dev for durable task execution. Task POST returns `task_id` immediately; client polls `GET /api/tasks/{id}`.

---

### #35 — App self-calls via HTTP for data-service

**Short-term:** No change needed — Arc testnet has low traffic, self-call works.

**Long-term:** Extract `fetchDataServiceData()` from `data-service/[type]/route.ts` into `src/lib/data-service.ts`. Import and call directly from `task-execution.ts`. Keep the HTTP route for external GatewayClient callers, but the internal path skips the network hop.

---

### #36 — No rate limiting

**Short-term (hackathon):** Vercel's built-in DDoS protection is active.

**Production fix:**
```bash
npm install @upstash/ratelimit @upstash/redis
```
```typescript
// src/middleware.ts:
import { Ratelimit } from "@upstash/ratelimit";
import { Redis }     from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const ratelimit = new Ratelimit({
  redis:   Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "1 m"),
});

export async function middleware(req: NextRequest) {
  const ip = req.ip ?? "anonymous";
  const { success } = await ratelimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
}
export const config = { matcher: ["/api/tasks", "/api/mcp", "/api/data-service/:path*"] };
```

---

## Additional Issue Found During Audit

### Fix #37 — `payForResource()` silent demo fallback on any error

**File:** `src/lib/nanopayments-buyer.ts:64-87`

**Current behavior:** Any exception from GatewayClient (bad private key, network error, rate limit, unfunded wallet) causes a silent `?demo=true` fallback. The task completes and records `arc_tx_hash: "0x0"` — indistinguishable from a real payment failure.

```typescript
// BEFORE:
} catch {
  // Fallback: direct fetch with demo bypass
  const demoUrl = params.url.includes("?") ? `${params.url}&demo=true` : `${params.url}?demo=true`;
  // ...
}

// AFTER:
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  // Rethrow — caller (task-execution.ts) should handle failure explicitly
  // This surfaces as a task failure with status 'failed' (see Fix #27)
  throw new Error(`GatewayClient payment failed for ${params.description}: ${msg}`);
}
```

**Why:** After demo mode is removed, a silent fallback is a financial integrity issue. If the agent can't pay for data, the task should fail loudly, not silently complete with fake data. The EXPENSE_WALLET_PRIVATE_KEY is set and the wallet is funded (19.5 USDC) — if GatewayClient throws, it's a real problem that should surface.

---

## Implementation Order

```
Phase 1 — Unblock real payments (P0, sequential):
  Fix #5  → wallet connect UI
  Fix #6  → chain detection (create chains.ts)
  Fix #1  → EIP-3009 recipient fix
  Fix #14 → USDC balance display (included in #5)
  Fix #7  → remove demo mode everywhere

Phase 2 — Fix execution correctness (P1):
  Fix #37 → remove silent payForResource fallback
  Fix #27 → add 'failed' status
  Fix #2  → max_tokens: 600
  Fix #8  → general-research real AI
  Fix #10 → contract_summary real analysis
  Fix #9  → conditional_payment condition check
  Fix #11 → wire redeemUSYCIfNeeded
  Fix #12 → USYC real Arc tx hash
  Fix #13 → Claude cost tracking
  Fix #16 → A2A real payment signing
  Fix #17 → MCP payment required

Phase 3 — UX reliability (P2):
  Fix #19 → SSE chunk buffer
  Fix #18 → SSE AbortController
  Fix #22 → error feedback
  Fix #20 → reasoning panel order
  Fix #21 → stale estimate clear
  Fix #4  → UUID hash link guard
  Fix #23 → zombie task SQL + listTasks filter
  Fix #24 → key={event.id}
  Fix #3  → waitForTransactionHash timeout

Phase 4 — Security + hardening (P3):
  Fix #33 → DB indexes (SQL, one-time)
  Fix #32 → array cast fix
  Fix #30 → task length validation
  Fix #28 → complete SSRF filter
  Fix #29 → pin dependencies
  Fix #31 → gate admin endpoint

Phase 5 — Architecture (post-hackathon):
  Fix #34 → durable job queue
  Fix #35 → eliminate self-calling
  Fix #36 → rate limiting middleware
```
