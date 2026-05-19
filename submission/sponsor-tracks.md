# solv-001 — Sponsor Track Integration

## Canteen (Host)

- **Platform**: Agora Agents Hackathon — AI agents with real payments
- **Integration**: Full Arc testnet deployment; arc-canteen CLI for chain queries; USYC Teller APY integration
- **Agentic Sophistication**: Multi-tool orchestration (4 Circle tools), Claude extended-thinking reasoning, A2A protocol, MCP server
- **Innovation**: Meta-layer agent that reasons about tasks before executing (treasury health → task profitability → decide/defer/reject)

## Circle

| Tool | Integration Depth |
|------|------------------|
| **Developer-Controlled Wallets** | Agent treasury wallet created via SDK; getWalletTokenBalance(); executeContractCall() for USYC; full lifecycle managed |
| **x402 Nanopayments — Seller** | NanopaymentsSellerHandler in /api/tasks; EIP-3009 payment verification; income tracked per task |
| **x402 Nanopayments — Buyer** | GatewayClient.pay() in task-execution.ts; expenses for data service calls (arc-canteen, price queries) |
| **USYC Teller** | getApy() called on every treasury fetch; sweepIdleUSDCtoUSYC() on task completion (pending allowlisting); APY shown on dashboard |

**Circle API calls per task (estimated):** 8–12 (wallet check, token balance, income receive, 3–5 expense nanopayments, USYC apy read, conditional USYC sweep)

**Circle substitution test (Critique verified):** Remove Circle tools → project fails entirely. Agent can't receive payment (no wallet), can't pay for data (no buyer), can't hold yield (no USYC).

## Arc

| Integration | Details |
|-------------|---------|
| **Chain** | ARC-TESTNET (chain ID 26) |
| **USDC** | Native gas token — `0x3600000000000000000000000000000000000000` |
| **arc-canteen CLI** | Wallet history queries, chain liveness checks, USYC Teller ABI retrieval |
| **USYC Teller** | `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A` — APY reads live |
| **Explorer** | All tx hashes linked to https://explorer.arcnetwork.xyz |
| **RPC** | `https://rpc.testnet.arc-node.thecanteenapp.com/...` |

## Judging Criteria Alignment

| Criterion | Weight | Evidence |
|-----------|--------|---------|
| **Agentic Sophistication** | 30% | Extended-thinking reasoning engine; multi-step task orchestration; treasury health decision gate; A2A protocol; MCP server |
| **Traction** | 30% | 8 completed tasks from 5 distinct payer wallets; A2A auto-caller generates ongoing activity; $3.15 total income |
| **Circle Tool Usage** | 20% | 4 Circle tools (Wallets, x402 Seller, x402 Buyer, USYC); 8–12 API calls per task; substitution test passes |
| **Innovation** | 20% | First "reasoning-gated" agent treasury on Arc; AI decides whether a task is worth executing before accepting payment; meta-intelligence layer |
