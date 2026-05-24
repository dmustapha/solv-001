import { getTransactionCount, getNativeBalance, getCode, getLogs, checkChainLive,
         arcExplorerTxUrl, ethCall } from "./arc-canteen";
import { executeContractCall, waitForTransactionHash, getAgentWalletBalance } from "./circle-wallets";
import { insertTraceEvent, insertTreasuryEvent, completeTask, deferTask, rejectTask, setTaskResult } from "./db";
import { getUSYCPosition } from "./usyc";
import type { Task, TraceEvent, SSEEvent } from "@/types";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const DATA_COST     = 0.005; // per on-chain RPC query
const RESEARCH_COST = 0.010; // per Claude general-research query

// Arc USDC contract on testnet
const ARC_USDC     = "0x3600000000000000000000000000000000000000";
const TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// ─── Module-level: multi-chain enrichment ─────────────────────────────────────
// Official free RPCs — no API key required. Rate limits irrelevant at our volume.

const CHAINS = [
  { name: "Ethereum", rpc: "https://cloudflare-eth.com",        usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", timeout: 4000 },
  { name: "Base",     rpc: "https://mainnet.base.org",           usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", timeout: 3000 },
  { name: "Arbitrum", rpc: "https://arb1.arbitrum.io/rpc",       usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", timeout: 3000 },
  { name: "Optimism", rpc: "https://mainnet.optimism.io",        usdc: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", timeout: 3000 },
  { name: "Polygon",  rpc: "https://polygon-rpc.com",            usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", timeout: 3000 },
] as const;

type Chain = typeof CHAINS[number];
type ChainData = { name: string; txCount: number; usdcVolume: number; sentCount: number; recvCount: number };

// latest-10000 block window — avoids RPC log caps and timeout on public RPCs.
// "0x0" would timeout on Ethereum/Arbitrum (too many historical logs).
async function fetchChainData(chain: Chain, address: `0x${string}`, paddedAddress: string): Promise<ChainData> {
  const rpc = async (method: string, params: unknown[], id: number): Promise<unknown> =>
    Promise.race([
      fetch(chain.rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id }),
      }).then(r => r.json()),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), chain.timeout)),
    ]);

  const latestBlock = await rpc("eth_blockNumber", [], 10)
    .then((r) => parseInt((r as { result: string }).result, 16))
    .catch(() => 0);
  const fromBlock = "0x" + Math.max(0, latestBlock - 10000).toString(16);

  const [nonceRes, sentRes, recvRes] = await Promise.allSettled([
    rpc("eth_getTransactionCount", [address, "latest"], 1),
    rpc("eth_getLogs", [{ fromBlock, toBlock: "latest", address: chain.usdc, topics: [TRANSFER_SIG, paddedAddress] }], 2),
    rpc("eth_getLogs", [{ fromBlock, toBlock: "latest", address: chain.usdc, topics: [TRANSFER_SIG, null, paddedAddress] }], 3),
  ]);

  const txCount   = nonceRes.status === "fulfilled"
    ? parseInt(((nonceRes.value as { result: string }).result) ?? "0x0", 16) : 0;
  const decodeLog = (log: unknown) => Number(BigInt((log as { data: string }).data)) / 1e6;
  const sentLogs  = sentRes.status === "fulfilled" ? ((sentRes.value as { result: unknown[] }).result ?? []) : [];
  const recvLogs  = recvRes.status === "fulfilled" ? ((recvRes.value as { result: unknown[] }).result ?? []) : [];
  const usdcVolume = [...sentLogs, ...recvLogs].reduce<number>((s, l) => s + decodeLog(l), 0);

  return { name: chain.name, txCount, usdcVolume, sentCount: sentLogs.length, recvCount: recvLogs.length };
}

// ─── Module-level: known Arc contract registry ────────────────────────────────

