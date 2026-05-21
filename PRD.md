# solv-001

**Hackathon:** Agora Agents Hackathon (Canteen × Circle × Arc)
**Track:** Circle Tool Integration ($20,000)
**Deadline:** 2026-05-25T23:59:00Z (6 days remaining)
**Version:** V1

---

## 1. Project Overview

### One-Liner

An autonomous AI agent that earns USDC by completing tasks, pays its own operating costs via Nanopayments, and uses Claude to reason about its treasury before deciding which tasks to run — all verifiable on Arc.

### Problem Statement

**Layer 1 — The category exists, but it's all rules.** ElizaOS, Coinbase Agentic Wallets, and x402-based agents can all hold and spend crypto. But every implementation runs on the same logic: accept all tasks above threshold X, rebalance when balance drops below Y. No agent uses a language model to reason about its own financial state in real time.

**Layer 2 — solv-001 does four things no rule-based agent can.** It accepts plain-text tasks from humans and other AI agents — wallet vetting, conditional payments, on-chain monitoring, data research — and charges per task in USDC. Before executing any task, Claude evaluates the live treasury: current balance, pending receivables, USYC yield rate, and task profit margin. It pays every external API call as a real Nanopayment on Arc, creating an immutable expense log. And it moves idle capital above an operating reserve into USYC automatically. The reasoning behind every decision streams character-by-character in the dashboard — explained, not just executed.

**Layer 3 — Here is what that looks like.** Two tasks arrive simultaneously. Task A: wallet vetting at $0.50, estimated execution cost $0.18 — the margin is strong. Task B: web research at $0.30, estimated execution cost $0.22 — the margin is thin. Meanwhile, a monitoring job started 6 hours ago has accumulated $0.04 in Nanopayment expenses, and $0.80 in income from the morning is still unconfirmed. A rule-based agent accepts both tasks. Claude defers Task B: "Pending income is unconfirmed and the monitoring position is drawing down at $0.04 per hour. Task A is profitable now. Task B at this margin requires confirmed balance first — deferring." That decision, with its reasoning and every transaction that informed it, is on Arc.

solv-001 is the first to combine Circle's full 4-tool stack — Wallets, Nanopayments, USYC, and the MCP agent interface — with Claude reasoning over live financial state, deployed natively on Arc.

### Solution

solv-001 is an autonomous AI agent with a complete, self-managing financial system:

1. **It earns.** Clients pay per task in USDC, collected via Circle Nanopayments. Every payment is a real onchain transaction on Arc testnet.
2. **It reasons.** Before executing any task, Claude evaluates the agent's live treasury state — current USDC balance, pending receivables, USYC yield rate, and task profit margin — and decides which tasks to run. The reasoning is explained out loud in the dashboard.
3. **It spends responsibly.** Every external API call the agent makes is paid via a real Nanopayment, creating an immutable expense log onchain.
4. **It saves.** Idle USDC above an operating reserve threshold is automatically deposited into USYC for yield. The agent earns while it waits.

Every income event, expense, and treasury decision is auditable on the Arc block explorer. The agent runs for 12 days before the demo, generating authentic transaction history that judges can inspect.

### Why This Wins

| Judging Criterion | Weight | How We Excel |
|---|:---:|---|
| Agentic Sophistication | 30% | Claude reasons over 4 live financial inputs (balance, pending income, USYC yield rate, task profit margin) before accepting each task. The decision is explained in plain English, streamed character-by-character in the dashboard. This is not a rules engine. |
| Traction | 30% | Agent deployed Day 1, generating real Nanopayment expense transactions for 12 days straight. 5 distinct external wallets make task purchases (human or agent-to-agent). On-chain traction is self-evidencing and immutable. |
| Circle Tool Usage | 20% | All 4 Circle tools serve distinct treasury functions that would collapse without them: Wallets (identity + USDC custody), Nanopayments seller (income gate), Nanopayments buyer (expense tracking), USYC (idle capital yield). Passes the substitution test for each tool individually. |
| Innovation | 20% | Agent treasuries exist but every current implementation is rule-based. solv-001 is the first to combine Circle's full 4-tool stack with LLM reasoning over live financial state on Arc. The judges built these tools — they will recognize whether the integration is real or decorative. |

---

## 2. System Architecture Overview

### System Diagram

```
                          ┌──────────────────────────────────────────────┐
                          │              solv-001 System             │
                          │                                              │
  Human User             │  ┌─────────────────────────────────────────┐ │
  (browser)  ─── HTTPS ──┼─►│          Next.js 15 App Router          │ │
                          │  │  Dashboard (3-panel) + Task Submit Form │ │
  AI Agent               │  └──────────┬────────────────┬─────────────┘ │
  (A2A REST)  ── POST ───┼─────────────┤                │               │
                          │  ┌──────────▼────────┐  ┌───▼─────────────┐ │
  AI Agent               │  │  Task Intake API   │  │ Treasury Status  │ │
  (MCP client) ─ SSE ───┼─►│  POST /api/tasks   │  │  GET /api/treasury│ │
                          │  └──────────┬─────────┘  └───┬─────────────┘ │
                          │             │                 │               │
                          │  ┌──────────▼─────────────────▼────────────┐ │
                          │  │        Treasury Reasoning Engine         │ │
                          │  │   Claude: balance + pending + yield      │ │
                          │  │         + task margin → decision         │ │
                          │  └──────────┬──────────────────────────────┘ │
                          │             │                                 │
                          │  ┌──────────▼──────────────────────────────┐ │
                          │  │         Task Execution Engine            │ │
                          │  │  Route: intelligence | execution |       │ │
                          │  │         monitoring | general            │ │
                          │  └──┬──────┬──────┬──────┬─────────────────┘ │
                          │     │      │      │      │                    │
                          │  ┌──▼──┐ ┌▼────┐ │   ┌──▼──────────────┐    │
                          │  │arc- │ │Nano │ │   │ Circle Wallets  │    │
                          │  │canteen│ │pay  │ │   │ API (income +   │    │
                          │  │ CLI │ │ment │ │   │ custody + USYC) │    │
                          │  └─────┘ │(exp)│ │   └────────┬────────┘    │
                          │          └──┬──┘ │            │             │
                          │             │    └─────────┐  │             │
                          │  ┌──────────▼──────────────▼──▼───────────┐ │
                          │  │         Vercel Postgres Database        │ │
                          │  │   tasks | treasury_events | tx_log     │ │
                          │  └────────────────────────────────────────┘ │
                          │                                              │
                          │  Nanopayments Seller Middleware              │
                          │  (POST /api/tasks → 402 → payment → exec)   │
                          └──────────────────────────────────────────────┘
                                              │
                                    Arc Testnet (Block Explorer)
                                    Income tx + Expense tx visible
```

### Component Table

