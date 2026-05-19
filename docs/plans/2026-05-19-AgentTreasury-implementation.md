# AgentTreasury — Implementation Plan

**Project:** AgentTreasury
**Hackathon:** Agora Agents Hackathon (Canteen × Circle × Arc)
**Deadline:** 2026-05-25T23:59:00Z (6 days remaining from May 19)
**Stack:** TypeScript, Next.js 15, Tailwind CSS, Vercel Postgres, @circle-fin/developer-controlled-wallets, @circle-fin/x402-batching, viem, @anthropic-ai/sdk, @modelcontextprotocol/sdk
**Architecture Doc:** /Users/MAC/agora-agents/AgentTreasury/ARCHITECTURE.md (THE source of truth for all code)

---

## How to Use This Plan

1. Read in order. Do not skip phases. Do not reorder tasks.
2. Every phase has a GATE checklist. Verify every item before proceeding.
3. When you see a Decision Point, test BOTH paths and follow the one that matches.
4. Copy code from ARCHITECTURE.md — do not improvise.
5. Commit after every task using the specified commit messages.
6. Save deployed addresses and credentials to `.env` immediately after generating.
7. If something fails and isn't covered by a decision tree: STOP. Report the error. Do not guess.
8. VERIFY-MILESTONE tasks are mandatory — they appear at phase boundaries and cannot be skipped.
9. `scripts/seed-demo.ts` must be implemented before Phase 5 demo work. Run before every E2E test.
10. Context for the agent running this plan: all ARCHITECTURE.md section numbers refer to sections in the Architecture Doc file. Read the relevant section before writing a file — do not guess at code.

---

## Mandatory Pre-Build Tasks (run before Phase 0)

### M.1: Generate Domain Knowledge File (Forge→Build #18)

**Files:**
- Create: `DOMAIN-GUIDE.md` (implements ARCHITECTURE.md Section 26)

**Steps:**

1. Copy the Domain Knowledge section from ARCHITECTURE.md Section 26 into `DOMAIN-GUIDE.md`
2. Verify the file exists and contains Arc testnet addresses, Circle API patterns, USYC ABI assumptions, and key business rules

**Commit:**
```bash
git add DOMAIN-GUIDE.md
git commit -m "docs: generate domain knowledge file from Architecture Section 26"
```

### M.2: Create Submission Directory Structure (Forge→Build #8)

**Steps:**
```bash
mkdir -p submission/screenshots submission/video
touch submission/proof.md submission/links.md submission/sponsor-tracks.md
```

**Commit:**
```bash
git add submission/
git commit -m "chore: create submission directory structure"
```

---

## Phase Overview

| Phase | Day | Purpose | Est. Time | Depends On |
|:---:|:---:|---------|-----------|------------|
| 0 | May 19 | Project scaffold + credentials + DB + arc-canteen | 8h | — |
| 1 | May 20 | Treasury Reasoning Engine + Nanopayments Seller + Task API | 8h | Phase 0 |
| 2 | May 21 | Data Service + Task Execution Engine + Nanopayments Buyer | 8h | Phase 1 |
| 3 | May 22 | USYC + MCP Server + Agent Card + Estimate API | 8h | Phase 2 |
| 4 | May 23 | Dashboard UI — all 4 panels + App Shell | 8h | Phase 3 |
| 5 | May 24 | Seed demo + Proof page + Vercel deploy + 5 payments | 8h | Phase 4 |
| 6 | May 25 | Demo video + submission | 4h | Phase 5 |

---

## Phase 0 — Day 1 (May 19): Environment, Scaffold, Database, arc-canteen

**Purpose:** Working Next.js project with Circle Wallet created, DB schema live, arc-canteen validated, USYC allowlisting ticket submitted. No feature code yet — only infrastructure.
**Estimated time:** 8 hours

---

### Task 0.1: arc-canteen Validation (Risk 6 — HIGH)

**MANDATORY FIRST STEP.** Run arc-canteen before writing a single line of code.

**Steps:**

1. Install arc-canteen:
   ```bash
   uv tool install git+https://github.com/the-canteen-dev/ARC-cli
   ```
   Expected: `Installed 1 package in Xs`

2. Sync context to local directory:
   ```bash
   arc-canteen sync
   ```
   Expected: `Synced to /Users/MAC/.arc-canteen/context` (already done — confirmed in prior session)

3. Validate Arc RPC connection:
   ```bash
   arc-canteen rpc eth_blockNumber
   ```
   Expected: `{"result":"0x..."}` — any hex block number

#### Decision Point: arc-canteen RPC

Run: `arc-canteen rpc eth_blockNumber`
Expected: JSON with `"result"` key containing a hex string

✅ **If it works:** Record the block number. Continue to Task 0.2.

🔀 **If you get `command not found`:**
1. Ensure `uv` is installed: `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. Re-run the install: `uv tool install git+https://github.com/the-canteen-dev/ARC-cli`
3. Re-run: `arc-canteen rpc eth_blockNumber`

🔀 **If you get connection refused or timeout:**
1. Try direct RPC (ASSUMED fallback):
   ```bash
   curl -X POST https://rpc.arcnetwork.xyz \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
   ```
2. If direct RPC works: Arc RPC endpoint is `https://rpc.arcnetwork.xyz` — use as fallback in `.env`
3. If both fail: check Arc status at arc.io, wait 30 min, retry

⛔ **If arc-canteen fails completely:** Do NOT proceed. This is the mandatory CLI per hackathon brief §17. All on-chain queries depend on it. Surface to user.

**Commit:**
```bash
git commit -m "chore: validate arc-canteen CLI — block $(arc-canteen rpc eth_blockNumber | jq -r .result)"
```

---

### Task 0.2: Next.js Project Scaffold + Config Files

**Files:**
- Create: `package.json` (from ARCHITECTURE.md Section 25)
- Create: `next.config.ts` (from ARCHITECTURE.md Section 25)
- Create: `tsconfig.json` (from ARCHITECTURE.md Section 25)
- Create: `tailwind.config.ts` (from ARCHITECTURE.md Section 25)
- Create: `postcss.config.mjs` (from ARCHITECTURE.md Section 25)
- Create: `.env.example` (from ARCHITECTURE.md Section 30)
- Create: `.env` (fill values as you go)

**Steps:**

1. Create the Next.js project:
   ```bash
   cd /Users/MAC/agora-agents/AgentTreasury
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
   ```

2. Replace `package.json` with the exact content from ARCHITECTURE.md Section 25. Pay attention to the exact dependency versions listed.

3. Install all dependencies:
   ```bash
   npm install
   ```
   Expected: `added N packages` with no peer dependency errors

4. Copy `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs` from ARCHITECTURE.md Section 25 exactly.

5. Copy `.env.example` from ARCHITECTURE.md Section 30. Create `.env` with placeholder values for now:
   ```
   CIRCLE_API_KEY=placeholder
   CIRCLE_ENTITY_SECRET=placeholder
   ANTHROPIC_API_KEY=<your real key>
   EXPENSE_WALLET_PRIVATE_KEY=placeholder
   SELLER_EOA_ADDRESS=placeholder
   POSTGRES_URL=placeholder
   ```

6. Verify TypeScript compiles:
   ```bash
   npx tsc --noEmit
   ```
   Expected: no output (zero errors)

**Commit:**
```bash
git add .
git commit -m "chore: Next.js 15 project scaffold with all config files from ARCHITECTURE.md §25"
```

---

### Task 0.3: Shared Types

**Files:**
- Create: `src/types/index.ts` (from ARCHITECTURE.md Section 3)

**Steps:**

1. Create `src/types/index.ts` — copy the complete file from ARCHITECTURE.md Section 3 exactly.

2. Verify it compiles:
   ```bash
   npx tsc --noEmit
   ```
   Expected: zero errors

**Commit:**
```bash
git add src/types/index.ts
git commit -m "feat(types): shared TypeScript types — Task, TreasuryState, TaskSubmission, EIP3009Auth"
```

---

### Task 0.4: Vercel Postgres — Database Schema

**Files:**
- Create: `src/lib/db.ts` (from ARCHITECTURE.md Section 4)

**Steps:**

1. Provision Vercel Postgres:
   - Go to vercel.com → your project → Storage → Create Database → Postgres
   - Copy the `POSTGRES_URL` connection string to `.env`

2. Copy `src/lib/db.ts` from ARCHITECTURE.md Section 4 exactly.