const KNOWN_CONTRACTS: Record<string, { name: string; description: string; type: string }> = {
  "0x3600000000000000000000000000000000000000": {
    name: "USDC (Arc Testnet)",
    description: "Circle USD Coin — ERC-20 stablecoin, 6 decimals. The primary settlement currency on Arc testnet.",
    type: "ERC-20 Token",
  },
  "0xe9185f0c5f296ed1797aae4238d26ccabeadb86c": {
    name: "USYC Token (Arc Testnet)",
    description: "Hashnote US Yield Coin — yield-bearing token backed by short-duration US Treasuries. Redeemable via the USYC Teller.",
    type: "ERC-20 Yield Token",
  },
  "0x9fdf14c5b14173d74c08af27aebff39240dc105a": {
    name: "USYC Teller (Arc Testnet)",
    description: "Hashnote Teller contract — deposit USDC to receive USYC, redeem USYC for USDC. Manages exchange rate at ~4.85% APY.",
    type: "Yield Vault (Teller)",
  },
  "0x0077777d7eba4688bdef3e311b846f25870a19b9": {
    name: "GatewayWalletBatched (Arc Testnet)",
    description: "Circle Gateway contract — batches EIP-3009 payment authorizations for gas-efficient settlement. Used by x402 protocol.",
    type: "Payment Gateway",
  },
};