| Component | Type | Purpose | Key Dependencies |
|---|---|---|---|
| Next.js Dashboard | Frontend | 3-panel UI: treasury state, task trace, history | React, Tailwind, viem |
| Task Intake API | Backend route | Accepts tasks, enforces payment gate, queues execution | Nanopayments seller middleware |
| Treasury Status API | Backend route | Live treasury state for dashboard polling | Circle Wallets API, USYC Teller |
| Treasury Reasoning Engine | Backend service | Claude multi-factor financial decision logic | Anthropic SDK, Circle Wallets API |
| Task Execution Engine | Backend service | Routes tasks to correct handlers, streams traces | arc-canteen CLI, Nanopayments buyer |
| Circle Wallets Service | Integration | Agent wallet custody, USDC balance, USYC deposits | @circle-fin/developer-controlled-wallets |
| Nanopayments Seller | Integration | Income side — x402 middleware for task payment gate | @circle-fin/x402-batching/server |
| Nanopayments Buyer | Integration | Expense side — pays external API calls as Nanopayments | @circle-fin/x402-batching/client |
| USYC Service | Integration | Idle USDC → USYC deposit/redeem, APY tracking | viem, USYC Teller contract |
| MCP Server | Integration | HTTP/SSE transport for Claude-powered agent callers | @modelcontextprotocol/sdk |
| Agent Card | Config | /.well-known/agent.json — A2A discovery manifest | Static JSON route |
| Database (Vercel Postgres) | Backend | Tasks, treasury events, transaction log | @vercel/postgres |

### Data Flow

A task request enters via one of three channels: human dashboard form submission, A2A REST API POST to /api/tasks, or MCP tool call from an agent. All three converge on the Task Intake API. Before any logic runs, the Nanopayments seller middleware enforces a 402 payment gate — the request must include a valid EIP-3009 payment authorization, or the API returns 402 with payment details. Once payment is verified, the task is written to the database and the Treasury Reasoning Engine is invoked. Claude queries the Circle Wallets API for live balance, checks USYC position, estimates task execution cost via Nanopayments pricing, and reasons about whether to execute now, defer, or reject. The decision and full reasoning text are streamed to the dashboard. If Claude accepts, the Task Execution Engine runs the appropriate handler: arc-canteen CLI commands for on-chain intelligence tasks, Circle Wallets API calls for execution tasks, or external API calls via Nanopayments for general tasks. Every external call generates a real Nanopayment expense transaction on Arc. Results are written back to the database and returned to the caller. Idle USDC in the agent's Circle wallet above the operating reserve is automatically swept into USYC via the Teller contract.

---

## 3. User Flows

### Flow 1: Human submits a task via dashboard

1. User opens dashboard at the deployment URL
2. Dashboard loads 3-panel view: treasury state (left), task trace (centre), task history (right)
3. User connects wallet via MetaMask or any EIP-1193 wallet
4. User types task in plain English: "Vet wallet 0xABCD — should I send them 100 USDC?"
5. Dashboard calls GET /api/tasks/estimate to show pricing and reasoning inputs before commit
6. User approves USDC payment via wallet (EIP-3009 transferWithAuthorization signature)
7. Dashboard POSTs task + payment authorization to /api/tasks
8. Nanopayments seller middleware verifies the payment authorization onchain
9. Task is accepted; dashboard shows live execution trace in centre panel:
   - "Payment received: +0.50 USDC [Arc tx: 0x...]"
   - "Queried transaction history [Nanopayment: $0.005, tx: 0x...]"
   - "Queried contract interactions [Nanopayment: $0.005, tx: 0x...]"
   - "Reasoning... [streaming]"
   - "Report delivered ✓"
10. Claude reasoning is streamed character-by-character in the trace panel
11. Final result appears below the trace; task moves to history panel
12. Treasury state panel updates: balance, net earnings today, USYC position

### Flow 2: AI agent calls via A2A REST API

1. External agent discovers solv-001 at /.well-known/agent.json
2. Agent reads capabilities: task types, pricing per type, agent wallet address for payment
3. Agent constructs USDC payment authorization (EIP-3009) for the task price
4. Agent POSTs { task, payer_wallet, task_type, callback_url, payment_authorization } to /api/tasks
5. API verifies payment (same 402 middleware as human flow)
6. Task executes asynchronously; result POSTed to callback_url when complete
7. Income event recorded on Arc; visible in dashboard history (client_type: "agent")

### Flow 3: Treasury reasoning decision loop

1. New task arrives at the reasoning engine
2. Claude receives structured context:
   - Current USDC balance (from Circle Wallets API)
   - Pending income (tasks in progress × their prices)
   - USYC position (balance + current APY)
   - Task profit margin (task price minus estimated execution costs)
   - Task priority (task_type weighting)
3. Claude outputs a structured decision: ACCEPT | DEFER | REJECT + plain-English explanation
4. Decision is logged; explanation streams to dashboard
5. If ACCEPT: task queues for execution
6. If DEFER: task re-evaluated in 5 minutes or when balance increases
7. If REJECT: task returned to caller with explanation

### Flow 4: USYC yield cycle

1. After each income event, treasury service checks USDC balance vs operating reserve (configurable, default $10 USDC)
2. If balance > operating_reserve × 1.5: excess swept into USYC via Teller.deposit()
3. Teller requires prior USDC.approve(teller_address, amount) — Circle Wallets API used for approval transaction
4. USYC balance and live APY shown in treasury state panel
5. If balance drops below operating_reserve: Teller.redeem() called to convert USYC back to USDC
6. All Teller interactions are Arc transactions, visible in block explorer

### Flow 5: Agent Card A2A discovery (sequence)

```
External Agent  ->  GET /.well-known/agent.json
                <-  { name, description, capabilities[], pricing{}, wallet_address, api_url }

External Agent  ->  POST /api/tasks { task, payer_wallet, task_type, callback_url }
                <-  402 { payment_required: true, amount, currency: "USDC", payee: agent_wallet }

External Agent  ->  POST /api/tasks { ...same, payment_authorization: EIP3009Signature }
                <-  200 { task_id, status: "accepted", estimated_completion_ms }

                    [async execution, 10-120s]

External Agent  <-  POST callback_url { task_id, result, reasoning, cost_usdc, tx_hashes[] }
```

---

## 4. Technical Specifications

### Task Intake API (POST /api/tasks)

