# solv-001 — Payment Verification

> **Live at:** [solv-001.vercel.app](https://solv-001.vercel.app)
> **As of:** 2026-05-24 — 200 tasks completed, $48.65 total income

This document explains how every payment in solv-001 is verified, what the transaction identifiers mean, and where to find on-chain evidence.

---

## What the agent transacts

solv-001 runs two live payment flows on Arc Testnet:

| Flow | Direction | Mechanism | When |
|------|-----------|-----------|------|
| **Income** | Payer → Agent | EIP-3009 TransferWithAuthorization via Circle x402 | On every task submission |
| **Expense** | Agent → Data Services | x402 GatewayClient (Circle GatewayWalletBatched) | Per data API call during task execution |

---

## Income payments — how they work

1. The user signs an EIP-3009 `TransferWithAuthorization` typed payload in their wallet (MetaMask / Rabby on Arc Testnet, chain ID 5042002). No gas required — the auth is off-chain.
2. The signed authorization is included as `payment_authorization` in the POST `/api/tasks` body.
3. The server sends it to Circle's Gateway facilitator at `gateway-api-testnet.circle.com/v1/x402/verify`.
4. If valid, the server calls `/v1/x402/settle` — Circle settles the USDC transfer on Arc Testnet via the `GatewayWalletBatched` contract at `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`.
5. The settlement reference is stored as `income_tx_hash` in the task record.

### Why settlement IDs are UUIDs, not 0x hashes

The `GatewayWalletBatched` contract settles payments in batches for gas efficiency. When Circle's facilitator returns `{ success: true, transaction: "..." }`, the `transaction` field is a Circle internal batch reference UUID (e.g. `07d5811e-624f-4b19-b...`), not an individual Arc Testnet transaction hash.

On-chain evidence exists at the contract level: the `GatewayWalletBatched` contract at `0x0077777...` receives USDC deposits that are then distributed across settled authorizations in batch. The agent wallet (`0x927c1d756d12879aebea0772f3ee220f21f4841a`) receives net USDC — visible on the Arc Testnet explorer.

**Sample income settlement IDs from the proof page:**
```
07d5811e-624f-4b19-b...
e3498b7f-924f-4b3a-9...
8b669ed4-e43e-4281-8...
```

---

## Expense payments — how they work

Data API calls during task execution are paid via `@circle-fin/x402-batching` GatewayClient:

1. `GatewayClient.pay(url)` hits the data-service endpoint without payment → receives HTTP 402 with a `PAYMENT-REQUIRED` header.
2. GatewayClient reads the payment requirements, signs an EIP-3009 authorization using the agent's expense wallet (`EXPENSE_WALLET_PRIVATE_KEY`).
3. Retries the request with a `Payment-Signature: base64(JSON)` header.
4. The data-service calls Circle's facilitator to verify and settle.
5. The settlement UUID is stored as the expense trace entry.

**Expense wallet (funded):** `0x156D30820aec51eEB34C74977Eb5f106322c2B50`
**Gateway contract:** `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` (Arc Testnet)

---

## Task pricing and margins

| Task Type | Price | Est. Cost | Margin |
|-----------|-------|-----------|--------|
| Wallet Intelligence | $0.50 | $0.015 | 97% |
| Counterparty Vetting | $0.50 | $0.015 | 97% |
| Contract Summary | $0.75 | $0.020 | 97% |
| Conditional Payment | $0.20 | $0.005 | 98% |
| Scheduled Disbursement | $0.20 | $0.005 | 98% |
| Wallet Watch | $0.10 | $0.040 | 60% |
| Contract Watch | $0.10 | $0.040 | 60% |
| General Analysis | $0.30 | $0.022 | 93% |

All task fees are paid via a single EIP-3009 signature — no gas required from the user.

---

## On-chain verification

| What | Where |
|------|-------|
| Agent wallet activity | [explorer.arcnetwork.xyz/address/0x927c1d756d12879aebea0772f3ee220f21f4841a](https://explorer.arcnetwork.xyz/address/0x927c1d756d12879aebea0772f3ee220f21f4841a) |
| GatewayWalletBatched contract | [explorer.arcnetwork.xyz/address/0x0077777d7EBA4688BDeF3E311b846F25870A19B9](https://explorer.arcnetwork.xyz/address/0x0077777d7EBA4688BDeF3E311b846F25870A19B9) |
| USDC token (Arc) | [explorer.arcnetwork.xyz/address/0x3600000000000000000000000000000000000000](https://explorer.arcnetwork.xyz/address/0x3600000000000000000000000000000000000000) |
| USYC Teller contract | [explorer.arcnetwork.xyz/address/0x9fdF14c5B14173D74C08Af27AebFf39240dC105A](https://explorer.arcnetwork.xyz/address/0x9fdF14c5B14173D74C08Af27AebFf39240dC105A) |
| Live proof page | [solv-001.vercel.app/proof](https://solv-001.vercel.app/proof) |

---

## USYC — Idle Capital Yield

The agent reads the Hashnote USYC Teller contract directly for live APY data (4.85% as of deploy). Idle USDC above the $10 operating reserve is swept into USYC automatically via:

```
USDC.approve(Teller, sweep_amount)
Teller.deposit(sweep_amount)
```

The USYC position is held in the Circle Developer-Controlled Wallet and redeemed on demand if the USDC balance drops below the reserve threshold. The sweep mechanism is implemented and tested — execution requires Hashnote to allowlist the Circle wallet address on the Teller contract.

---

## Test coverage

The full payment flow is covered by an integration test suite (`scripts/test-runner-v2.ts`) that runs 160 tests against the live production API:

- Real EIP-3009 signatures submitted and verified through Circle Gateway
- Rate limit behavior (5 paid tasks per 60s sliding window)
- Invalid auth rejection (expired, wrong recipient, replayed nonce)
- A2A agent-to-agent payment flows
- MCP protocol payments
- SSE stream events (treasury_snapshot → reasoning → trace → complete)

**Result: 160/160 passing** against `https://solv-001.vercel.app`