// ERC-20 function selectors for eth_call detection
const ERC20_SELECTORS: Record<string, string> = {
  name:        "0x06fdde03",
  symbol:      "0x95d89b41",
  decimals:    "0x313ce567",
  totalSupply: "0x18160ddd",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type TraceSender = (event: SSEEvent) => void;
type LogEntry    = { data: string; topics: (string | null | undefined)[] };

// ─── Main task dispatcher ─────────────────────────────────────────────────────

export async function executeTask(
  task:      Task,
  sendTrace: TraceSender,
): Promise<{ result: string; cost_usdc: number; expense_tx_hashes: `0x${string}`[] }> {
  switch (task.task_type) {
    case "wallet_intelligence":
    case "counterparty_vet":
      return executeWalletIntelligence(task, sendTrace);

    case "contract_summary":
      return executeContractSummary(task, sendTrace);

    case "conditional_payment":
    case "scheduled_disbursement":
      return executePayment(task, sendTrace);

    case "wallet_watch":
    case "contract_watch":
      return executeWatchTask(task, sendTrace);

    case "general":
      return executeGeneralTask(task, sendTrace);

    default:
      throw new Error(`Unknown task_type: ${task.task_type}`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function emitAndRecord(
  task_id:   string,
  event:     Omit<TraceEvent, "id">,
  sendTrace: TraceSender,
): Promise<void> {
  sendTrace({ type: "trace", data: event });
  await insertTraceEvent(event).catch(() => null);
}

function extractAddress(taskText: string): `0x${string}` | null {
  const match = taskText.match(/0x[a-fA-F0-9]{40}/);
  return match ? (match[0] as `0x${string}`) : null;
}

// ─── Handler: wallet intelligence + counterparty vet ─────────────────────────

async function executeWalletIntelligence(
  task:      Task,
  sendTrace: TraceSender,
): Promise<{ result: string; cost_usdc: number; expense_tx_hashes: `0x${string}`[] }> {
  const address = extractAddress(task.task) ?? (process.env.DEMO_WALLET_01 as `0x${string}`);
  const paddedAddress = "0x" + "0".repeat(24) + address.slice(2).toLowerCase();
  let totalCost = 0;

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "query",
    description: "Querying Arc testnet + 5 mainnet chains in parallel",
    cost_usdc:   DATA_COST * 3,
    timestamp:   new Date(),
  }, sendTrace);

  // All Arc + 5 mainnet queries in ONE Promise.allSettled — parallel from t=0.
  // Arc uses fromBlock "0x0" (young chain, safe). Mainnet uses latest-10000 (avoids log caps).
  const allResults = await Promise.allSettled([
    // Arc queries (indices 0-3)
    getTransactionCount(address),
    getLogs({ fromBlock: "0x0", toBlock: "latest", address: ARC_USDC, topics: [TRANSFER_SIG, paddedAddress] })
      .then(l => l.slice(0, 500)),
    getLogs({ fromBlock: "0x0", toBlock: "latest", address: ARC_USDC, topics: [TRANSFER_SIG, null, paddedAddress] })
      .then(l => l.slice(0, 500)),
    getNativeBalance(address),
    // 5 mainnet chains (indices 4-8)
    ...CHAINS.map(c => fetchChainData(c, address, paddedAddress)),
  ]);

  totalCost += DATA_COST * 3;
  await insertTreasuryEvent({ type: "expense", amount_usdc: DATA_COST * 3 }).catch(() => null);

  // Parse Arc results
  const txCountArc   = allResults[0].status === "fulfilled" ? (allResults[0].value as number) : 0;
  const sentLogs     = allResults[1].status === "fulfilled" ? (allResults[1].value as LogEntry[]) : [];
  const receivedLogs = allResults[2].status === "fulfilled" ? (allResults[2].value as LogEntry[]) : [];
  const arcBalance   = allResults[3].status === "fulfilled" ? (allResults[3].value as bigint) : 0n;

  const decodeUsdc       = (log: LogEntry) => Number(BigInt(log.data)) / 1e6;
  const arcSentTotal     = sentLogs.reduce((s, l) => s + decodeUsdc(l), 0);
  const arcReceivedTotal = receivedLogs.reduce((s, l) => s + decodeUsdc(l), 0);
  const arcUsdcBal       = Number(arcBalance) / 1e6;

  const counterparties = new Set([
    ...sentLogs.map(l  => "0x" + (l.topics[2] ?? "").slice(26)),
    ...receivedLogs.map(l => "0x" + (l.topics[1] ?? "").slice(26)),
  ]);

  // Parse chain results (indices 4+)
  const chainData: ChainData[] = allResults.slice(4)
    .filter(r => r.status === "fulfilled")
    .map(r => (r as PromiseFulfilledResult<ChainData>).value);

  const totalCrossChainTxs  = chainData.reduce((s, c) => s + c.txCount, 0);
  const totalCrossChainUsdc = chainData.reduce((s, c) => s + c.usdcVolume, 0);
  const activeChains        = chainData.filter(c => c.txCount > 0);
  const mostActive          = [...activeChains].sort((a, b) => b.txCount - a.txCount)[0]?.name ?? "Arc only";

  // Claude Haiku reasoning — 800 tokens, 5-section structured report
  const prompt = `You are a blockchain intelligence analyst. Analyze this wallet and provide a structured report.

WALLET ADDRESS: ${address}

ARC TESTNET (Circle payments chain):
- Nonce: ${txCountArc} (lifetime transactions)
- USDC sent (all-time): $${arcSentTotal.toFixed(2)}
- USDC received (all-time): $${arcReceivedTotal.toFixed(2)}
- Current USDC balance: $${arcUsdcBal.toFixed(4)}
- Unique counterparties: ${counterparties.size}

CROSS-CHAIN ACTIVITY (last ~10,000 blocks per chain):
${chainData.map(c => `- ${c.name}: ${c.txCount} txs | $${c.usdcVolume.toFixed(2)} USDC volume`).join("\n")}

SUMMARY: ${totalCrossChainTxs} total transactions across ${activeChains.length} chains | $${totalCrossChainUsdc.toFixed(2)} USDC volume
MOST ACTIVE: ${mostActive}

TASK: ${task.task}

Provide a structured intelligence report with these 5 sections:
1. IDENTITY: Who likely controls this wallet (institution, individual, protocol)?
2. ACTIVITY: Transaction patterns and payment behavior
3. COUNTERPARTY RISK: Trust assessment and red flags (if any)
4. FINANCIAL PROFILE: Balance sheet and cashflow summary
5. RECOMMENDATION: One clear sentence — safe to transact, proceed with caution, or avoid

Be specific. Reference actual numbers. No generic advice.`;

  let analysisText = "";
  try {
    const analysis = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages:   [{ role: "user", content: prompt }],
    });
    analysisText = analysis.content[0]?.type === "text" ? analysis.content[0].text : "";
    totalCost += RESEARCH_COST;
    await insertTreasuryEvent({ type: "expense", amount_usdc: RESEARCH_COST }).catch(() => null);
  } catch {
    analysisText = `IDENTITY: Unknown. ACTIVITY: ${txCountArc} Arc txs, ${totalCrossChainTxs} cross-chain txs. ` +
      `COUNTERPARTY RISK: Limited data. FINANCIAL PROFILE: $${arcUsdcBal.toFixed(2)} USDC on Arc, ` +
      `$${totalCrossChainUsdc.toFixed(2)} USDC volume cross-chain. ` +
      `RECOMMENDATION: ${txCountArc + totalCrossChainTxs > 10 ? "Reasonable history — proceed normally." : "Thin history — proceed with caution."}`;
  }

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "result",
    description: "Report delivered",
    timestamp:   new Date(),
  }, sendTrace);

  return { result: analysisText, cost_usdc: totalCost, expense_tx_hashes: [] };
}