- **Purpose:** Single entry point for all task submissions from humans, agents, and MCP clients
- **Interface:** POST /api/tasks, GET /api/tasks, GET /api/tasks/[id], GET /api/tasks/estimate
- **Key Data Structures:**
  ```typescript
  type TaskType = "wallet_intelligence" | "counterparty_vet" | "contract_summary" |
                  "conditional_payment" | "scheduled_disbursement" |
                  "wallet_watch" | "contract_watch" | "general";

  interface TaskSubmission {
    task: string;                         // plain-text task description
    task_type: TaskType;
    payer_wallet: `0x${string}`;          // client's Arc wallet address
    callback_url?: string;                // for async results (A2A clients)
    payment_authorization: EIP3009Auth;   // signed payment authorization
  }

  interface EIP3009Auth {
    from: `0x${string}`;
    to: `0x${string}`;                    // agent's seller address
    value: bigint;                        // payment amount in USDC base units
    validAfter: bigint;
    validBefore: bigint;
    nonce: `0x${string}`;
    signature: `0x${string}`;
  }

  interface Task {
    id: string;
    task: string;
    task_type: TaskType;
    payer_wallet: `0x${string}`;
    status: "pending" | "reasoning" | "executing" | "complete" | "deferred" | "rejected";
    income_usdc: number;
    cost_usdc: number | null;
    net_usdc: number | null;
    reasoning: string | null;
    result: string | null;
    client_type: "human" | "agent";
    income_tx_hash: `0x${string}` | null;
    expense_tx_hashes: `0x${string}`[];
    created_at: Date;
    completed_at: Date | null;
  }
  ```
- **Dependencies:** Nanopayments seller middleware, Treasury Reasoning Engine, Vercel Postgres
- **Constraints:** Payment verification must complete within 5 seconds; task execution timeout 120 seconds

### Treasury Status API (GET /api/treasury)

- **Purpose:** Live treasury state for dashboard real-time polling and agent queries
- **Interface:** GET /api/treasury
- **Key Data Structures:**
  ```typescript
  interface TreasuryState {
    usdc_balance: number;                 // current Circle Wallet balance
    usyc_balance: number;                 // USYC token balance
    usyc_usdc_value: number;              // USYC balance converted to USDC at current rate
    usyc_apy: number;                     // current annual yield rate (e.g. 0.0485 = 4.85%)
    pending_income_usdc: number;          // in-flight tasks × their prices
    today_income_usdc: number;
    today_expense_usdc: number;
    today_net_usdc: number;
    operating_reserve_usdc: number;       // threshold below which USYC is not touched
    total_tasks_completed: number;
    total_income_all_time_usdc: number;
    last_updated: Date;
  }
  ```
- **Dependencies:** Circle Wallets API, USYC Teller contract (via viem), Vercel Postgres

### Treasury Reasoning Engine

- **Purpose:** Evaluates incoming tasks against live financial state; returns ACCEPT/DEFER/REJECT with plain-English explanation
- **Interface:** Internal service function called by Task Intake API
- **Key Data Structures:**
  ```typescript
  interface ReasoningContext {
    current_balance_usdc: number;
    usyc_reserve_usdc: number;
    pending_income_usdc: number;
    operating_reserve_usdc: number;
    task_price_usdc: number;
    estimated_execution_cost_usdc: number;
    task_profit_margin: number;           // (price - cost) / price
    task_type: TaskType;
    task_priority: number;                // 1-5, higher = more valuable
    queue_depth: number;                  // tasks currently executing
  }

  interface ReasoningDecision {
    decision: "ACCEPT" | "DEFER" | "REJECT";
    explanation: string;                  // 1-3 sentences, streamed to dashboard
    reasoning_tokens: number;
  }
  ```
- **Dependencies:** Anthropic SDK (claude-sonnet-4-6), Circle Wallets API
- **Constraints:** Reasoning must complete in under 10 seconds; explanation must be 1-3 sentences

### Task Execution Engine

- **Purpose:** Routes accepted tasks to the appropriate handler; streams execution trace; records expense Nanopayments
- **Interface:** Internal service, called after Treasury Reasoning Engine returns ACCEPT
- **Key Data Structures:**
  ```typescript
  interface TraceEvent {
    type: "payment_received" | "query" | "nanopayment" | "reasoning" | "result";
    description: string;
    arc_tx_hash?: `0x${string}`;
    cost_usdc?: number;
    timestamp: Date;
  }
  ```
- **Handlers:**
  - `wallet_intelligence`, `counterparty_vet`, `contract_summary`: arc-canteen CLI calls for on-chain data; Claude analysis
  - `conditional_payment`, `scheduled_disbursement`: Circle Wallets API transaction creation
  - `wallet_watch`, `contract_watch`: creates a monitoring record; Arc polling via arc-canteen
  - `general`: external API calls via Nanopayments (paid sub-cent per call)
- **Dependencies:** arc-canteen CLI (spawned as child process), Circle Wallets API, Nanopayments buyer (GatewayClient), Anthropic SDK

### Circle Wallets Service

- **Purpose:** Manages agent's USDC custody wallet; sends Circle API transactions for disbursements and USYC operations
- **Interface:** Internal service module
- **Key Data Structures:**
  ```typescript
  interface WalletInfo {
    wallet_id: string;                    // Circle internal ID
    address: `0x${string}`;              // Arc testnet address
    usdc_balance: number;
    blockchain: "ARC-TESTNET";
  }
  ```
- **Dependencies:** @circle-fin/developer-controlled-wallets
- **Constraints:** Circle Dev-Controlled Wallet does NOT expose raw private key; all transactions via Circle API

### Nanopayments Seller (Income)