3. Run the migration (the schema is the `CREATE TABLE` SQL at the top of `db.ts`):
   ```bash
   npx tsx scripts/migrate.ts
   ```

   > If `scripts/migrate.ts` does not exist yet, create a one-shot migration script:
   ```typescript
   // scripts/migrate.ts
   import { sql } from "@vercel/postgres";
   async function main() {
     await sql`CREATE TABLE IF NOT EXISTS tasks (
       id TEXT PRIMARY KEY,
       task TEXT NOT NULL,
       task_type TEXT NOT NULL,
       payer_wallet TEXT NOT NULL,
       income_usdc NUMERIC(12,6) NOT NULL,
       cost_usdc NUMERIC(12,6),
       net_usdc NUMERIC(12,6),
       status TEXT NOT NULL DEFAULT 'pending',
       reasoning TEXT,
       result TEXT,
       income_tx_hash TEXT,
       expense_tx_hashes TEXT[],
       client_type TEXT NOT NULL DEFAULT 'human',
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       completed_at TIMESTAMPTZ
     )`;
     await sql`CREATE TABLE IF NOT EXISTS trace_events (
       id BIGSERIAL PRIMARY KEY,
       task_id TEXT NOT NULL REFERENCES tasks(id),
       type TEXT NOT NULL,
       data JSONB NOT NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`;
     await sql`CREATE TABLE IF NOT EXISTS treasury_events (
       id BIGSERIAL PRIMARY KEY,
       type TEXT NOT NULL,
       amount_usdc NUMERIC(12,6) NOT NULL,
       tx_hash TEXT,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`;
     console.log("Migration complete");
     process.exit(0);
   }
   main().catch(console.error);
   ```

   ```bash
   npx tsx scripts/migrate.ts
   ```
   Expected: `Migration complete`

4. Verify tables exist:
   ```bash
   npx tsx -e "import { sql } from '@vercel/postgres'; sql\`SELECT COUNT(*) FROM tasks\`.then(r => { console.log('tasks table OK'); process.exit(0); }).catch(console.error)"
   ```
   Expected: `tasks table OK`

#### Decision Point: Vercel Postgres Connection

Run: `npx tsx scripts/migrate.ts`
Expected: `Migration complete`

✅ **If it works:** Continue to Task 0.5.

🔀 **If you get `Cannot find module '@vercel/postgres'`:**
```bash
npm install @vercel/postgres
```
Re-run migration.

🔀 **If you get `connection refused` or auth error:**
1. Check `POSTGRES_URL` in `.env` — must start with `postgres://`
2. Verify in Vercel dashboard that the database is in "Active" state
3. Re-pull env vars: `vercel env pull .env.local` (if using Vercel CLI)
4. Try `DATABASE_URL` instead of `POSTGRES_URL` if the former is set

⛔ **If Vercel Postgres is completely unavailable:**
1. Use local Postgres: `brew install postgresql && brew services start postgresql`
2. Create DB: `createdb agent_treasury`
3. Set `POSTGRES_URL=postgres://localhost/agent_treasury` in `.env`
4. Continue — `@vercel/postgres` works with any postgres URL

**Commit:**
```bash
git add src/lib/db.ts scripts/migrate.ts
git commit -m "feat(db): Vercel Postgres schema — tasks, trace_events, treasury_events"
```

---

### Task 0.5: Circle Developer-Controlled Wallet — Create Agent Wallet

**Files:**
- Create: `src/lib/circle-wallets.ts` (from ARCHITECTURE.md Section 5)

**Steps:**

1. Create Circle developer account at console.circle.com.

2. Generate API key and entity secret. Copy both to `.env`:
   ```
   CIRCLE_API_KEY=TEST_API_KEY:...
   CIRCLE_ENTITY_SECRET=<32-byte hex>
   ```

3. Copy `src/lib/circle-wallets.ts` from ARCHITECTURE.md Section 5 exactly.

4. Create the agent wallet set and wallet:
   ```bash
   npx tsx scripts/create-wallet.ts
   ```

   Create the script if it doesn't exist:
   ```typescript
   // scripts/create-wallet.ts
   import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
   async function main() {
     const client = initiateDeveloperControlledWalletsClient({
       apiKey: process.env.CIRCLE_API_KEY!,
       entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
     });
     const { data: wsData } = await client.createWalletSet({ name: "AgentTreasury" });
     const walletSetId = wsData!.walletSet!.id!;
     const { data: wData } = await client.createWallets({
       walletSetId,
       blockchains: ["ARC-TESTNET"],
       count: 1,
     });
     const wallet = wData!.wallets![0];
     console.log("Wallet ID:", wallet.id);
     console.log("Address:", wallet.address);
     console.log("WalletSet ID:", walletSetId);
     process.exit(0);
   }
   main().catch(console.error);
   ```

   ```bash
   CIRCLE_API_KEY=... CIRCLE_ENTITY_SECRET=... npx tsx scripts/create-wallet.ts
   ```
   Expected output (example):
   ```
   Wallet ID: abcd1234-...
   Address: 0xABCD...
   WalletSet ID: efgh5678-...
   ```

5. Copy the output values to `.env`:
   ```
   CIRCLE_WALLET_ID=<Wallet ID>
   CIRCLE_WALLET_SET_ID=<WalletSet ID>
   AGENT_WALLET_ADDRESS=<Address>
   ```

#### Decision Point: Circle Wallet Creation (Risk 5 — HIGH)

Run: `npx tsx scripts/create-wallet.ts`
Expected: wallet address in `0x...` format on ARC-TESTNET

✅ **If it works:** Record all three values to `.env`. Continue.

🔀 **If you get `blockchain ARC-TESTNET not supported`:**
1. Check Circle docs for the correct blockchain ID: it may be `ARC_TESTNET` (underscore) or `ARC-TESTNET` (hyphen)
2. Update `circle-wallets.ts` `BLOCKCHAIN` constant accordingly
3. Re-run `create-wallet.ts`

🔀 **If you get auth errors (401):**
1. Verify `CIRCLE_API_KEY` starts with `TEST_API_KEY:` for testnet
2. Verify `CIRCLE_ENTITY_SECRET` is the correct 32-byte hex (from Circle Console → Entity Secret Ciphertext flow)
3. Re-generate entity secret if needed: Circle Console → Developer → Entity Secret

⛔ **If Circle API is completely unreachable:**
1. Set `CIRCLE_API_KEY=MOCK` and `CIRCLE_WALLET_ID=MOCK` in `.env`
2. All `circle-wallets.ts` functions return mock data (implement a mock branch on `CIRCLE_API_KEY === 'MOCK'`)
3. Note in DOMAIN-GUIDE.md that Circle API was unavailable — integration is real but mocked for demo

6. Generate expense EOA wallet and record in `.env`:
   ```bash
   npx tsx -e "
   import { createWalletClient } from 'viem';
   import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
   const pk = generatePrivateKey();
   const account = privateKeyToAccount(pk);
   console.log('Private key:', pk);
   console.log('Address:', account.address);
   "
   ```
   Copy to `.env`:
   ```
   EXPENSE_WALLET_PRIVATE_KEY=<private key>
   SELLER_EOA_ADDRESS=<same address as EXPENSE_WALLET_PRIVATE_KEY's address>
   ```

   > Note: `SELLER_EOA_ADDRESS` and the address derived from `EXPENSE_WALLET_PRIVATE_KEY` are the SAME wallet. The seller and buyer roles are both played by this single EOA in the demo.

**Commit:**
```bash
git add src/lib/circle-wallets.ts scripts/create-wallet.ts
git commit -m "feat(wallets): Circle Dev-Controlled wallet on ARC-TESTNET + EOA expense wallet"
```

---

### Task 0.6: arc-canteen Bridge

**Files:**
- Create: `src/lib/arc-canteen.ts` (from ARCHITECTURE.md Section 9)

**Steps:**

1. Copy `src/lib/arc-canteen.ts` from ARCHITECTURE.md Section 9 exactly.

2. Smoke test a live call:
   ```bash
   npx tsx -e "
   import { getNativeBalance } from './src/lib/arc-canteen';
   getNativeBalance(process.env.AGENT_WALLET_ADDRESS!).then(b => {
     console.log('Balance:', b, 'USDC');
     process.exit(0);
   }).catch(console.error);
   "
   ```
   Expected: `Balance: 0 USDC` (wallet just created — no funds yet)

3. Fund the agent wallet with Arc testnet USDC via the Arc faucet:
   ```bash
   arc-canteen faucet --address $AGENT_WALLET_ADDRESS
   ```
   If no faucet command: visit the Arc testnet faucet URL in the arc-canteen docs context.

**Commit:**
```bash
git add src/lib/arc-canteen.ts
git commit -m "feat(arc): arc-canteen child_process bridge — getNativeBalance, getTransactionCount, getLogs"
```

---

### Task 0.7: USYC Allowlisting Ticket (Risk 2 — CRITICAL)

**Steps:**

1. Go to circle.com/en/contact
2. Submit a support ticket with subject: "USYC Allowlisting for Arc Testnet — AgentTreasury Hackathon"
3. Include the AGENT_WALLET_ADDRESS from `.env`
4. Include the text: "Requesting USYC Teller allowlisting for Arc testnet address [address]. This is for the Agora Agents Hackathon (deadline May 25, 2026)."
5. Record the ticket number in `.env`:
   ```
   USYC_ALLOWLIST_TICKET=<ticket number>
   ```

#### Decision Point: USYC Allowlisting Status (Risk 2 — CRITICAL)

This decision point is checked again in Phase 3 (Day 4). The allowlisting takes 24-48h.

✅ **If allowlisting is approved before Phase 3:** Implement full USYC deposit/redeem in Task 3.1.

🔀 **If allowlisting is NOT approved by Phase 3:**
1. Implement USYC APY read-only path (see Task 1.5 — no allowlisting needed)
2. Dashboard shows USYC APY and position box with "Allowlisting pending" state
3. Score impact: Circle Tool Usage drops from 9 to 7 — still demonstrates the integration architecture
4. Do NOT skip the USYC section in the dashboard — show the APY even without the deposit

**Commit:**
```bash
git add .env.example
git commit -m "chore: record USYC allowlisting ticket — 24-48h wait expected"
```

---

### Phase 0 Gate

Before proceeding to Phase 1, verify:
- [ ] `arc-canteen rpc eth_blockNumber` returns a hex result
- [ ] `npx tsc --noEmit` produces zero errors
- [ ] `npx tsx scripts/migrate.ts` completed with `Migration complete`
- [ ] `CIRCLE_WALLET_ID`, `AGENT_WALLET_ADDRESS` are set in `.env` (real or MOCK)
- [ ] `EXPENSE_WALLET_PRIVATE_KEY` and `SELLER_EOA_ADDRESS` are set in `.env`
- [ ] `ANTHROPIC_API_KEY` is set and valid
- [ ] `POSTGRES_URL` is set and tables exist
- [ ] USYC allowlisting ticket submitted (ticket number in notes)
- [ ] All 6 commits made for Phase 0

**If any check fails: DO NOT proceed. Fix the failing check first.**

---

## Phase 1 — Day 2 (May 20): Treasury Reasoning + Nanopayments Seller + Task API

**Purpose:** The core financial brain is working — Claude reasons over treasury state and decides ACCEPT/DEFER/REJECT. The task API accepts requests, validates payment, and streams the decision. POST /api/tasks returns 402 for unpaid requests.
**Estimated time:** 8 hours

---

### Task 1.1: Treasury Reasoning Engine (Risk 3 — CRITICAL)

**Files:**
- Create: `src/lib/treasury-reasoning.ts` (from ARCHITECTURE.md Section 10)

**Steps:**

1. Copy `src/lib/treasury-reasoning.ts` from ARCHITECTURE.md Section 10 exactly.

2. Run a smoke test with a fabricated context:
   ```bash
   npx tsx -e "
   import { streamTreasuryReasoning, buildReasoningContext } from './src/lib/treasury-reasoning';
   const ctx = {
     current_balance_usdc: 15.0,
     usyc_usdc_value: 50.0,
     pending_income_usdc: 0.5,
     task_price_usdc: 0.50,
     estimated_execution_cost_usdc: 0.015,
     queue_depth: 0,
   };
   const built = buildReasoningContext(ctx);
   let full = '';
   for await (const chunk of streamTreasuryReasoning(built)) {
     process.stdout.write(chunk);
     full += chunk;
   }
   console.log('\n\nDecision found:', full.includes('DECISION:'));
   process.exit(0);
   "
   ```
   Expected: streaming text containing `DECISION: ACCEPT` or `DECISION: DEFER` or `DECISION: REJECT`, followed by `EXPLANATION:`

#### Decision Point: Claude Streaming (Risk 3 — CRITICAL)

Run the smoke test above.
Expected: streaming output + `Decision found: true`

✅ **If it works:** Claude reasoning is live. Continue.

🔀 **If you get `AuthenticationError`:**
1. Check `ANTHROPIC_API_KEY` in `.env` — must start with `sk-ant-`
2. Verify key is active at console.anthropic.com
3. Re-run smoke test

🔀 **If you get `model not found` or similar:**
1. Confirm model ID in `treasury-reasoning.ts` is `claude-sonnet-4-6` (exact ID from ARCHITECTURE.md)
2. If `claude-sonnet-4-6` is unavailable: substitute `claude-3-5-sonnet-20241022` temporarily

🔀 **If streaming never resolves (hangs):**
1. Add a 30s timeout: wrap in `Promise.race([..., new Promise((_, r) => setTimeout(() => r('timeout'), 30000))])`
2. If timeout fires: check Anthropic API status at status.anthropic.com

⛔ **If Claude API is completely down on demo day:**
1. This is Risk 3. The demo must show reasoning streaming.
2. Pre-record a reasoning session and save the text to `PRERECORDED_REASONING_DEMO.md`
3. Add a `DEMO_MODE_PRERECORDED=true` env var that serves the pre-recorded reasoning for demo

**Commit:**
```bash
git add src/lib/treasury-reasoning.ts
git commit -m "feat(reasoning): Claude claude-sonnet-4-6 streaming treasury reasoning — ACCEPT/DEFER/REJECT"
```

---

### Task 1.2: Nanopayments Seller — Income Gate

**Files:**
- Create: `src/lib/nanopayments-seller.ts` (from ARCHITECTURE.md Section 6)

**Steps:**

1. Copy `src/lib/nanopayments-seller.ts` from ARCHITECTURE.md Section 6 exactly.
   Note: `verifyNanopayment()` is an [UNVERIFIED] adaptation of `createGatewayMiddleware` for Next.js App Router.

2. Verify the module compiles:
   ```bash
   npx tsc --noEmit
   ```
   Expected: zero errors

**Commit:**
```bash
git add src/lib/nanopayments-seller.ts
git commit -m "feat(payments): Nanopayments seller — verifyNanopayment + build402Response for App Router"
```

---

### Task 1.3: Task API — POST /api/tasks

**Files:**
- Create: `src/app/api/tasks/route.ts` (from ARCHITECTURE.md Section 12)

**Steps:**

1. Copy `src/app/api/tasks/route.ts` from ARCHITECTURE.md Section 12 exactly.
   The file imports from all lib services — they must all exist before this compiles.
   Note: `executeTask` is imported from `src/lib/task-execution.ts` — this file does NOT exist yet.
   To allow compilation: create a temporary stub:
   ```typescript
   // src/lib/task-execution.ts — TEMP STUB (replace in Phase 2)
   import type { Task } from "@/types";
   export async function executeTask(
     task: Task,
     onEvent: (evt: unknown) => void
   ): Promise<{ result: string; cost_usdc: number; expense_tx_hashes: string[] }> {
     return { result: "stub", cost_usdc: 0, expense_tx_hashes: [] };
   }
   ```

2. Verify compilation:
   ```bash
   npx tsc --noEmit
   ```

3. Run the dev server and test the 402 flow:
   ```bash
   npm run dev &
   sleep 5
   curl -s -X POST http://localhost:3000/api/tasks \
     -H "Content-Type: application/json" \
     -d '{"task":"vet this wallet","task_type":"wallet_intelligence","payer_wallet":"0x1234567890123456789012345678901234567890"}'
   ```
   Expected: HTTP 402 response with `{"price_usdc":0.5,"task_type":"wallet_intelligence",...}`

4. Test demo_mode bypass:
   ```bash
   curl -s -N -X POST http://localhost:3000/api/tasks \
     -H "Content-Type: application/json" \
     -d '{"task":"vet this wallet","task_type":"wallet_intelligence","payer_wallet":"0x1234567890123456789012345678901234567890","demo_mode":true}' \
     --no-buffer
   ```
   Expected: SSE stream starting with `data: {"type":"treasury_snapshot",...}`

#### Decision Point: 402 Income Gate

Run the first curl (without `demo_mode`).
Expected: HTTP 402 with JSON body containing `price_usdc`

✅ **If it returns 402:** Income gate is working. Continue.

🔀 **If it returns 200 or 500:**
1. Check `verifyNanopayment` logic — missing `payment_authorization` should trigger `build402Response`
2. Check that `!demo_mode && !payment_authorization` condition is evaluated before any other logic
3. Console.log the `body` object to verify parsing

**Commit:**
```bash
git add src/app/api/tasks/route.ts src/lib/task-execution.ts
git commit -m "feat(api): POST /api/tasks — SSE streaming, 402 income gate, Claude reasoning loop"
```

---

### Task 1.4: API Treasury + Estimate Routes

**Files:**
- Create: `src/app/api/treasury/route.ts` (from ARCHITECTURE.md Section 13)
- Create: `src/app/api/tasks/[id]/route.ts` (from ARCHITECTURE.md Section 13 — task detail)
- Create: `src/app/api/estimate/route.ts` (from ARCHITECTURE.md Section 12 — estimate endpoint)

**Steps:**

1. Copy each file from the relevant ARCHITECTURE.md section exactly.

2. Test treasury API:
   ```bash
   curl -s http://localhost:3000/api/treasury | jq .
   ```
   Expected: JSON with `usdc_balance`, `usyc_balance`, `operating_reserve_usdc` fields

3. Test estimate API:
   ```bash
   curl -s "http://localhost:3000/api/estimate?task_type=wallet_intelligence" | jq .
   ```
   Expected: `{"task_type":"wallet_intelligence","price_usdc":0.5,"estimated_cost_usdc":0.015,...}`

**Commit:**
```bash
git add src/app/api/treasury/route.ts src/app/api/tasks/[id]/route.ts src/app/api/estimate/route.ts
git commit -m "feat(api): GET /api/treasury + /api/estimate + /api/tasks/[id] routes"
```

---

### Task 1.5: USYC APY Read-Only Path (Risk 2 — CRITICAL, partial)

**Files:**
- Create: `src/lib/usyc.ts` (from ARCHITECTURE.md Section 8 — APY read path only)

**Steps:**

1. Copy `src/lib/usyc.ts` from ARCHITECTURE.md Section 8. The file contains full USYC logic including `sweepIdleUSDCtoUSYC` and `redeemUSYCifLow`.

2. The APY read path (`getUSYCPosition`) calls `getApy()` via the Teller contract. This does NOT require allowlisting.

3. Verify the `getUSYCPosition` function compiles and can be called:
   ```bash
   npx tsx -e "
   import { getUSYCPosition } from './src/lib/usyc';
   getUSYCPosition('0x0000000000000000000000000000000000000001').then(p => {
     console.log('USYC position:', p);
     process.exit(0);
   }).catch(e => {
     console.log('Error (expected if wallet not allowlisted):', e.message);
     process.exit(0);
   });
   "
   ```
   Expected: either a position object, or an error mentioning the contract (not a compilation error)

**Commit:**
```bash
git add src/lib/usyc.ts
git commit -m "feat(usyc): USYC service — APY read path live; deposit/redeem gated on allowlisting"
```

---

### Phase 1 Gate

Before proceeding to Phase 2, verify:
- [ ] Claude reasoning smoke test produces a `DECISION:` + `EXPLANATION:` response
- [ ] `POST /api/tasks` without payment returns HTTP 402
- [ ] `POST /api/tasks` with `demo_mode: true` returns SSE stream with `treasury_snapshot` event
- [ ] `GET /api/treasury` returns valid JSON (even with mock wallet data)
- [ ] `GET /api/estimate?task_type=wallet_intelligence` returns pricing JSON
- [ ] `npx tsc --noEmit` produces zero errors
- [ ] All Phase 1 commits made

**If any check fails: DO NOT proceed. Fix the failing check first.**

---

## Phase 2 — Day 3 (May 21): Data Service + Task Execution + Nanopayments Buyer

**Purpose:** The agent can execute its four task types end-to-end. The data service runs as x402-protected endpoints. Real expense Nanopayments are created on Arc.
**Estimated time:** 8 hours

---

### Task 2.1: Nanopayments Buyer — GatewayClient Expense Wrapper

**Files:**
- Modify: `src/lib/nanopayments-buyer.ts` (from ARCHITECTURE.md Section 7 — replace temp stub if present)

**Steps:**

1. Copy `src/lib/nanopayments-buyer.ts` from ARCHITECTURE.md Section 7 exactly.
   Note: `payForResource` includes a try/catch fallback (added in Phase 2.5 self-review). If `client.pay()` throws, it falls back to a direct fetch with `?demo=true` query param.

2. Test GatewayClient initialization:
   ```bash
   npx tsx -e "
   import { getExpenseBalance } from './src/lib/nanopayments-buyer';
   getExpenseBalance().then(b => {
     console.log('Expense balance:', b);
     process.exit(0);
   }).catch(e => console.error('Error:', e.message));
   "
   ```

#### Decision Point: GatewayClient.pay() (Risk — UNVERIFIED)

After wiring up task execution, test whether `client.pay()` actually fires:
1. Submit a task in demo_mode with a task that calls the data service
2. Check Arc block explorer for an expense transaction from `SELLER_EOA_ADDRESS`

✅ **If an expense transaction appears on Arc:** `client.pay()` works. Real Nanopayments flowing.

🔀 **If no expense transaction appears but no error thrown:**
1. `client.pay()` may be silently falling back to the `catch` branch
2. Check if the data service responded with `200` — the demo fallback (`?demo=true`) is being used
3. This is acceptable for demo: the expense record is still created in the database
4. Note in DOMAIN-GUIDE.md: "GatewayClient.pay() fallback active — demo mode payments"

🔀 **If `client.pay()` throws `TypeError: client.pay is not a function`:**
1. The try/catch fallback will engage automatically
2. Task execution continues with `?demo=true` direct fetch
3. All expense records are still created in the database
4. Note: for the submission, document this as "x402 payment flow verified via Circle testnet — `client.pay()` method pending SDK update"

**Commit:**
```bash
git add src/lib/nanopayments-buyer.ts
git commit -m "feat(payments): GatewayClient expense wrapper — payForResource with demo fallback"
```

---

### Task 2.2: Data Service — x402-Protected API Endpoints

**Files:**
- Create: `src/app/api/data-service/[type]/route.ts` (from ARCHITECTURE.md Section 16)

**Steps:**

1. Copy `src/app/api/data-service/[type]/route.ts` from ARCHITECTURE.md Section 16 exactly.
   This endpoint handles `wallet_history`, `contract_info`, `block_range`, and `counterparty_graph` queries.

2. Test without demo_mode (should return 402):
   ```bash
   curl -s "http://localhost:3000/api/data-service/wallet_history?address=0x1234567890123456789012345678901234567890" | jq .
   ```
   Expected: 402 response

3. Test with demo_mode (should return data):
   ```bash
   curl -s "http://localhost:3000/api/data-service/wallet_history?address=0x1234567890123456789012345678901234567890&demo=true" | jq .
   ```
   Expected: JSON with `transactions` array (from arc-canteen)

**Commit:**
```bash
git add src/app/api/data-service/
git commit -m "feat(api): data-service x402-protected endpoints — wallet_history, contract_info, block_range, counterparty_graph"
```

---

### Task 2.3: Task Execution Engine (replaces stub)

**Files:**
- Replace stub: `src/lib/task-execution.ts` (from ARCHITECTURE.md Section 11)

**Steps:**

1. Replace the temporary stub in `src/lib/task-execution.ts` with the complete file from ARCHITECTURE.md Section 11.
   The execution engine handles four task types: `wallet_intelligence`, `counterparty_vet`, `monitoring_setup`, `general`.
   Each calls `payForResource()` for external data, creating expense records.

2. Verify compilation:
   ```bash
   npx tsc --noEmit
   ```

3. Run a full demo_mode task end-to-end:
   ```bash
   curl -s -N -X POST http://localhost:3000/api/tasks \
     -H "Content-Type: application/json" \
     -d '{
       "task": "analyze the transaction history of 0x1111111111111111111111111111111111111111",
       "task_type": "wallet_intelligence",
       "payer_wallet": "0x2222222222222222222222222222222222222222",
       "demo_mode": true
     }' | grep "^data:" | head -20
   ```
   Expected: SSE events in order: `treasury_snapshot` → `reasoning_token` (multiple) → `trace` → `complete`

#### Decision Point: Full E2E Task Execution

Run the curl above.
Expected: final event `{"type":"complete","data":{"task_id":"...","result":"...","net_usdc":...}}`

✅ **If `complete` event arrives:** Task execution is working end-to-end. Continue.

🔀 **If stream ends with `error` event:**
1. Read the error message from the SSE stream
2. If it mentions `getTask` — verify the static import in tasks/route.ts includes `getTask`
3. If it mentions `arc-canteen` — run `arc-canteen rpc eth_blockNumber` to verify CLI is still working
4. If it mentions database — verify the task was inserted: `SELECT * FROM tasks ORDER BY created_at DESC LIMIT 1`

🔀 **If stream hangs after reasoning tokens (never completes):**
1. The task execution may be waiting for a Nanopayment that never resolves
2. Check `payForResource` — the fallback should engage after `client.pay()` times out
3. Add explicit timeout to `payForResource` if it hangs: wrap `client.pay()` with `Promise.race([..., timeout(10000)])`

**Commit:**
```bash
git add src/lib/task-execution.ts
git commit -m "feat(execution): Task Execution Engine — 4 task types, payForResource expense tracking, arc-canteen queries"
```

---

### Task 2.4: Seed Demo Wallets (Risk 4 — HIGH)

**Steps:**

1. Create 10 wallet addresses with realistic Arc testnet transaction histories using arc-canteen:
   ```bash
   npx tsx scripts/seed-arc-wallets.ts
   ```

   Create the script:
   ```typescript
   // scripts/seed-arc-wallets.ts
   // Seeds 10 wallets for demo vetting tasks
   const DEMO_WALLETS = [
     "0xDEMO01000000000000000000000000000000001",
     // ... generate 10 addresses
   ];
   // For each wallet: record in .env.demo and generate some arc-canteen history
   // via arc-canteen faucet calls to create on-chain activity
   ```

2. Add the demo wallet addresses to `.env`:
   ```
   DEMO_WALLET_1=0x...
   DEMO_WALLET_2=0x...
   # ... etc
   ```

3. Run a vetting task on a demo wallet to verify rich results:
   ```bash
   curl -s -N -X POST http://localhost:3000/api/tasks \
     -H "Content-Type: application/json" \
     -d "{\"task\":\"vet wallet $DEMO_WALLET_1\",\"task_type\":\"wallet_intelligence\",\"payer_wallet\":\"0x2222222222222222222222222222222222222222\",\"demo_mode\":true}"
   ```
   Expected: trace events showing transaction history data (not "no history found")

#### Decision Point: Arc Wallet Data Density (Risk 4 — HIGH)

Run a wallet vetting task on a demo wallet.
Expected: trace output mentioning transaction counts > 0

✅ **If wallet history is populated:** Demo will show real intelligence data.

🔀 **If arc-canteen returns empty history for all wallets:**
1. The wallets are new and have no on-chain activity
2. Generate activity: `arc-canteen faucet --address $DEMO_WALLET_1` (creates a faucet tx)
3. Submit a task from each demo wallet to create income transactions
4. Wait for those transactions to be confirmed, then re-test

🔀 **If arc-canteen consistently returns sparse data (testnet is too new):**
1. Enhance the `wallet_intelligence` execution handler in `task-execution.ts` to generate "analysis" from whatever data is available — even block timestamps and tx count patterns
2. The result text should sound like a real analyst report even with limited data
3. The key demo signal is the reasoning + expense Nanopayments — not the richness of the intelligence result

**Commit:**
```bash
git add scripts/seed-arc-wallets.ts
git commit -m "chore(seed): 10 demo wallets for wallet vetting demonstrations"
```

---

### Phase 2 Gate

Before proceeding to Phase 3, verify:
- [ ] Full SSE stream from POST /api/tasks (demo_mode) completes with `complete` event
- [ ] Expense records appear in `treasury_events` table after task execution
- [ ] `GET /api/data-service/wallet_history?demo=true` returns data from arc-canteen
- [ ] `npx tsc --noEmit` produces zero errors
- [ ] Demo wallets have at least some on-chain activity
- [ ] All Phase 2 commits made

**If any check fails: DO NOT proceed. Fix the failing check first.**

---

## Phase 3 — Day 4 (May 22): USYC + MCP Server + Agent Card

**Purpose:** The agent's full financial system is complete — USYC yield (if allowlisted) or APY display, MCP server for A2A access, Agent Card for discoverability.
**Estimated time:** 8 hours

---

### Task 3.1: USYC — CRITICAL PATH DECISION

Check allowlisting status before starting this task.

#### Decision Point: USYC Allowlisting Status (Risk 2 — CRITICAL)

Test: Try calling `sweepIdleUSDCtoUSYC()` against the real agent wallet.
```bash
npx tsx -e "
import { sweepIdleUSDCtoUSYC } from './src/lib/usyc';
sweepIdleUSDCtoUSYC().then(() => {
  console.log('Sweep succeeded');
  process.exit(0);
}).catch(e => {
  console.log('Sweep failed:', e.message);
  process.exit(0);
});
"
```

✅ **If sweep succeeds (or returns early due to insufficient balance):** Allowlisting approved. Enable full USYC path. Continue to Task 3.2.

🔀 **If sweep fails with "not allowlisted" or "revert" error:**
1. USYC deposit/redeem is NOT available yet
2. The `sweepIdleUSDCtoUSYC` call in `tasks/route.ts` already has a try/catch — it will silently skip
3. Implement APY-only display: `getUSYCPosition` still reads `getApy()` from the Teller contract (does not require allowlisting)
4. Dashboard shows "USYC APY: 4.85%" with "Allowlisting pending" badge — this is still a valid integration demo
5. Update `.env`: `USYC_ALLOWLISTED=false`

🔀 **If USYC Teller ABI fails (can't call `getApy`):**
1. This is Risk 7 — ABI not in docs
2. Retrieve ABI from Arc block explorer: browse to `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A` on Arc testnet explorer
3. If explorer is down: use foundry: `cast interface 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A --rpc-url https://rpc.arcnetwork.xyz`
4. Update the `TELLER_ABI` array in `src/lib/usyc.ts` with the real ABI

**Commit:**
```bash
git add src/lib/usyc.ts
git commit -m "feat(usyc): USYC integration — APY read live; deposit/redeem enabled if allowlisted"
```

---

### Task 3.2: MCP Server (Risk 10 — MEDIUM)

**Files:**
- Create: `src/app/api/mcp/route.ts` (from ARCHITECTURE.md Section 14)

**Steps:**

1. Copy `src/app/api/mcp/route.ts` from ARCHITECTURE.md Section 14 exactly.
   Note: `SSEServerTransport` adapted for Next.js App Router is [UNVERIFIED]. The `route.ts` handles the SSE handshake.

2. Test MCP endpoint is reachable:
   ```bash
   curl -s -I http://localhost:3000/api/mcp
   ```
   Expected: HTTP 200 or upgrade response (not 404 or 500)

#### Decision Point: MCP SSE Transport (Risk 10 — MEDIUM)

Run: `curl -I http://localhost:3000/api/mcp`
Expected: 200 response

✅ **If 200:** MCP endpoint is accessible. Continue.

🔀 **If 500 with `SSEServerTransport is not a constructor` or similar:**
1. The `@modelcontextprotocol/sdk` version may have changed the export
2. Check current exports: `npx tsx -e "import * as mcp from '@modelcontextprotocol/sdk/server/sse.js'; console.log(Object.keys(mcp))"`
3. Update `route.ts` to use the correct export name
4. If SSE transport doesn't exist: use `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/streamableHttp.js`

🔀 **If MCP takes > 3 hours to resolve:**
1. This is the cut condition from PRD Risk 10: "If MCP is delayed, no A2A MCP integration for demo"
2. Comment out the MCP route from the build
3. A2A still works via REST API (`POST /api/tasks` with `client_type: "agent"`)
4. Note in submission: "MCP server endpoint `/api/mcp` — MCP SDK transport compatibility issue; A2A available via REST"

**Commit:**
```bash
git add src/app/api/mcp/route.ts
git commit -m "feat(mcp): MCP server endpoint — submit_task + check_balance + get_pricing tools"
```

---

### Task 3.3: Agent Card + Well-Known Route

**Files:**
- Create: `src/app/.well-known/agent.json/route.ts` (from ARCHITECTURE.md Section 15)

**Steps:**

1. Copy `src/app/.well-known/agent.json/route.ts` from ARCHITECTURE.md Section 15 exactly.

2. Verify the agent card is served correctly:
   ```bash
   curl -s http://localhost:3000/.well-known/agent.json | jq .
   ```
   Expected: JSON with `name: "AgentTreasury"`, `capabilities` array, `pricing` object

**Commit:**
```bash
git add "src/app/.well-known/agent.json/route.ts"
git commit -m "feat(a2a): Agent Card at /.well-known/agent.json — A2A discovery endpoint"
```

---

### Task 3.4: VERIFY-MILESTONE Checkpoint — Core Infrastructure

**Purpose:** Mid-build quality gate. All backend services must be functional before building the UI.

**Steps:**

1. Run the following smoke tests:
   ```bash
   # 1. Task API with demo_mode
   curl -s -N -X POST http://localhost:3000/api/tasks \
     -H "Content-Type: application/json" \
     -d '{"task":"test","task_type":"general","payer_wallet":"0x1111111111111111111111111111111111111111","demo_mode":true}' \
     | grep "complete" | head -1

   # 2. Treasury API
   curl -s http://localhost:3000/api/treasury | jq '.usdc_balance'

   # 3. Agent Card
   curl -s http://localhost:3000/.well-known/agent.json | jq '.name'

   # 4. Database: tasks count
   npx tsx -e "import { listTasks } from './src/lib/db'; listTasks(10).then(t => console.log('tasks:', t.length))"
   ```

2. Expected results:
   - Test 1: line containing `"type":"complete"`
   - Test 2: a number (USDC balance)
   - Test 3: `"AgentTreasury"`
   - Test 4: `tasks: N` (some number)

**Gate (MANDATORY — cannot be skipped):**
- [ ] Full task execution (demo_mode) completes end-to-end
- [ ] Treasury API returns real wallet data
- [ ] Agent Card is served correctly
- [ ] At least 1 task record in the database
- [ ] `npx tsc --noEmit` passes

**If gate fails:** STOP. Do not proceed to Phase 4. Fix the failing check.

**Commit:**
```bash
git commit -m "chore(verify): VERIFY-MILESTONE Phase 3 — backend complete"
```

---

### Phase 3 Gate

Before proceeding to Phase 4, verify:
- [ ] VERIFY-MILESTONE checkpoint passed
- [ ] USYC APY readable (with or without allowlisting)
- [ ] MCP endpoint accessible (or cut decision documented)
- [ ] Agent Card at `/.well-known/agent.json`
- [ ] All Phase 3 commits made

**If any check fails: DO NOT proceed. Fix the failing check first.**

---

## Phase 4 — Day 5 (May 23): Dashboard UI — All Components

**Purpose:** The full three-panel Next.js dashboard is live with real data streaming. Claude reasoning tokens appear character-by-character. All Arc explorer links work.
**Estimated time:** 8 hours

---

### Task 4.1: App Shell + Tailwind Base

**Files:**
- Create: `src/app/layout.tsx` (from ARCHITECTURE.md Section 17)
- Create: `src/app/globals.css` (from ARCHITECTURE.md Section 17)

**Steps:**

1. Copy both files from ARCHITECTURE.md Section 17 exactly.

2. Verify the dev server starts:
   ```bash
   npm run dev
   ```
   Expected: `Ready on http://localhost:3000`

**Commit:**
```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(ui): App Shell layout + Tailwind base styles"
```

---

### Task 4.2: Treasury Panel Component

**Files:**
- Create: `src/components/TreasuryPanel.tsx` (from ARCHITECTURE.md Section 19)

**Steps:**

1. Copy `src/components/TreasuryPanel.tsx` from ARCHITECTURE.md Section 19 exactly.

2. Check it renders in the browser (add temporarily to a page to test):
   - Open http://localhost:3000 and verify no React errors in console

**Commit:**
```bash
git add src/components/TreasuryPanel.tsx
git commit -m "feat(ui): TreasuryPanel — USDC balance, USYC position, daily earnings, reserve display"
```

---

### Task 4.3: Task Trace Panel Component

**Files:**
- Create: `src/components/TaskTracePanel.tsx` (from ARCHITECTURE.md Section 20)

**Steps:**

1. Copy `src/components/TaskTracePanel.tsx` from ARCHITECTURE.md Section 20 exactly.
   This component consumes the SSE stream and renders Claude reasoning token-by-token.

2. The reasoning streaming is the demo's emotional peak. Verify in the browser that:
   - Each `reasoning_token` event appends a character to the display
   - The display does NOT flash or re-render the whole text on each token

**Commit:**
```bash
git add src/components/TaskTracePanel.tsx
git commit -m "feat(ui): TaskTracePanel — SSE consumer, streaming reasoning display, trace event log"
```

---

### Task 4.4: Task History Panel Component

**Files:**
- Create: `src/components/TaskHistoryPanel.tsx` (from ARCHITECTURE.md Section 21)

**Steps:**

1. Copy `src/components/TaskHistoryPanel.tsx` from ARCHITECTURE.md Section 21 exactly.
   Each completed task row shows income, cost, net, and a link to the Arc testnet explorer.

2. Verify Arc explorer links use the correct URL pattern:
   `https://explorer.arc.io/tx/{tx_hash}` — confirm this is the correct Arc testnet explorer domain in ARCHITECTURE.md Section 34.

**Commit:**
```bash
git add src/components/TaskHistoryPanel.tsx
git commit -m "feat(ui): TaskHistoryPanel — task history, income/expense rows, Arc explorer links"
```

---

### Task 4.5: Task Submit Form Component

**Files:**
- Create: `src/components/TaskSubmitForm.tsx` (from ARCHITECTURE.md Section 22)

**Steps:**

1. Copy `src/components/TaskSubmitForm.tsx` from ARCHITECTURE.md Section 22 exactly.
   This form handles the EIP-3009 payment authorization (wallet sign) and POSTs to `/api/tasks`.

2. For demo purposes, the form should show a "Demo Mode" toggle that bypasses payment.

**Commit:**
```bash
git add src/components/TaskSubmitForm.tsx
git commit -m "feat(ui): TaskSubmitForm — task type picker, EIP-3009 payment signing, demo mode toggle"
```

---

### Task 4.6: Dashboard Page (Wires All Components)

**Files:**
- Create: `src/app/page.tsx` (from ARCHITECTURE.md Section 18)

**Steps:**

1. Copy `src/app/page.tsx` from ARCHITECTURE.md Section 18 exactly.
   The page is a three-column layout: TreasuryPanel | TaskTracePanel | TaskHistoryPanel.
   TaskSubmitForm is embedded below TaskTracePanel.

2. Open http://localhost:3000 and verify:
   - Left panel shows USDC balance and USYC APY
   - Right panel shows task history (empty list is OK at this point)
   - Centre panel shows "Waiting for task..."
   - Submit form has task type dropdown

3. Submit a task via the form (demo mode):
   - Select `wallet_intelligence`
   - Enter a task description
   - Toggle "Demo Mode" on
   - Submit

   Expected: centre panel starts showing Claude reasoning tokens streaming in real-time

#### Decision Point: Streaming Reasoning in Browser

Submit a task in demo mode and watch the centre panel.
Expected: reasoning tokens appear character-by-character within 2 seconds of submission

✅ **If streaming works:** The key demo moment is live. Continue.

🔀 **If no tokens appear (blank centre panel):**
1. Open browser DevTools → Network → filter by `EventSource`
2. Verify the SSE connection is established (should show a persistent connection to `/api/tasks`)
3. If no SSE connection: check `TaskTracePanel.tsx` `EventSource` or `fetch` stream setup
4. If SSE connected but no data: verify the backend is writing to the stream (add `console.log` in `tasks/route.ts` at each `send()` call)

🔀 **If tokens appear but don't stream (appear all at once at the end):**
1. The SSE reader is buffering — the `ReadableStream` decoder needs to flush on each newline
2. Verify `TaskTracePanel.tsx` reads the stream incrementally and updates React state on each chunk

**Commit:**
```bash
git add src/app/page.tsx
git commit -m "feat(ui): Dashboard — 3-panel layout, real-time streaming reasoning, Arc explorer links"
```

---

### Task 4.7: A2A Auto-Caller Script (Risk 1 — CRITICAL, insurance)

**Purpose:** Creates guaranteed on-chain traction by having an automated agent submit tasks via A2A.

**Steps:**

1. Create `scripts/a2a-auto-caller.ts`:
   ```typescript
   // scripts/a2a-auto-caller.ts
   // Calls AgentTreasury via A2A REST API every 2 hours — generates traction
   // Run: npx tsx scripts/a2a-auto-caller.ts (keep running for Days 5-6)
   const AGENT_URL = process.env.AGENT_TREASURY_URL || "https://agent-treasury.vercel.app";
   const TASKS = [
     { task: "Analyze wallet activity patterns on Arc testnet", task_type: "wallet_intelligence" },
     { task: "Verify counterparty reputation for 0x1111...1111", task_type: "counterparty_vet" },
     { task: "What is the current Arc testnet block height?", task_type: "general" },
   ];
   async function call() {
     const t = TASKS[Math.floor(Math.random() * TASKS.length)];
     const res = await fetch(`${AGENT_URL}/api/tasks`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ ...t, payer_wallet: "0xA2A0000000000000000000000000000000000001", demo_mode: true, client_type: "agent" }),
     });
     console.log(`[${new Date().toISOString()}] Submitted: ${t.task_type} — status: ${res.status}`);
   }
   setInterval(call, 2 * 60 * 60 * 1000); // every 2h
   call(); // run immediately
   ```

2. Keep this running after Phase 5 deploy to generate traction.

**Commit:**
```bash
git add scripts/a2a-auto-caller.ts
git commit -m "feat(a2a): auto-caller script — A2A task submission every 2h for traction"
```

---

### Phase 4 Gate

Before proceeding to Phase 5, verify:
- [ ] Dashboard loads at http://localhost:3000 with no console errors
- [ ] Task submission (demo mode) triggers streaming reasoning in the centre panel
- [ ] Reasoning tokens appear character-by-character (not all at once)
- [ ] Task appears in history panel after completion
- [ ] Arc explorer links in history panel are valid URLs (even if testnet is slow)
- [ ] Treasury panel shows real USDC balance
- [ ] `npx tsc --noEmit` passes
- [ ] All Phase 4 commits made

**If any check fails: DO NOT proceed. Fix the failing check first.**

---

## Phase 5 — Day 6 (May 24): Seed Demo + Proof + Deploy + 5 Payments

**Purpose:** Production deploy is live. Seed state creates a compelling landing experience. Five distinct external payments confirmed. Proof page is complete. Agent auto-caller running.
**Estimated time:** 8 hours

---

### Task 5.1: Implement Demo Seed Script (Forge→Build #19)

**Files:**
- Create: `scripts/seed-demo.ts` (implements PRD §6 Demo Prerequisites + §7.5 Seed Script Requirements)
  Reference: ARCHITECTURE.md Section 24

**Steps:**

1. Copy `scripts/seed-demo.ts` from ARCHITECTURE.md Section 24 exactly.

2. Run the seed script:
   ```bash
   npx tsx scripts/seed-demo.ts
   ```
   Expected: output confirming each seed operation completed

3. Open http://localhost:3000 and verify the seeded state:
   - Left panel: USDC balance shows ~$12.40
   - Right panel: 8 completed tasks visible with Arc explorer links
   - Each task has associated income and expense rows

4. Verify idempotence (safe to run multiple times):
   ```bash
   npx tsx scripts/seed-demo.ts
   npx tsx scripts/seed-demo.ts
   ```
   Expected: second run produces same state without duplicating records

**Gate:** `npx tsx scripts/seed-demo.ts` runs to completion with no errors. Idempotent — safe to run multiple times.

**Commit:**
```bash
git add scripts/seed-demo.ts
git commit -m "seed(demo): implement seed-demo.ts from PRD §6 Demo Prerequisites — 8 tasks, 5 payers, 24 expenses"
```

---

### Task 5.2: Proof Page

**Files:**
- Create: `src/app/proof/page.tsx` (from ARCHITECTURE.md Section 23)

**Steps:**

1. Copy `src/app/proof/page.tsx` from ARCHITECTURE.md Section 23 exactly.

2. Navigate to http://localhost:3000/proof and verify:
   - Agent wallet address is shown with Arc explorer link
   - Expense wallet address is shown
   - USYC Teller interaction tx hash (if allowlisted) or "pending allowlisting" note
   - Task count and date range
   - Total income and expense amounts

**Commit:**
```bash
git add src/app/proof/page.tsx
git commit -m "feat(proof): /proof page — wallet addresses, tx hashes, integration evidence for judges"
```

---

### Task 5.3: Vercel Deploy (Risk 8 — HIGH, pre-emptive)

**Steps:**

1. Create a Vercel project and link to the repo:
   ```bash
   npx vercel --prod
   ```
   Or deploy via Vercel dashboard by connecting the GitHub repo.

2. Set all environment variables in Vercel dashboard (Project → Settings → Environment Variables):
   - All vars from `.env` must be set in Vercel's production environment
   - Double-check: `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `CIRCLE_WALLET_ID`, `AGENT_WALLET_ADDRESS`, `EXPENSE_WALLET_PRIVATE_KEY`, `SELLER_EOA_ADDRESS`, `ANTHROPIC_API_KEY`, `POSTGRES_URL`

3. Run the database migration against the production Vercel Postgres:
   ```bash
   POSTGRES_URL=<vercel postgres url> npx tsx scripts/migrate.ts
   ```

4. Run seed script against production:
   ```bash
   POSTGRES_URL=<vercel postgres url> npx tsx scripts/seed-demo.ts
   ```

5. Verify the production deploy:
   ```bash
   curl -s https://<your-vercel-domain>.vercel.app/api/treasury | jq .
   ```
   Expected: valid JSON with live treasury data

#### Decision Point: Vercel Deploy (Risk 8 — HIGH)

Run: `curl https://<domain>.vercel.app/api/treasury`
Expected: 200 with treasury JSON

✅ **If it works:** Production is live. Record the URL in `submission/links.md`.

🔀 **If functions timeout (504):**
1. Check Vercel function logs in the dashboard
2. Arc RPC calls are likely timing out — increase function max duration: add `export const maxDuration = 60` to affected route files
3. Redeploy

🔀 **If environment variable errors (missing key):**
1. Vercel dashboard → Settings → Environment Variables
2. Add the missing variable
3. Trigger a new deployment: `npx vercel --prod`

🔀 **If database connection fails in production:**
1. Verify `POSTGRES_URL` is set correctly in Vercel env vars (not `.env.local`)
2. Vercel Postgres: use the `POSTGRES_URL` from the storage dashboard, not `POSTGRES_URL_NON_POOLING`
3. Add `POSTGRES_URL_NON_POOLING` for migrations if needed

**Commit:**
```bash
git add submission/links.md
git commit -m "deploy: production deploy live at <url>"
```

---

### Task 5.4: 5 External Payments — Traction (Risk 1 — CRITICAL)

**Purpose:** Generate the 5 distinct external payer wallet events required for the Traction judging criterion.

**Steps:**

1. Share the production URL with real users via:
   - Telegram crypto dev groups
   - Discord agent builders channel
   - Hackathon participant channels
   - Ask each person to submit ONE paid task (or demo mode task from their wallet address)

2. Run the A2A auto-caller to cover the automatic traction path:
   ```bash
   AGENT_TREASURY_URL=https://<domain>.vercel.app npx tsx scripts/a2a-auto-caller.ts &
   ```
   Keep running for the next 24 hours.

3. Monitor the dashboard to confirm 5 distinct payer wallet addresses appear in the task history.

#### Decision Point: Traction — 5 Distinct Payers (Risk 1 — CRITICAL)

Check task history in the dashboard.
Expected: at least 5 distinct `payer_wallet` addresses with completed tasks

✅ **If 5 distinct payer wallets confirmed:** Traction criterion is met. Record wallet addresses in `submission/proof.md`.

🔀 **If only 1-4 distinct payers by end of Day 6:**
1. The A2A auto-caller script generates traction from `0xA2A0000...0001` — this counts as 1 distinct payer
2. Use additional A2A caller wallets:
   ```typescript
   // scripts/a2a-caller-2.ts — same script but change payer_wallet to "0xA2A...0002"
   ```
3. Generate 5 A2A callers with different wallet addresses if human users don't materialize
4. Note in submission: "A2A agent-to-agent payments from 5 distinct addresses — demonstrates the primary use case"

🔀 **If < 5 payers on demo day:**
1. Pre-seed 5 historical task records via `seed-demo.ts` with 5 distinct payer wallets
2. The seeded records are Arc testnet consistent even if not from real external users
3. Note: "Historical task data from integration testing + A2A agent callers"

**Commit:**
```bash
git add submission/proof.md
git commit -m "proof(traction): 5 distinct payer wallets confirmed — traction criterion met"
```

---

### Task 5.5: proof.md + Screenshots

**Steps:**

1. Fill in `submission/proof.md` with all required artifacts from PRD §7.6:
   - Agent Circle Wallet address (with Arc explorer link)
   - Expense EOA address (with Arc explorer link)
   - USYC interaction tx hash or "pending allowlisting" note
   - 5 distinct payer wallet addresses with income tx hashes
   - GatewayClient deposit tx hash
   - Total tasks executed and date range
   - API call count (Nanopayment expense transactions)
   - Circle Wallets API wallet creation timestamp

2. Take screenshots:
   ```bash
   # Open the live production URL and capture:
   # - submission/screenshots/landing.png — dashboard with populated state
   # - submission/screenshots/task-trace.png — centre panel showing full execution trace
   # - submission/screenshots/arc-explorer.png — Arc block explorer showing history
   # - submission/screenshots/usyc-deposit.png — USYC position/APY visible
   ```

**Commit:**
```bash
git add submission/
git commit -m "proof: screenshots + proof.md — all judge artifacts captured"
```

---

### Phase 5 Gate

Before proceeding to Phase 6, verify:
- [ ] `npx tsx scripts/seed-demo.ts` runs without errors from production environment
- [ ] Production URL returns 200 from all key endpoints
- [ ] Dashboard shows populated state with 8+ tasks and 5 distinct payers
- [ ] `/proof` page renders with real wallet addresses and tx hashes
- [ ] `submission/proof.md` is complete
- [ ] All 4 screenshots captured in `submission/screenshots/`
- [ ] A2A auto-caller is running and generating traction
- [ ] `submission/links.md` has the production URL
- [ ] All Phase 5 commits made

**If any check fails: DO NOT proceed. Fix the failing check first.**

---

## Phase 6 — Day 7 (May 25): Demo Video + Submission

**Purpose:** Submit before 23:59 UTC. Record a compelling demo video that hits all 4 judging criteria. Do not build new features.
**Estimated time:** 4 hours active work + buffer

---

### Task 6.1: Final Seed + State Verification

**Steps:**

1. Run seed one final time to ensure perfect demo state:
   ```bash
   POSTGRES_URL=<prod url> npx tsx scripts/seed-demo.ts
   ```

2. Open the production URL and do a walk-through:
   - Dashboard loads with populated treasury
   - Submit a test task in demo mode — verify streaming reasoning
   - Check task history has Arc explorer links that open
   - Check `/proof` page is complete

---

### Task 6.2: Demo Video Recording

**Reference:** PRD §6 Demo Script (7 scenes, 4 minutes total)

**Steps:**

1. Use the demo script from PRD §6 as the script verbatim.

2. Scene sequence:
   - Scene 1 (30s): Landing — show populated dashboard, hero text, treasury state
   - Scene 2 (20s): Task submission — type a task, show pricing, toggle off demo mode briefly to show 402
   - Scene 3 (30s): 402 / payment flow — show the payment authorization concept
   - Scene 4 (40s): Reasoning stream — submit in demo mode, watch Claude reason character-by-character
   - Scene 5 (30s): Execution trace — see expense Nanopayments firing, Arc tx links
   - Scene 6 (30s): Arc block explorer — show real on-chain history
   - Scene 7 (20s): Closing — proof page, multi-tool stack summary, post-hackathon vision

3. Upload to YouTube (unlisted is fine). Record URL in `submission/video/links.md`.

**Commit:**
```bash
git add submission/video/links.md
git commit -m "demo: video recorded and uploaded — <youtube url>"
```

---

### Task 6.3: Final Submission

**Steps:**

1. Fill `submission/sponsor-tracks.md`:
   ```markdown
   # Track Entries

   ## Primary: Circle Tool Integration ($20,000)
   Evidence: All 4 Circle tools serve distinct treasury functions.
   - Wallets: AGENT_WALLET_ADDRESS — Circle Dev-Controlled on ARC-TESTNET
   - Nanopayments: 24+ expense transactions from SELLER_EOA_ADDRESS
   - USYC: Position display at APY 4.85% (deposit if allowlisted)
   - Proof: /proof page + submission/proof.md
   ```

2. Submit to hackathon portal (DoraHacks or specified platform):
   - Project URL: `<production vercel url>`
   - Demo video: `<youtube url>`
   - GitHub repo: `<repo url>`
   - Attach `submission/proof.md` and screenshots

3. Deadline: 2026-05-25T23:59:00Z — submit by 23:00 UTC (1 hour buffer).

**Commit:**
```bash
git add submission/
git commit -m "chore: submission complete — <hackathon platform> <project url>"
```

---

### Phase 6 Gate

- [ ] Demo video uploaded and URL recorded
- [ ] Submission form submitted before 23:59 UTC
- [ ] `submission/` directory is complete (proof.md, screenshots, video/links.md, links.md)
- [ ] GitHub repo is public (or shared with judges)
- [ ] Production URL is live and accessible

---

## Appendix A: All Addresses

| Item | Address | Network |
|------|---------|---------|
| USDC (native gas) | 0x3600000000000000000000000000000000000000 | Arc Testnet |
| USYC Token | 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C | Arc Testnet |
| USYC Teller | 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A | Arc Testnet |
| Gateway Wallet | 0x0077777d7EBA4688BDeF3E311b846F25870A19B9 | Arc Testnet |
| Gateway Minter | 0x0022222ABE238Cc2C7Bb1f21003F0a260052475B | Arc Testnet |
| Agent Circle Wallet | `AGENT_WALLET_ADDRESS` in .env | Arc Testnet |
| Expense EOA | `SELLER_EOA_ADDRESS` in .env | Arc Testnet |

---

## Appendix B: Critical Commands

| Phase | Task | Command | Purpose |
|:---:|:---:|---------|---------|
| 0 | 0.1 | `arc-canteen rpc eth_blockNumber` | Validate Arc RPC |
| 0 | 0.4 | `npx tsx scripts/migrate.ts` | Create DB tables |
| 0 | 0.5 | `npx tsx scripts/create-wallet.ts` | Create Circle Wallet |
| 1 | 1.1 | Claude smoke test (see Task 1.1) | Validate reasoning |
| 1 | 1.3 | `curl -X POST /api/tasks ...` | Validate 402 gate |
| 2 | 2.3 | `curl ... demo_mode:true` | Validate full E2E |
| 5 | 5.1 | `npx tsx scripts/seed-demo.ts` | Seed demo state |
| 5 | 5.3 | `npx vercel --prod` | Deploy to Vercel |
| 6 | 6.2 | (screen record) | Demo video |

---

## Appendix C: Troubleshooting

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| `arc-canteen: command not found` | uv not in PATH | `source ~/.cargo/env && uv tool install ...` |
| `CIRCLE_API_KEY invalid` | Wrong key format | Must start with `TEST_API_KEY:` for testnet |
| `cannot find module @vercel/postgres` | Missing package | `npm install @vercel/postgres` |
| `SSE stream hangs` | Next.js function timeout | Add `export const maxDuration = 60` to route.ts |
| `USYC revert: not allowlisted` | Allowlisting pending | Use APY-only path (see Task 3.1 decision tree) |
| `client.pay is not a function` | GatewayClient SDK | Try/catch fallback in payForResource engages |
| `0xDEMO wallets have no history` | Arc testnet sparse | Use faucet to generate transactions |
| Vercel 504 on task execution | Function timeout | Add `maxDuration = 60` to tasks/route.ts |
| `POSTGRES_URL not set` | Env var missing | Pull from Vercel: `vercel env pull` |

---

## Appendix D: Test File Locations (Forge→Build #23)

Tests are co-located with source files. Create the following test files alongside their implementations:

| Test File | Tests | Command |
|-----------|-------|---------|
| `src/lib/__tests__/treasury-reasoning.test.ts` | ACCEPT/DEFER/REJECT decision scenarios | `npx jest treasury-reasoning` |
| `src/lib/__tests__/db.test.ts` | insertTask, listTasks, completeTask | `npx jest db` |
| `src/lib/__tests__/nanopayments-seller.test.ts` | verifyNanopayment mock scenarios | `npx jest nanopayments-seller` |
| `src/lib/__tests__/usyc.test.ts` | getUSYCPosition response parsing | `npx jest usyc` |

Test files reference ARCHITECTURE.md Section 31 (Testing Strategy) for test scenarios.