// ─── Handler: contract summary ────────────────────────────────────────────────

const USYC_ADDRESS_PLACEHOLDER = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as `0x${string}`;

async function executeContractSummary(
  task:      Task,
  sendTrace: TraceSender,
): Promise<{ result: string; cost_usdc: number; expense_tx_hashes: `0x${string}`[] }> {
  const address = (extractAddress(task.task) ?? USYC_ADDRESS_PLACEHOLDER).toLowerCase() as `0x${string}`;

  // Check known registry first — no RPC needed
  const known = KNOWN_CONTRACTS[address];
  if (known) {
    await emitAndRecord(task.id, {
      task_id:     task.id,
      type:        "query",
      description: "Matched known Arc contract registry",
      cost_usdc:   0,
      timestamp:   new Date(),
    }, sendTrace);
    const result = `${known.name} (${known.type})\n\n${known.description}\n\nAddress: ${address}`;
    await emitAndRecord(task.id, { task_id: task.id, type: "result", description: "Known contract — registry lookup", timestamp: new Date() }, sendTrace);
    return { result, cost_usdc: 0, expense_tx_hashes: [] };
  }

  // Unknown contract — fetch bytecode
  const code = await getCode(address).catch(() => "0x");
  await insertTreasuryEvent({ type: "expense", amount_usdc: DATA_COST }).catch(() => null);

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "query",
    description: "Fetched contract bytecode",
    cost_usdc:   DATA_COST,
    timestamp:   new Date(),
  }, sendTrace);

  if (code === "0x") {
    const result = `Address ${address} is an EOA (externally owned account), not a contract. No code deployed at this address on Arc testnet.`;
    await emitAndRecord(task.id, { task_id: task.id, type: "result", description: "EOA detected", timestamp: new Date() }, sendTrace);
    return { result, cost_usdc: DATA_COST, expense_tx_hashes: [] };
  }

  // eth_call ERC-20 standard detection (ethCall is a static import from arc-canteen)
  const erc20Data: Record<string, string> = {};
  for (const [fnName, selector] of Object.entries(ERC20_SELECTORS)) {
    try {
      const raw = await ethCall({ to: address, data: selector });
      if (raw && raw !== "0x") {
        if (fnName === "decimals") {
          erc20Data[fnName] = parseInt(raw, 16).toString();
        } else if (fnName === "totalSupply") {
          erc20Data[fnName] = (Number(BigInt(raw)) / 1e6).toFixed(2) + " (assuming 6 decimals)";
        } else {
          // ABI-decode string: skip 32-byte offset + 32-byte length, read UTF-8
          try {
            const hex    = raw.slice(2);
            const offset = parseInt(hex.slice(0, 64), 16) * 2;
            const length = parseInt(hex.slice(64, 128), 16) * 2;
            const strHex = hex.slice(128, 128 + length);
            erc20Data[fnName] = Buffer.from(strHex, "hex").toString("utf8");
          } catch { erc20Data[fnName] = raw.slice(0, 20); }
        }
      }
    } catch { /* selector reverts — not ERC-20 */ }
  }

  const isERC20  = !!(erc20Data.name || erc20Data.symbol);
  const byteLen  = Math.floor((code.length - 2) / 2);

  // Extract function selectors from bytecode (PUSH4 pattern)
  const functionSelectors: string[] = [];
  const bytecodeHex = code.slice(2);
  for (let i = 0; i < bytecodeHex.length - 10; i += 2) {
    if (bytecodeHex.slice(i, i + 2) === "63") { // PUSH4 opcode
      functionSelectors.push("0x" + bytecodeHex.slice(i + 2, i + 10));
    }
  }

  const context = isERC20
    ? `ERC-20 token detected: name="${erc20Data.name}", symbol="${erc20Data.symbol}", decimals=${erc20Data.decimals}, totalSupply=${erc20Data.totalSupply}`
    : `Bytecode size: ${byteLen} bytes. Function selectors found: ${functionSelectors.slice(0, 8).join(", ")}`;

  const prompt = `You are a smart contract analyst. Analyze this Arc testnet contract and provide a clear technical report.

CONTRACT ADDRESS: ${address}
DETECTED INFO: ${context}
TASK: ${task.task}

Provide:
1. CONTRACT TYPE: What kind of contract is this? (ERC-20, DEX, vault, proxy, etc.)
2. KEY FUNCTIONS: What does it do? What are the main callable operations?
3. RISK ASSESSMENT: Any red flags or notable patterns?
4. INTEGRATION NOTES: How would a developer or user interact with this contract?

Be specific. Reference the selectors/token info. Max 5 sentences per section.`;

  let result = "";
  try {
    const analysis = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages:   [{ role: "user", content: prompt }],
    });
    const summary = analysis.content[0]?.type === "text" ? analysis.content[0].text : "";
    result = `Contract: ${address} (${byteLen} bytes)\n${isERC20 ? `Token: ${erc20Data.name} (${erc20Data.symbol})\n` : ""}${summary}`;
    await insertTreasuryEvent({ type: "expense", amount_usdc: RESEARCH_COST }).catch(() => null);
  } catch {
    result = `Contract at ${address}: ${byteLen} bytes. ` +
      (isERC20
        ? `Token: ${erc20Data.name} (${erc20Data.symbol}), ${erc20Data.decimals} decimals, supply: ${erc20Data.totalSupply}.`
        : `${functionSelectors.length} function selectors detected. Analysis unavailable.`);
  }

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "result",
    description: "Report delivered",
    timestamp:   new Date(),
  }, sendTrace);

  return { result, cost_usdc: DATA_COST + RESEARCH_COST, expense_tx_hashes: [] };
}