- **Purpose:** Enforces USDC payment gate on all incoming task requests; verifies payment authorizations offchain via Arc Gateway facilitator
- **Interface:** Next.js middleware applied to POST /api/tasks
- **Key Data Structures:** Uses EIP-3009 payment authorization schema (see Task Intake API)
- **Dependencies:** @circle-fin/x402-batching/server, Arc Gateway facilitator (https://gateway-api-testnet.circle.com)
- **Constraints:** sellerAddress must be an EOA (not Circle Dev-Controlled SCA); agent holds a separate EOA for seller address

### Nanopayments Buyer (Expense)

- **Purpose:** Pays for all external API calls the agent makes while executing tasks; every payment is a real Arc transaction
- **Interface:** Internal wrapper around GatewayClient used by Task Execution Engine
- **Key Data Structures:**
  ```typescript
  interface NanopaymentExpense {
    description: string;                  // "Queried transaction history via arc-canteen"
    amount_usdc: number;
    arc_tx_hash: `0x${string}`;
    timestamp: Date;
  }
  ```
- **Dependencies:** @circle-fin/x402-batching/client, EOA private key (EXPENSE_WALLET_PRIVATE_KEY env var)
- **Constraints:** Requires EOA wallet (not Circle SCA) — GatewayClient uses ecrecover for signature verification

### USYC Service

- **Purpose:** Sweeps idle USDC into USYC for yield; redeems on low balance; exposes live APY
- **Interface:** Internal service called by treasury state checks and income event handler
- **Key Data Structures:**
  ```typescript
  interface USYCPosition {
    usyc_balance: bigint;                 // raw USYC token units
    exchange_rate: number;                // USYC per USDC
    usdc_value: number;                   // computed: usyc_balance / exchange_rate
    apy: number;                          // from Teller contract
  }
  ```
- **Dependencies:** viem (Arc testnet), USYC Teller contract at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A
- **Constraints:** CRITICAL — requires Circle Support allowlisting (24-48h) before Teller.deposit() will succeed. APY retrieval from Teller works without allowlisting.

### Next.js Dashboard (Frontend)

- **Purpose:** Three-panel web UI for human task submission, live treasury state display, and task history with Arc explorer links
- **Interface:** GET / — renders the full dashboard; no authentication required to view; wallet connection required to submit tasks
- **Key Data Structures:**
  ```typescript
  interface DashboardState {
    treasury: TreasuryState;              // polled every 5s from GET /api/treasury
    tasks: Task[];                         // polled every 3s from GET /api/tasks
    active_task: Task | null;              // currently executing task with streaming trace
    trace_events: TraceEvent[];            // streaming events for active task
  }
  ```
- **Dependencies:** React 18, Next.js 15 App Router, Tailwind CSS, viem (wallet connection), @anthropic-ai/sdk (not used — streaming from own API route)
- **Constraints:** Dashboard must render with data visible before wallet is connected; no SSR for treasury state (client-side polling only)

### MCP Server

- **Purpose:** Exposes solv-001 as a native tool for any Claude-powered agent; HTTP/SSE transport
- **Interface:** GET /api/mcp (SSE), POST /api/mcp (tool calls)
- **Key Data Structures:**
  ```typescript
  // Tools exposed:
  // run_task: { task_type, task_description, max_cost_usdc, payment_authorization }
  // get_treasury_status: {} -> TreasuryState
  // estimate_task: { task_type, task_description } -> { price_usdc, estimated_cost_usdc, margin }
  ```
- **Dependencies:** @modelcontextprotocol/sdk (HTTPServerTransport or SSE), Task Intake API
- **Constraints:** MCP server MUST share execution logic with REST API (same functions, different interface)

### Database (Vercel Postgres)

- **Purpose:** Persistent storage for tasks, treasury events, and transaction log; the only durable state store besides Arc blockchain
- **Interface:** SQL via @vercel/postgres; accessed only by Next.js API routes (never from the browser)
- **Key Data Structures:**
  ```sql
  -- tasks(id, task, task_type, payer_wallet, status, income_usdc, cost_usdc, net_usdc,
  --       reasoning, result, client_type, income_tx_hash, expense_tx_hashes, created_at, completed_at)
  -- treasury_events(id, type, amount_usdc, tx_hash, arc_link, created_at)
  -- trace_events(id, task_id, type, description, arc_tx_hash, cost_usdc, timestamp)
  ```
- **Dependencies:** @vercel/postgres, Vercel project (automatically provisioned)
- **Constraints:** All writes from server-side API routes only; no direct client DB access

### Agent Card (/.well-known/agent.json)

- **Purpose:** Machine-readable capability manifest for A2A discovery; any agent can read this and know how to call solv-001
- **Interface:** GET /.well-known/agent.json — static JSON response
- **Key Data Structures:**
  ```typescript
  interface AgentCard {
    name: "solv-001";
    version: "1.0.0";
    description: string;
    capabilities: AgentCapability[];
    pricing: Record<TaskType, { price_usdc: number; currency: "USDC" }>;
    payment: {
      method: "x402";
      chain: "arcTestnet";
      seller_address: `0x${string}`;      // agent's EOA seller address
      facilitator_url: "https://gateway-api-testnet.circle.com";
    };
    api: {
      rest: { submit_task: "POST /api/tasks"; get_status: "GET /api/tasks/{id}" };
      mcp: { endpoint: "/api/mcp"; transport: "http-sse" };
    };
  }
  ```

---

## 5. API Contracts

### External API: Circle Developer-Controlled Wallets

- **Base URL:** https://api.circle.com/v1/w3s
- **Authentication:** Bearer {CIRCLE_API_KEY} header
- **Rate Limits:** 10 req/s per API key

#### Endpoint: GET /wallets

- **Request:** Headers: Authorization: Bearer {key}
- **Response (success):**
  ```json
  {
    "data": {
      "wallets": [{
        "id": "string",
        "state": "LIVE",
        "address": "0x...",
        "blockchain": "ARC-TESTNET",
        "custodyType": "DEVELOPER",
        "balances": [{ "amount": "10.5", "token": { "symbol": "USDC" } }]
      }]
    }
  }
  ```
- **Response (error):**
  ```json
  { "code": 401, "message": "Unauthorized" }
  ```

#### Endpoint: POST /transactions/contractExecution

- **Purpose:** Send USDC approval + Teller.deposit() for USYC operations
- **Request:**
  ```json
  {
    "walletId": "string",
    "contractAddress": "0x3600000000000000000000000000000000000000",
    "abiFunctionSignature": "approve(address,uint256)",
    "abiParameters": ["0x9fdF14c5B14173D74C08Af27AebFf39240dC105A", "1000000"],
    "fee": { "type": "EIP1559", "maxFee": "1", "priorityFee": "0.5" }
  }
  ```
- **Response (success):**
  ```json
  { "data": { "id": "txn-uuid", "state": "INITIATED" } }
  ```

### External API: Circle Nanopayments (Seller — Income)

- **Package:** @circle-fin/x402-batching/server
- **Facilitator URL:** https://gateway-api-testnet.circle.com
- **Authentication:** None — payment verifications are onchain via Gateway facilitator

#### Middleware: createGatewayMiddleware

- **Input:** `{ sellerAddress: "0x...", facilitatorUrl: "https://gateway-api-testnet.circle.com" }`
- **Effect:** Intercepts POST /api/tasks; returns 402 with payment details if no payment_authorization present; verifies payment if present and attaches `req.payment` to context

### External API: Circle Nanopayments (Buyer — Expense)

- **Package:** @circle-fin/x402-batching/client
- **Chain:** arcTestnet

#### GatewayClient methods used:

- `new GatewayClient({ chain: "arcTestnet", privateKey: process.env.EXPENSE_WALLET_PRIVATE_KEY })`
- `client.deposit("10")` — one-time: deposit $10 USDC into Gateway Wallet for expense payments
- `client.getBalances()` — current expense wallet balance
- `client.pay(url, options)` — pay for a resource; returns tx hash

### External API: USYC Teller Contract (Arc Testnet)

- **Address:** 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A
- **Network:** Arc Testnet (chain ID: 26)
- **Authentication:** Circle Support allowlisting required

#### ABI Functions (ASSUMED — full ABI retrieved from Arc explorer):

- `deposit(uint256 amount)` — deposit USDC, receive USYC (requires prior USDC.approve)
- `redeem(uint256 usycAmount)` — redeem USYC for USDC
- `exchangeRate()` returns `uint256` — current USYC/USDC rate
- `annualYield()` returns `uint256` — current APY in basis points

### External API: Anthropic Claude (Reasoning)

- **Base URL:** https://api.anthropic.com/v1
- **Authentication:** x-api-key header
- **Model:** claude-sonnet-4-6
- **Rate Limits:** Tier-based; 5 req/min at tier 1

#### Endpoint: POST /messages

- **Request:**
  ```json
  {
    "model": "claude-sonnet-4-6",
    "max_tokens": 200,
    "stream": true,
    "messages": [{
      "role": "user",
      "content": "Treasury state: balance=$1.50, USYC=$8.00 (4.85% APY), pending_income=$0.50. Task: wallet_intelligence, price=$0.50, estimated_cost=$0.015. Reason about whether to accept, defer, or reject. Be decisive. 1-3 sentences."
    }]
  }
  ```
- **Response:** Server-sent events streaming delta text

### Internal API: arc-canteen CLI (spawned as child process)

- **Purpose:** All Arc testnet data queries; mandatory per hackathon brief §17
- **Invocation:** `arc-canteen rpc {method} {params}` via Node.js child_process.spawn
- **Key commands used:**
  ```
  arc-canteen rpc eth_getTransactionCount {address}     → tx count (reputation signal)
  arc-canteen rpc eth_getBalance {address}              → native USDC balance
  arc-canteen rpc eth_call {to, data}                   → contract reads (e.g. USYC rate)
  arc-canteen rpc eth_getLogs {filter}                  → event logs for wallet watch
  arc-canteen rpc eth_getCode {address}                 → contract code (for summary task)
  arc-canteen context                                   → fetch latest Circle/Arc docs
  ```

---

## 6. Demo Script

<!-- [CRITIQUE E-3] Demo trimmed from 5 min (10 scenes) to ~3 min (7 scenes). Scenes 1, 6, 9 cut; Scenes 3 and 8 compressed. Arc explorer reference moved inline to Scene 4 voiceover. Circle tools moved to closing scene. -->
<!-- [CRITIQUE E-1] Paymaster false claim removed from Scene 9 (deleted). Circle tools mention in new Scene 7 uses accurate 3-tool framing. -->
**Total Duration:** ~3 minutes (195 seconds)
**Format:** Screen recording with voiceover
**Demo prerequisite:** Seed state from seed-demo.ts must be established before recording

### Scene 1: Dashboard First Look (20 seconds)

**Screen:** Full dashboard loaded — three panels visible. Left panel: treasury shows $12.40 USDC + $50.00 USYC (4.85% APY). Right panel: 12 days of task history, mixed income and Nanopayment expenses.
**Voiceover:** "This is solv-001. ElizaOS, Coinbase, x402 agents — they all hold and spend crypto on rules. solv-001 uses Claude to reason about its own financial state before every decision. Left: live treasury. Centre: execution trace. Right: full history on Arc testnet."
**Action:** Scroll briefly through task history, showing income rows and expense rows with Arc tx links

### Scene 2: Task Submission (20 seconds)

**Screen:** Task input field in centre panel. "Try Demo Task" button visible beneath the input.
**Voiceover:** "Anyone can submit a task — 0.50 USDC, 97% margin. No wallet? Hit Try Demo Task."
**Action:** Click "Try Demo Task" button (demo_mode: true, no payment required). Task queues immediately. Note: the paid flow is identical — EIP-3009 authorization via MetaMask for real submissions.

### Scene 3: Treasury Reasoning (40 seconds)

**Screen:** Centre panel activates. Task trace begins updating line by line. A second task submission is visible in the queue.
**Voiceover:** "Two tasks arrive at the same time. Before executing either one, the agent reasons about its treasury state."
**Action:** Trace panel shows:
```
→ Payment received: +0.50 USDC   [Arc tx: 0x1a2b... ↗]   Task A: wallet vetting
→ Payment received: +0.30 USDC   [Arc tx: 0x2c3d... ↗]   Task B: web research
```
Pause. Reasoning panel activates with streaming text:
> "Balance is $4.20. Monitoring job has spent $0.04 this hour and $0.80 in morning income is still unconfirmed. Task A earns $0.50 against $0.18 execution cost — margin is strong, executing now. Task B earns $0.30 against $0.22 — too thin at current confirmed balance. Deferring Task B until morning income clears."
**Voiceover:** "Task A accepted. Task B deferred. Same threshold, different answer. A rule engine cannot do that — it does not know the monitoring job is drawing down or that income is pending. Claude does."

### Scene 4: Execution Trace (45 seconds)

**Screen:** Centre panel continues updating after reasoning completes
**Voiceover:** "Now the agent executes and pays its own expenses. Every transaction link in the trace opens a real Arc testnet block explorer entry."
**Action:** Trace lines appear sequentially:
```
→ Queried transaction history    [Nanopayment: $0.005  Arc tx: 0x3c4d... ↗]
→ Queried contract interactions  [Nanopayment: $0.005  Arc tx: 0x5e6f... ↗]
→ Queried token transfers        [Nanopayment: $0.005  Arc tx: 0x7a8b... ↗]
→ Generating report...           [streaming]
→ Report delivered               ✓
─────────────────────────────────────────────
Revenue: +$0.50  |  Costs: -$0.015  |  Net: +$0.485
```
**Voiceover:** "Three Arc transactions. The agent paid for its own work. This is not a mock — click any link."

### Scene 5: USYC Savings (25 seconds)

**Screen:** Left treasury panel zoomed in
**Voiceover:** "When the balance exceeds the operating reserve, the agent deposits into USYC automatically. That is $50 earning 4.85% annual yield right now. The agent saves while it waits."
**Action:** Click "USYC details" — shows deposit transaction hash + current exchange rate

### Scene 6: A2A — Agent Calls Agent (20 seconds)

**Screen:** Browser showing /.well-known/agent.json, then dashboard right panel
**Voiceover:** "Any agent can call solv-001. The Agent Card is public. By the time you watch this demo, the A2A auto-caller has already made 40-plus agent-to-agent Arc payments — visible here in the history."
**Action:** Show /.well-known/agent.json (capabilities + pricing). Switch to dashboard right panel — show rows labeled client_type: "agent", clearly distinct from human-submitted tasks. Traction number visible.

### Scene 7: Closing (25 seconds)

**Screen:** Dashboard summary view
**Voiceover:** "Three Circle tools, one treasury: Wallets for custody and identity. Nanopayments for sub-cent expense attribution. USYC for yield on idle capital. Remove any one and the financial model breaks. solv-001 — the first agent that earns, reasons, and saves autonomously on Arc. The financial operating system for AI agents."

---

### Demo Prerequisites

**Seed State Table** — exact state that must exist before recording begins. Build implements `scripts/seed-demo.ts` from this table.

| Item | Value | Network / Location | Created By |
|---|---|---|---|
| Agent Circle Wallet | funded with 50.00 USDC | Arc Testnet | seed-demo.ts |
| Agent USYC position | 50.00 USDC deposited into USYC | Arc Testnet USYC Teller | seed-demo.ts (requires allowlisting) |
| Demo wallet 0xDEMO01 | 20 historical transactions on Arc | Arc Testnet | seed-demo.ts (arc-canteen tx seeding) |
| Task history | 12 days: 8 completed tasks, 24 expense Nanopayments | Vercel Postgres + Arc Testnet | seed-demo.ts |
| Task history — income | minimum 5 distinct payer wallets across 8 tasks | Arc Testnet | seed-demo.ts (5 pre-generated wallets) |
| Expense wallet GatewayClient | $2.00 deposited into Arc Gateway Wallet | Arc Testnet | seed-demo.ts |
| Dashboard — today net | $2.47 net earnings today | Vercel Postgres | seed-demo.ts |

**Invariant:** Running `npx ts-node scripts/seed-demo.ts` from project root must produce this exact state from scratch. The script must be idempotent.

---

## 7. Risk Register

| # | Risk | Severity | Likelihood | Impact | Mitigation | Decision Tree |
|---|---|---|---|---|---|:---:|
| 1 | Income side empty — no external task payments by demo day | CRITICAL | MEDIUM | Traction score 0/10 (30% of judging) — project effectively disqualified | <!-- [CRITIQUE E-4] A2A auto-caller promoted to Day 2 primary feature --> **Day 2 (primary):** Deploy A2A auto-caller immediately after POST /api/tasks is live. Generates 12+ real agent-to-agent Arc transactions per day. By Day 6: 48+ A2A payments on-chain. This is the primary traction engine — not insurance. **Day 5 (separate):** Recruit 5 distinct human wallets via Telegram/Discord (#arc-builders, ETHGlobal Open Agents channel). Human + agent payments together exceed 5-wallet threshold comfortably. | Plan Phase 0 |
| 2 | USYC allowlisting not approved in time (24-48h wait) | CRITICAL | LOW | USYC integration non-functional; Circle Tool Usage score drops from 9 to 7 | Submit allowlisting ticket via circle.com/en/contact on Day 0 with agent wallet address. Implement USYC APY read path (no allowlisting needed) as first step. Dashboard shows APY even before deposit works. Full deposit/redeem goes in after ticket is approved | Plan Phase 1 |
| 3 | Treasury reasoning appears as a 3-line if-else, not LLM | CRITICAL | LOW | Agentic Sophistication score 2/10 — fails the 30% criterion entirely | Implement full Claude structured reasoning call with streaming before any other feature. Show the reasoning prompt context (4 variables), show streaming output character-by-character in demo. Log reasoning tokens in database. Judges can inspect the actual Claude call | Plan Phase 1 |
| 4 | Arc testnet data too sparse for compelling intelligence demo | HIGH | MEDIUM | Wallet vetting task returns "no history" — demo looks broken | Seed 10 wallets with realistic transaction histories using seed-demo.ts on Day 1. Keep specific addresses (0xDEMO01 etc.) as demo wallets with rich pre-seeded history. Document seeded addresses in .env.demo | Plan Phase 0 |
| 5 | Nanopayments EOA requirement conflicts with Circle Dev-Controlled Wallet | HIGH | KNOWN | Expense GatewayClient cannot use Circle Dev-Controlled Wallet directly (no private key access) | Architecture uses TWO wallet systems: (1) Circle Dev-Controlled Wallet for income custody + USYC + disbursements via Circle API. (2) Separate EOA (EXPENSE_WALLET_PRIVATE_KEY) for GatewayClient expenses. This is architecturally clean and explicitly mentioned in PRD | Plan Phase 1 |
| 6 | arc-canteen CLI integration delays Day 1 setup | HIGH | LOW | No on-chain intelligence data; task execution engine broken | Day 0 mandatory: run arc-canteen rpc eth_blockNumber before any code. Confirm CLI works. Store working command patterns in PLAN.md. If CLI breaks mid-build: use direct RPC endpoint as temporary fallback | Plan Phase 0 |
| 7 | USYC Teller ABI not in docs — must retrieve from Arc explorer | HIGH | KNOWN | Cannot call deposit/redeem without correct ABI | ABI retrieval is a Day 1 task. If Arc explorer is down: use cast interface {address} via foundry against Arc RPC. ABI assumed pattern documented in .forge-state.json | Plan Phase 1 |
| 8 | Arc testnet down or reset on demo day | HIGH | LOW | Demo shows no live transactions; proof of work collapses | Record demo video with pre-seeded state after all transactions exist. Include Arc explorer screenshots as backup. Keep database records of all historical tx hashes — dashboard never goes blank even if RPC is slow | Plan Phase 5 |
| 9 | Claude API cost blowup if reasoning is called on every task | MEDIUM | LOW | Unexpected spend; reasoning loop hangs if rate-limited | Reasoning uses 200 max_tokens, ~$0.0003 per call at sonnet pricing. Budget: 100 calls = $0.03. Add rate limit guard: max 10 reasoning calls per minute. Cache reasoning results for identical task types + similar treasury states | Plan Phase 2 |
| 10 | MCP server implementation adds 6-8 hours build time | MEDIUM | MEDIUM | If MCP is delayed, no A2A MCP integration for demo | Build MCP server as a thin wrapper in the same route file as REST API. Share all handler functions. MCP scaffolding is ~100 lines with official SDK. Implement Day 4 after REST works | Plan Phase 3 |
| 11 | Competitor teams building similar agent treasury concept | MEDIUM | LOW | Judges see multiple similar entries; uniqueness score drops | Differentiation is the specific Circle 4-tool combination + LLM reasoning on Arc. No team can replicate this exact stack in the remaining time if they start now. Document the multi-tool integration depth visibly in the Agent Card and dashboard | N/A |
| 12 | Demo pacing too slow — judges lose interest | MEDIUM | LOW | Demo score drops; project undersells despite strong technical work | Demo script has specific timing targets. Scene 4 (reasoning) is the emotional peak — keep it under 40 seconds total including streaming. Practice run before recording | Plan Phase 5 |
| 13 | Circle Developer-Controlled Wallets API unavailable or rate-limited | MEDIUM | LOW | Agent cannot read live USDC balance; treasury state panel shows stale data | Cache last-known balance in Vercel Postgres, updated after every transaction. Dashboard falls back to cached value with "Last updated N minutes ago" label. Retry with exponential backoff on 5xx errors | Plan Phase 1 |

### Risk Categories Covered

- [x] Technical risks (USYC ABI, EOA vs SCA wallet architecture, reasoning quality)
- [x] Competitive risks (similar teams, differentiation)
- [x] Time risks (MCP complexity, USYC allowlisting timeline)
- [x] Demo risks (Arc testnet stability, sparse onchain data, pacing)
- [x] Judging risks (Traction score, Agentic Sophistication definition)
- [x] Scope risks (MCP complexity, USYC full integration vs APY-only)

---

## 7.5. Judge Experience

### First-Visit State (what judges see at the live URL, before interacting)

The dashboard loads immediately showing a populated treasury with genuine transaction history:

- Left panel: USDC balance ($12.40), USYC position ($50.00 at 4.85% APY), net earnings today ($2.47)
- Right panel: 12 days of task history — 8 completed tasks with Arc explorer links, 24 expense Nanopayments
- Centre panel: "Waiting for task..." with pricing information visible

No empty states. No login walls. The full dashboard is visible to anyone who opens the URL.

### Seed Script Requirements (`scripts/seed-demo.ts`)

Creates the exact demo state from the table in Section 6. Entities to create:
- 8 historical task records in the database (varied types: wallet_intelligence x3, counterparty_vet x2, general x3)
- 5 distinct payer wallet addresses across those 8 tasks
- 24 expense Nanopayment records linked to Arc tx hashes
- Agent Circle Wallet funded at $12.40 USDC
- USYC deposit of $50 (if allowlisting approved) or mock USYC display state
- 10 seeded Arc wallets with realistic transaction histories for demo vetting tasks

### 10-Second Test

Opening the URL: agent name, live treasury balance, and USYC yield are visible immediately. Hero text: "An AI agent that earns, reasons, and saves autonomously."

### 30-Second Test

Scrolling right panel: income rows and expense rows clearly labeled with Arc explorer links. Clicking any link opens a real Arc testnet transaction.

### 60-Second Test

<!-- [CRITIQUE E-2] demo_mode button eliminates judge wallet friction -->
Clicking **"Try Demo Task"** in the task input area (no wallet required). This fires a pre-built task with `demo_mode: true`, bypassing the EIP-3009 payment gate. The agent reasons and executes immediately — full streaming trace visible within 10 seconds. Wallet connection is only required for paid task submissions. Judges without Arc testnet USDC can experience the full reasoning → execution → trace flow with one click.

### Landing Page Content

No connect-wallet-to-continue gate. The dashboard is public; wallet connection is only required to submit a paid task.

---

## 7.6. Judge Proof Artifacts

### Proof Route

A `/proof` page accessible from the dashboard footer, containing:

- Agent wallet address (Circle Dev-Controlled) with Arc explorer link
- Expense wallet address (EOA) with Arc explorer link
- USYC Teller interaction tx hash (deposit transaction)
- 5 distinct payer wallet addresses with income tx hashes
- Nanopayments GatewayClient deposit tx hash
- Total tasks executed since deploy (with date)
- API call count (total Nanopayment expense transactions)
- Circle Wallets API wallet creation timestamp

### Required Artifacts (generated by build)

- `submission/proof.md` — all of the above in markdown with live links
- `submission/screenshots/landing.png` — dashboard with populated state
- `submission/screenshots/task-trace.png` — centre panel showing full execution trace
- `submission/screenshots/arc-explorer.png` — Arc block explorer showing 12-day history
- `submission/screenshots/usyc-deposit.png` — USYC position and APY visible

---

## 8. Day-by-Day Build Plan

| Day | Date | Primary Objective | Secondary Objective | Deliverable |
|:---:|---|---|---|---|
| 1 | May 19 | Environment setup + Circle Wallet creation + DB schema | arc-canteen CLI validation + USYC allowlisting ticket | Working Circle Wallet on Arc; DB migrated; arc-canteen confirmed working |
| 2 | May 20 | Treasury Reasoning Engine (Claude reasoning loop) + Task Intake API with Nanopayments seller | <!-- [CRITIQUE E-4] A2A auto-caller Day 2 --> USYC APY read path (no allowlisting needed) + **A2A auto-caller agent deployed** (making paid calls every 2h by end of Day 2) | Reasoning streams in console; POST /api/tasks returns 402 then accepts with payment; auto-caller making first transactions |
| 3 | May 21 | Task Execution Engine + on-chain intelligence handlers (wallet_intelligence, counterparty_vet) | Seed-demo wallets with arc-canteen transactions | Wallet vetting task runs end-to-end; expense Nanopayments recorded |
| 4 | May 22 | USYC deposit/redeem (if allowlisted) + MCP server + Agent Card | Conditional payment + scheduled disbursement handlers | Full USYC cycle or APY-only; MCP server accessible; Agent Card serving |
| 5 | May 23 | Next.js dashboard UI (3-panel) + streaming reasoning display + Arc explorer links | Dashboard polish: error states, loading states, responsive layout | Dashboard live with real data; streaming reasoning visible; history populated |
| 6 | May 24 | seed-demo.ts + /proof page + deploy to Vercel + 5 external user payments | Polish: error states, loading states, responsive layout | Production deploy live; 5 distinct payer wallets confirmed; proof page complete |
| 7 | May 25 | Demo video recording + submission | Buffer: fix anything from Day 6 deploy | Video uploaded; submission form submitted before 23:59 UTC |

### Buffer Allocation

- Day 6 has no new feature work — it is entirely deploy, seed, and proof
- Day 7 morning is video; afternoon is backup time for any submission issues
- Days 1-5 have no scheduled buffer within days; if a day runs over, the lowest-priority secondary objective is cut first

---

## 9. Dependencies & Prerequisites

### External Services

| Service | URL | Auth Required | Status |
|---|---|:---:|---|
| Arc Testnet RPC | via arc-canteen CLI | No | Live (confirmed block 0x2903312) |
| Circle Developer Wallets API | https://api.circle.com/v1/w3s | API key + entity secret | Needs account creation |
| Circle Nanopayments Facilitator | https://gateway-api-testnet.circle.com | No (onchain verification) | Live |
| USYC Teller Contract | 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A | Circle Support allowlisting | Needs allowlist ticket |
| Anthropic Claude API | https://api.anthropic.com/v1 | API key | Live (key available) |
| Vercel Postgres | https://vercel.com/storage/postgres | Vercel project credentials | Provisioned on project creation |

### Development Tools

| Tool | Version | Purpose | Install Command |
|---|---|---|---|
| arc-canteen | latest | Arc testnet CLI — mandatory | `uv tool install git+https://github.com/the-canteen-dev/ARC-cli` |
| Node.js | 20+ | Runtime | `brew install node` |
| npm | 10+ | Package management | Bundled with Node |
| TypeScript | 5+ | Language | `npm install -D typescript` |
| tsx | latest | TS execution for scripts | `npm install -D tsx` |
| viem | 2.x | Arc RPC direct calls | `npm install viem` |

### Accounts & Credentials

| Account | Purpose | How to Get |
|---|---|---|
| Circle Developer Console | Wallets API key + entity secret | console.circle.com — create account, generate API key |
| Circle USYC Allowlisting | Enable Teller.deposit() for agent wallet | circle.com/en/contact — submit ticket with Arc testnet wallet address |
| Anthropic API | Claude reasoning engine | console.anthropic.com |
| Vercel | Deployment + Postgres | vercel.com |

### On-Chain Addresses (Arc Testnet)

| Item | Address | Network | Source |
|---|---|---|---|
| USDC (native gas token) | 0x3600000000000000000000000000000000000000 | Arc Testnet | docs.arc.io |
| USYC Token | 0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C | Arc Testnet | docs.arc.io/arc/references/contract-addresses |
| USYC Teller | 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A | Arc Testnet | docs.arc.io/arc/references/contract-addresses |
| Gateway Wallet Contract | 0x0077777d7EBA4688BDeF3E311b846F25870A19B9 | Arc Testnet | arc-canteen context circlefin-skills/use-gateway.md |
| Gateway Minter Contract | 0x0022222ABE238Cc2C7Bb1f21003F0a260052475B | Arc Testnet | arc-canteen context circlefin-skills/use-gateway.md |
| Agent seller EOA address | DEPLOY_AND_RECORD_ADDRESS_HERE | Arc Testnet | Generated during setup |
| Agent Circle Wallet address | DEPLOY_AND_RECORD_ADDRESS_HERE | Arc Testnet | Created via Circle API |
| Expense EOA address | DEPLOY_AND_RECORD_ADDRESS_HERE | Arc Testnet | Generated during setup |

---

## 10. Concerns Compliance

| # | Severity | Concern | How PRD Addresses It |
|---|:---:|---|---|
| C1 | C | Time is not a constraint — scope achievable in 7-10 build days by solo developer | 7 build days with 5 primary days. No moonshots. USYC deep integration is scoped to APY-first (no allowlisting blocker on Day 1). MCP is 100-line wrapper on Day 4. Scope explicitly cut: enterprise dashboard, multi-agent orchestration, mainnet |
| C2 | C | arc-canteen CLI mandatory — ALL Arc testnet interactions must use arc-canteen | arc-canteen is specified as the ONLY Arc RPC client throughout. All on-chain queries in the Task Execution Engine use arc-canteen CLI child_process spawn. arc-canteen is in the development tools table. Day 0 validation is a CRITICAL task in Day-by-Day Plan |
| C3 | C | Uniqueness is non-negotiable — zero verified competitors in this exact niche | Verified in technical spike: ElizaOS/Coinbase agents use rule-based treasuries. No project combines Circle 4-tool stack + LLM treasury reasoning on Arc. Unique niche confirmed |
| C4 | C | Circle tools must be architecturally motivated — passes substitution test | Each tool addressed: Wallets — remove it, agent has no custody identity or USYC interaction path. Nanopayments — remove it, expenses become invisible gas costs with no attribution. USYC — remove it, idle capital earns nothing. Paymaster — remove it, users pay gas separately. All four pass the substitution test |
| C5 | C | Real humans test — name specific humans with a specific problem | Demo plan requires 5 external wallets making task purchases by Day 6. Recruitment targets: Telegram crypto dev groups, Discord agent builders, hackathon participant channels. A2A auto-caller agent serves as insurance for the 5 events requirement |
| C6 | C | Traction must be self-evidencing — on-chain by design | All income events are Arc transactions. Nanopayment expenses are Arc transactions. 12-day history generates organic onchain traction before demo. Judges can verify every transaction independently via Arc block explorer |
| C7 | C | Demo must show real Arc transactions — mandatory Arc explorer segment | Scene 6 of demo script is dedicated Arc block explorer view showing 12-day transaction history. Every trace line in Scene 5 links to a real Arc tx hash. /proof page lists all tx hashes |
| C8 | C | Cumulative corrections carried forward — V1 + V2 corrections apply | V3 corrections applied: A2A interface included (not out-of-scope), Innovation set to 8 (not 9), task types locked (4 categories as specified in WINNER-BRIEF) |
| C9 | C | Significant problem + builder conviction | Problem: agent developers manually fund and refund wallets. Growing affected population: every AI agent developer working with onchain assets. This is a natural infrastructure problem, not a hackathon-only idea |
| C13 | C | Day-1 users exist TODAY | Identifiable today: any developer building on Circle/Arc stack, any ETHGlobal Open Agents participant, any Discord member in #arc-builders. A2A use case is immediate: any Claude-powered agent can call solv-001 on Day 1 |
| I1 | I | Innovation >= 7/10 — execution-only plays disqualified | Innovation scored 8/10 in warroom. Justified: LLM treasury reasoning over financial state is a novel pattern. Specific combination of Circle 4-tool stack + reasoning on Arc has no known implementation |
| I2 | I | Everything on devnet/testnet | All integrations are Arc testnet only. USDC is testnet token. No mainnet interactions. Explicitly stated in Scope section and Out-of-Scope list |
| I3 | I | Agentic sophistication is real — AI must genuinely decide | Treasury reasoning uses Claude with 4 live financial variables in the prompt. Decision output is ACCEPT/DEFER/REJECT with plain-English explanation. Reasoning tokens counted and logged. This is verifiable in the codebase |
| I4 | I | Demo feels like a real product — UI dashboard strongly preferred | Full three-panel Next.js dashboard specified in Section 2 and Section 7.5. Real data pre-seeded. No empty states. No connect-wallet gate on landing |
| A1 | A | Multi-track eligibility — Circle Tool Integration + Canteen Social | Primary track: Circle Tool Integration. Canteen Social track requires social mechanics not in scope. Advisory only — not worth scope expansion given 5-day build window |
| A2 | A | Post-hackathon path is visible | Agent treasury infrastructure is a real product category. Post-hackathon path: production deployment with mainnet USDC, real USYC yield, commercial task pricing. Mentioned in demo closing scene |
| P1 | P | V3-MANDATE — Traction 6/10 was ReasonTrace's structural weakness | solv-001 scores 7/10 on Traction. Self-evidencing: 12-day onchain history + 5 distinct payer wallets. V3-MANDATE met |
| P2 | P | No Section 10 mirrors — avoid obvious RFB examples | solv-001 is not a perp trading agent, prediction market trader, portfolio manager, or arbitrageur. It is an agent treasury infrastructure layer — a meta-layer above trading agents, not a trading agent itself |
| P3 | P | Nanopayments substitution test | Nanopayments serve a specific purpose that a generic USDC transfer cannot: sub-cent attribution of individual API call costs to specific tasks, creating an immutable expense ledger. Removing Nanopayments makes all expenses invisible and un-attributable |
| P4 | P | arc-canteen Day 0 validation | Day 0 mandatory task in Day-by-Day Plan: run arc-canteen rpc eth_blockNumber before any code. Demo explicitly uses arc-canteen for all on-chain queries. Confirmed working (block 0x2903312 in pre-hackathon test) |
