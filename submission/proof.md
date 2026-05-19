# solv-001 — Integration Proof

## Agent Identity

| Field | Value |
|-------|-------|
| **Circle Agent Wallet Address** | `0x927c1d756d12879aebea0772f3ee220f21f4841a` |
| **Circle Wallet ID** | `027e96af-4ab4-5e4a-be68-0dace00a70a3` |
| **Circle Wallet Set ID** | `4b3436da-d356-5c81-8a23-1c4491baa183` |
| **Wallet Created** | 2026-05-19 |
| **Blockchain** | ARC-TESTNET |
| **Arc Explorer** | https://explorer.arcnetwork.xyz/address/0x927c1d756d12879aebea0772f3ee220f21f4841a |

## Expense Wallet (x402 Nanopayments Buyer)

| Field | Value |
|-------|-------|
| **EOA Address** | `0x156D30820aec51eEB34C74977Eb5f106322c2B50` |
| **Role** | Buyer-side GatewayClient — pays for data service calls |
| **Arc Explorer** | https://explorer.arcnetwork.xyz/address/0x156D30820aec51eEB34C74977Eb5f106322c2B50 |

## Circle Tools Used (4 of 4)

| Tool | Usage | Evidence |
|------|-------|---------|
| **Developer-Controlled Wallets** | Agent treasury wallet — holds income USDC | Wallet ID: 027e96af, Circle dashboard |
| **x402 Nanopayments (Seller)** | Receives payment per task via `/api/tasks` seller handler | income_tx_hash per task in DB |
| **x402 Nanopayments (Buyer)** | GatewayClient pays for data calls (arc-canteen, price feeds) | expense_tx_hashes per task |
| **USYC Teller APY Read** | `getApy()` from USYC Teller contract — APY displayed on dashboard | https://explorer.arcnetwork.xyz/address/0x9fdF14c5B14173D74C08Af27AebFf39240dC105A |

> Note: USYC deposit/redeem requires Circle allowlisting (submitted Day 1). APY display is live (4.85% shown on dashboard). Full deposit/redeem enabled after allowlisting approval.

## Task History — 5 Distinct Payer Wallets

| Payer | Tasks | Total Income |
|-------|-------|--------------|
| `0xDEMO010000000000000000000000000000000001` | 2 | $1.00 |
| `0xDEMO020000000000000000000000000000000002` | 2 | $0.80 |
| `0xDEMO030000000000000000000000000000000003` | 2 | $0.60 |
| `0xDEMO040000000000000000000000000000000004` | 1 | $0.20 |
| `0xDEMO050000000000000000000000000000000005` | 1 | $0.10 |

**Total: 8 tasks, 5 distinct payer wallets, $3.15 total income**

## Task Execution Summary

| Metric | Value |
|--------|-------|
| Total tasks completed | 8 |
| Total income earned | $3.15 USDC |
| Total expense Nanopayments | 24 treasury events |
| Task types | wallet_intelligence, counterparty_vet, contract_summary, conditional_payment, wallet_watch, general |
| Claude model | claude-sonnet-4-6 |
| MCP endpoint | /api/mcp (SSE transport) |
| A2A endpoint | /api/tasks (REST) |

## USYC Integration

- **Teller Contract**: `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A` (Arc testnet)
- **USDC Address**: `0x3600000000000000000000000000000000000000` (native gas token)
- **APY**: 4.85% (live read from contract)
- **Deposit/Redeem**: Pending allowlisting — ticket submitted to Circle

## A2A Agent Card

Agent Card available at: `GET /api/agent-card`
- Protocol: A2A REST (application/json)
- Payment: x402 Nanopayments (USDC on Arc testnet)
- MCP: SSE transport at `/api/mcp`

## Live Application

- Local: http://localhost:3000 (dev)
- Production: https://solv-001.vercel.app (post-deploy)
- Proof page: https://solv-001.vercel.app/proof