// ─── Handler: conditional payment + scheduled disbursement ───────────────────

async function executePayment(
  task:      Task,
  sendTrace: TraceSender,
): Promise<{ result: string; cost_usdc: number; expense_tx_hashes: `0x${string}`[] }> {
  const toAddress   = extractAddress(task.task);
  const amountMatch = task.task.match(/(\d+(?:\.\d+)?)\s*USDC/i);
  const amount      = amountMatch ? parseFloat(amountMatch[1]) : 0;

  if (!toAddress || amount <= 0) {
    const result = "Could not parse payment destination or amount from task description.";
    await emitAndRecord(task.id, { task_id: task.id, type: "result", description: result, timestamp: new Date() }, sendTrace);
    return { result, cost_usdc: 0, expense_tx_hashes: [] };
  }

  // ── Scheduled disbursement: defer if date has not passed ─────────────────
  if (task.task_type === "scheduled_disbursement") {
    const dateMatch = task.task.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const scheduledDate = new Date(dateMatch[1]);
      if (scheduledDate > new Date()) {
        const state  = JSON.stringify({ scheduled_date: dateMatch[1], to_address: toAddress, amount });
        const result = `Scheduled for ${dateMatch[1]}. Daily check active — payment will execute on or after that date.`;
        await setTaskResult(task.id, result);
        await deferTask(task.id, state);
        await emitAndRecord(task.id, { task_id: task.id, type: "result", description: result, timestamp: new Date() }, sendTrace);
        return { result, cost_usdc: DATA_COST, expense_tx_hashes: [] };
      }
      await emitAndRecord(task.id, {
        task_id:     task.id,
        type:        "result",
        description: `Scheduled date ${dateMatch[1]} has passed. Proceeding with transfer.`,
        timestamp:   new Date(),
      }, sendTrace);
    }
  }

  // ── Conditional payment: Claude-parsed condition evaluation ───────────────
  if (task.task_type === "conditional_payment") {
    const [agentBalance, payerBalanceRaw, chainState] = await Promise.all([
      getAgentWalletBalance().catch(() => 0),
      toAddress ? getNativeBalance(toAddress).catch(() => 0n) : Promise.resolve(0n),
      checkChainLive().catch(() => ({ blockNumber: 0 })),
    ]);
    const payerBalance = Number(payerBalanceRaw) / 1e6;
    const blockNumber  = chainState.blockNumber;

    let conditionMet         = false;
    let conditionExplanation = "";

    try {
      const parseResult = await anthropic.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [{
          role:    "user",
          content: `Parse this payment condition and evaluate it. Return ONLY valid JSON.

CONDITION TEXT: "${task.task}"
LIVE VALUES:
- agent_balance: ${agentBalance}
- payer_balance: ${payerBalance}
- block_number: ${blockNumber}
- current_date: ${new Date().toISOString().slice(0, 10)}

Return: {"met": boolean, "explanation": "one sentence why"}`,
        }],
      });
      const raw = parseResult.content[0]?.type === "text" ? parseResult.content[0].text : "";
      // Extract JSON — handles Claude wrapping JSON in prose
      const jsonMatch = raw.match(/\{[\s\S]+?\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      // SAFETY RULE: met must be explicitly boolean true — any ambiguity withholds payment
      if (typeof (parsed as Record<string, unknown>).met !== "boolean") throw new Error("met field not boolean");
      conditionMet         = (parsed as { met: boolean }).met === true;
      conditionExplanation = typeof (parsed as { explanation?: unknown }).explanation === "string"
        ? (parsed as { explanation: string }).explanation
        : "Claude evaluation";
    } catch {
      // Fallback: regex for simple agent balance conditions only
      const condMatch = task.task.match(/if\s+(?:agent\s+)?balance\s*(>|<|>=|<=)\s*(\d+(?:\.\d+)?)/i);
      if (condMatch) {
        const op        = condMatch[1];
        const threshold = parseFloat(condMatch[2]);
        conditionMet =
          op === ">"  ? agentBalance > threshold  :
          op === "<"  ? agentBalance < threshold  :
          op === ">=" ? agentBalance >= threshold :
          agentBalance <= threshold;
        conditionExplanation = `Agent balance $${agentBalance.toFixed(2)} ${op} $${threshold}`;
      } else {
        // Unknown condition — never send money on uncertainty
        conditionMet         = false;
        conditionExplanation = "Could not parse condition — payment withheld for safety.";
      }
    }

    await emitAndRecord(task.id, {
      task_id:     task.id,
      type:        "result",
      description: `Condition: ${conditionExplanation} → ${conditionMet ? "MET" : "NOT MET"}`,
      timestamp:   new Date(),
    }, sendTrace);

    if (!conditionMet) {
      return {
        result:            `Condition not met: ${conditionExplanation}. Payment withheld.`,
        cost_usdc:         DATA_COST,
        expense_tx_hashes: [],
      };
    }
  }

  // ── Execute USDC transfer ─────────────────────────────────────────────────
  const txId   = await executeContractCall({
    contractAddress:      "0x3600000000000000000000000000000000000000",
    abiFunctionSignature: "transfer(address,uint256)",
    abiParameters:        [toAddress, (amount * 1_000_000).toFixed(0)],
  });
  const txHash = await waitForTransactionHash(txId);

  await emitAndRecord(task.id, {
    task_id:      task.id,
    type:         "result",
    description:  `Sent ${amount} USDC to ${toAddress}`,
    arc_tx_hash:  txHash ?? undefined,
    timestamp:    new Date(),
  }, sendTrace);

  await insertTreasuryEvent({
    type:        "expense",
    amount_usdc: amount,
    tx_hash:     txHash ?? undefined,
    arc_link:    txHash ? arcExplorerTxUrl(txHash) : undefined,
  }).catch(() => null);

  return {
    result:            `Sent ${amount} USDC to ${toAddress}. Arc tx: ${txHash ?? "pending"}`,
    cost_usdc:         DATA_COST,
    expense_tx_hashes: txHash ? [txHash] : [],
  };
}

