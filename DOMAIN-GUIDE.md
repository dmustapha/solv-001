# solv-001 — Domain Knowledge Guide

> Generated from ARCHITECTURE.md Section 26. Reference before writing any feature code.

---

## Key Terms & Code Identifiers

| Term | Code Identifier | Definition | Source |
|---|---|---|---|
| Arc testnet | `arcTestnet` (viem chain) | Circle's EVM-compatible L1; USDC is native gas (6 dec, addr 0x3600...) | docs.arc.io |
| solv-001 | `solv-001` | The AI agent system; earns by completing tasks, reasons with Claude, saves in USYC | PRD §1 |
| Circle Dev-Controlled Wallet | `CIRCLE_WALLET_ID` | Server-side wallet managed via Circle API; no raw private key; agent's USDC custody | PRD §4 |
| Expense EOA | `EXPENSE_WALLET_PRIVATE_KEY` | Separate EOA for GatewayClient; required because Nanopayments uses ecrecover | forge-state.json §spike |
| Nanopayments seller | `verifyNanopayment` | Income side: EIP-3009 payment gate on POST /api/tasks | x402-batching/server |
| Nanopayments buyer | `GatewayClient` | Expense side: agent pays for its own API calls; every call is Arc tx | x402-batching/client |
| USYC | `USYC_ADDRESS` | Yield-bearing stablecoin on Arc (addr 0xe918...); requires allowlisting; earns APY | docs.arc.io |
| Teller | `TELLER_ADDRESS` | USYC Teller contract (addr 0x9fdF...); deposit/redeem USDC↔USYC | docs.arc.io |
| Operating reserve | `OPERATING_RESERVE_USDC = 10` | USDC kept liquid; USYC sweep only above reserve × 1.5 | PRD §4 |
| Treasury reasoning | `streamTreasuryReasoning` | Claude claude-sonnet-4-6 streaming; 4 inputs → ACCEPT/DEFER/REJECT | PRD §4 |
| arc-canteen | `arcRPC`, `callArc` | Mandatory CLI for Arc testnet queries; spawned as child_process | hackathon brief §17 |
| A2A | `AgentCard` | Agent-to-Agent protocol; agent card at /.well-known/agent.json | PRD §4 |
| MCP | `Server` (@modelcontextprotocol/sdk) | Machine Conversation Protocol; HTTP/SSE transport | PRD §4 |
| Trace event | `TraceEvent` | Single execution step: payment / query / nanopayment / result | PRD §4 |
| SSE stream | `ReadableStream` | Server-Sent Events from POST /api/tasks to dashboard; character-by-character | PRD §3 |

---

## Business Rules (code must enforce)

1. No task executes without payment authorization or `demo_mode: true`
2. `sweepIdleUSDCtoUSYC` must not sweep below `OPERATING_RESERVE_USDC`
3. Circle Dev-Controlled Wallet: all contract calls go through Circle API; never expose private key
4. Expense wallet (EOA): used only for GatewayClient; never for custody
5. Every external API call in task execution must go through `payForResource` to generate an expense tx
6. USYC allowlisting required before deposit succeeds — APY reads work without it
7. arc-canteen is mandatory for all on-chain queries; direct RPC is a fallback only

---

## Arc Testnet Addresses (all verified)

| Name | Address |
|---|---|
| USDC (native gas) | `0x3600000000000000000000000000000000000000` |
| USYC token | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` |
| USYC Teller | `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A` |
| Circle GatewayWallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| Circle GatewayMinter | `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B` |

---

## Key API Endpoints

| Name | URL |
|---|---|
| Arc RPC (primary via CLI) | via `arc-canteen rpc` |
| Arc RPC (fallback direct) | `https://rpc.testnet.arc-node.thecanteenapp.com/v1/...` |
| Circle Wallets API | `https://api.circle.com/v1/w3s` |
| Circle Gateway (testnet) | `https://gateway-api-testnet.circle.com` |
| Arc Explorer | `https://explorer.arcnetwork.xyz` (assumed) |

---

## Treasury Decision Logic

```
Treasury Reasoning receives task →
  Claude call (claude-sonnet-4-6, max 200 tokens, streaming) →
  Parse ACCEPT/DEFER/REJECT from response →
  If no decision keyword: retry once with simplified prompt →
  If still no keyword: default to DEFER (conservative fallback)

ACCEPT → execute task → earn USDC income
DEFER  → save for later (borderline tasks)
REJECT → decline (negative ROI or capability mismatch)
```

---

## Critical Flow: Task Submission (income path)

```
POST /api/tasks
  → verifyNanopayment() [INCOME — EIP-3009 gate, or demo_mode:true]
  → DB write (task record, status=pending)
  → streamTreasuryReasoning() [Claude decides ACCEPT/DEFER/REJECT]
  → if ACCEPT: runTaskExecution()
      → payForResource() [EXPENSE — GatewayClient.pay() for each API call]
      → external API calls (data gathering)
      → format result
  → DB update (status=completed, result stored)
  → sweepIdleUSDCtoUSYC() [yield optimization]
  → SSE stream complete event
```

---

## Unverified / Assumed Patterns (watch these in build)

| Tag | Pattern | Risk |
|-----|---------|------|
| [UNVERIFIED] | `GatewayClient.pay()` API shape | May differ from docs; has try/catch fallback |
| [ASSUMED] | USYC Teller ABI | Must retrieve from Arc explorer on Day 1 |
| [ASSUMED] | `arc-canteen` CLI subcommand syntax | Verify each subcommand before use |
| [ASSUMED] | Arc RPC URL format | Confirmed working in url_preverify; use from .env |