// ─── Handler: wallet/contract watch ──────────────────────────────────────────

async function executeWatchTask(
  task:      Task,
  sendTrace: TraceSender,
): Promise<{ result: string; cost_usdc: number; expense_tx_hashes: `0x${string}`[] }> {
  const address = extractAddress(task.task);
  if (!address) {
    return { result: "No address found in task — monitoring not started.", cost_usdc: 0, expense_tx_hashes: [] };
  }

  // Baseline snapshot
  const txCount = await getTransactionCount(address).catch(() => 0);
  await insertTreasuryEvent({ type: "expense", amount_usdc: DATA_COST }).catch(() => null);

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "query",
    description: "On-chain state snapshot (monitoring baseline)",
    cost_usdc:   DATA_COST,
    timestamp:   new Date(),
  }, sendTrace);

  // Store baseline state for daily cron checker
  const state  = JSON.stringify({ baseline_tx_count: txCount, address });
  const label  = task.task_type === "wallet_watch" ? "wallet" : "contract";
  const result = `Monitoring ${label} ${address}. Baseline: ${txCount} transactions on Arc testnet. Checked daily — new activity will trigger an alert.`;
  await setTaskResult(task.id, result);
  await deferTask(task.id, state);

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "result",
    description: `Monitoring initialized — baseline ${txCount} txs`,
    timestamp:   new Date(),
  }, sendTrace);

  return { result, cost_usdc: DATA_COST, expense_tx_hashes: [] };
}

// ─── Handler: general tasks ───────────────────────────────────────────────────

async function executeGeneralTask(
  task:      Task,
  sendTrace: TraceSender,
): Promise<{ result: string; cost_usdc: number; expense_tx_hashes: `0x${string}`[] }> {
  await insertTreasuryEvent({ type: "expense", amount_usdc: RESEARCH_COST }).catch(() => null);

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "query",
    description: "Research query",
    cost_usdc:   RESEARCH_COST,
    timestamp:   new Date(),
  }, sendTrace);

  // Inject live Arc context (getUSYCPosition is a static import from ./usyc)
  let liveContext = "";
  try {
    const agentAddr = (process.env.AGENT_WALLET_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
    const [chainState, usycData] = await Promise.all([
      checkChainLive(),
      getUSYCPosition(agentAddr).catch(() => null),
    ]);
    liveContext = `\nLIVE ARC CONTEXT (as of this request):\n` +
      `- Arc testnet block: ${chainState.blockNumber}\n` +
      `- Arc chain ID: 5042002\n` +
      `- Agent USYC position: ${usycData
        ? `${(Number(usycData.usyc_balance) / 1e18).toFixed(4)} USYC at ${(usycData.apy * 100).toFixed(2)}% APY`
        : "unavailable"}\n`;
  } catch { /* continue without live data */ }

  // Detect if task mentions an address — inject balance
  const address = extractAddress(task.task);
  if (address) {
    try {
      const bal = await getNativeBalance(address).catch(() => 0n);
      liveContext += `- Queried address ${address} USDC balance: $${(Number(bal) / 1e6).toFixed(4)}\n`;
    } catch { /* skip */ }
  }

  const prompt = `You are a research assistant specializing in Arc testnet, Circle payments (x402, EIP-3009, GatewayWalletBatched), USYC/Hashnote yield, and DeFi on EVM chains.
${liveContext}
Answer the following question thoroughly and accurately. Include specific technical details, numbers, and addresses where relevant. Do not artificially limit your response length — answer as completely as the question requires.

QUESTION: ${task.task}`;

  let result = "Research complete. Retrieval unavailable.";
  try {
    const response = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages:   [{ role: "user", content: prompt }],
    });
    if (response.content[0]?.type === "text") result = response.content[0].text;
  } catch { /* fall through */ }

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "result",
    description: "Report delivered",
    timestamp:   new Date(),
  }, sendTrace);

  return { result, cost_usdc: RESEARCH_COST, expense_tx_hashes: [] };
}

// Re-export for compatibility
export { completeTask, deferTask, rejectTask };
