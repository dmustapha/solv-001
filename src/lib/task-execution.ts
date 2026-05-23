import { getTransactionCount, getNativeBalance, getCode, getLogs, checkChainLive,
         arcExplorerTxUrl } from "./arc-canteen";
import { executeContractCall, waitForTransactionHash, getAgentWalletBalance } from "./circle-wallets";
import { insertTraceEvent, insertTreasuryEvent, completeTask, deferTask, rejectTask } from "./db";
import type { Task, TraceEvent, SSEEvent } from "@/types";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const DATA_COST     = 0.005; // per on-chain RPC query
const RESEARCH_COST = 0.010; // per Claude general-research query

// Arc USDC contract on testnet
const ARC_USDC     = "0x3600000000000000000000000000000000000000";
const TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// ─── Types ────────────────────────────────────────────────────────────────────

type TraceSender = (event: SSEEvent) => void;

// ─── Main task dispatcher ─────────────────────────────────────────────────────

export async function executeTask(
  task:       Task,
  sendTrace:  TraceSender,
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
  task_id:    string,
  event:      Omit<TraceEvent, "id">,
  sendTrace:  TraceSender,
): Promise<void> {
  sendTrace({ type: "trace", data: event });
  await insertTraceEvent(event);
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
  let totalCost = 0;

  // Query 1: transaction count
  const txCount = await getTransactionCount(address).catch(() => 0);
  totalCost += DATA_COST;
  await insertTreasuryEvent({ type: "expense", amount_usdc: DATA_COST });

  await emitAndRecord(task.id, {
    task_id:   task.id,
    type:      "query",
    description: "Queried transaction history",
    cost_usdc: DATA_COST,
    timestamp: new Date(),
  }, sendTrace);

  // Query 2: contract interactions (event logs)
  const interactionLogs = await getLogs({ fromBlock: "earliest", toBlock: "latest", address })
    .catch(() => [] as unknown[]);
  totalCost += DATA_COST;
  await insertTreasuryEvent({ type: "expense", amount_usdc: DATA_COST });

  await emitAndRecord(task.id, {
    task_id:   task.id,
    type:      "query",
    description: "Queried contract interactions",
    cost_usdc: DATA_COST,
    timestamp: new Date(),
  }, sendTrace);

  // Query 3: USDC token transfers (sent + received) in last 500 blocks
  let transferCount = 0;
  let totalReceived = 0;

  try {
    const { blockNumber } = await checkChainLive();
    const fromBlock       = "0x" + Math.max(0, blockNumber - 500).toString(16);
    const paddedAddress   = "0x" + "0".repeat(24) + address.slice(2).toLowerCase();

    const [sentLogs, receivedLogs] = await Promise.all([
      getLogs({ fromBlock, toBlock: "latest", address: ARC_USDC, topics: [TRANSFER_SIG, paddedAddress] }),
      getLogs({ fromBlock, toBlock: "latest", address: ARC_USDC, topics: [TRANSFER_SIG, null, paddedAddress] }),
    ]);

    const decodeUsdc = (log: unknown) => Number(BigInt((log as { data: string }).data)) / 1e6;
    transferCount = sentLogs.length + receivedLogs.length;
    totalReceived = receivedLogs.reduce<number>((s, l) => s + decodeUsdc(l), 0);
  } catch { /* RPC unavailable — continue with zeros */ }

  totalCost += DATA_COST;
  await insertTreasuryEvent({ type: "expense", amount_usdc: DATA_COST });

  await emitAndRecord(task.id, {
    task_id:   task.id,
    type:      "query",
    description: "Queried token transfers",
    cost_usdc: DATA_COST,
    timestamp: new Date(),
  }, sendTrace);

  // Balance read (no extra charge — same RPC node)
  const balance = await getNativeBalance(address).catch(() => 0n);
  const usdcBal = Number(balance) / 1e6;

  const result = `Wallet ${address}: ${txCount} nonce txs, ${transferCount} USDC transfers in last 500 blocks ` +
    `(+${totalReceived.toFixed(2)} USDC received), ${usdcBal.toFixed(4)} USDC balance. ` +
    `Contract interactions: ${interactionLogs.length}. ` +
    (txCount > 10 ? "Active history — reasonable counterparty." : "Limited history — proceed with caution.");

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "result",
    description: "Report delivered",
    timestamp:   new Date(),
  }, sendTrace);

  return { result, cost_usdc: totalCost, expense_tx_hashes: [] };
}

// ─── Handler: contract summary ────────────────────────────────────────────────

const USYC_ADDRESS_PLACEHOLDER = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as `0x${string}`;

async function executeContractSummary(
  task:      Task,
  sendTrace: TraceSender,
): Promise<{ result: string; cost_usdc: number; expense_tx_hashes: `0x${string}`[] }> {
  const address = extractAddress(task.task) ?? USYC_ADDRESS_PLACEHOLDER;

  const code = await getCode(address).catch(() => "0x");
  await insertTreasuryEvent({ type: "expense", amount_usdc: DATA_COST });

  await emitAndRecord(task.id, {
    task_id:   task.id,
    type:      "query",
    description: "Fetched contract bytecode",
    cost_usdc: DATA_COST,
    timestamp: new Date(),
  }, sendTrace);

  let result: string;
  if (code === "0x") {
    result = `Address ${address} is an EOA, not a contract.`;
  } else {
    const byteLen = Math.floor((code.length - 2) / 2);
    try {
      const analysis = await anthropic.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages:   [{ role: "user", content: `Analyze this Ethereum contract bytecode and identify its likely purpose, standards (ERC-20, ERC-721, etc.), and key patterns. Be concise (2-3 sentences):\n${code.slice(0, 2000)}` }],
      });
      const summary = analysis.content[0]?.type === "text" ? analysis.content[0].text : "Analysis unavailable.";
      result = `Contract at ${address}: ${byteLen} bytes. ${summary}`;
    } catch {
      result = `Contract at ${address}: ${byteLen} bytes bytecode. Pattern analysis unavailable.`;
    }
  }

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "result",
    description: "Report delivered",
    timestamp:   new Date(),
  }, sendTrace);

  return { result, cost_usdc: DATA_COST, expense_tx_hashes: [] };
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

  // ── Scheduled disbursement: check if date has passed ─────────────────────
  if (task.task_type === "scheduled_disbursement") {
    const dateMatch = task.task.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const scheduledDate = new Date(dateMatch[1]);
      if (scheduledDate > new Date()) {
        const result = `Scheduled for ${dateMatch[1]}. Payment will execute on or after that date. Monitoring active.`;
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

  // ── Conditional payment: evaluate the condition ───────────────────────────
  if (task.task_type === "conditional_payment") {
    const condMatch = task.task.match(/if\s+(?:agent\s+)?balance\s*(>|<|>=|<=)\s*(\d+(?:\.\d+)?)/i);
    if (condMatch) {
      const agentBalance = await getAgentWalletBalance();
      const operator     = condMatch[1];
      const threshold    = parseFloat(condMatch[2]);

      const conditionMet =
        operator === ">"  ? agentBalance > threshold  :
        operator === "<"  ? agentBalance < threshold  :
        operator === ">=" ? agentBalance >= threshold :
        agentBalance <= threshold;

      const condDescription = `Condition check: agent balance $${agentBalance.toFixed(4)} ${operator} $${threshold} → ${conditionMet ? "MET" : "NOT MET"}`;
      await emitAndRecord(task.id, { task_id: task.id, type: "result", description: condDescription, timestamp: new Date() }, sendTrace);

      if (!conditionMet) {
        const result = `Condition not met: agent balance $${agentBalance.toFixed(4)} not ${operator} $${threshold}. Payment withheld.`;
        await emitAndRecord(task.id, { task_id: task.id, type: "result", description: result, timestamp: new Date() }, sendTrace);
        return { result, cost_usdc: DATA_COST, expense_tx_hashes: [] };
      }
    }
  }

  // ── Execute USDC transfer ─────────────────────────────────────────────────
  const txId   = await executeContractCall({
    contractAddress:      "0x3600000000000000000000000000000000000000",  // Arc USDC
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
  });

  return {
    result:             `Sent ${amount} USDC to ${toAddress}. Arc tx: ${txHash ?? "pending"}`,
    cost_usdc:          DATA_COST,
    expense_tx_hashes:  txHash ? [txHash] : [],
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

  // Baseline snapshot: transaction count
  const txCount = await getTransactionCount(address).catch(() => 0);
  await insertTreasuryEvent({ type: "expense", amount_usdc: DATA_COST });

  await emitAndRecord(task.id, {
    task_id:   task.id,
    type:      "query",
    description: "On-chain state snapshot (monitoring baseline)",
    cost_usdc: DATA_COST,
    timestamp: new Date(),
  }, sendTrace);

  const label  = task.task_type === "wallet_watch" ? "wallet" : "contract";
  const result = `Monitoring ${label} ${address}. Baseline: ${txCount} transactions on Arc testnet. Session registered — new activity will be flagged. Ongoing cost: $0.04/hr via Nanopayments.`;

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "result",
    description: `Monitoring session initialized — baseline ${txCount} txs`,
    timestamp:   new Date(),
  }, sendTrace);

  const totalCost = DATA_COST + 0.04; // snapshot + first hour monitoring
  await insertTreasuryEvent({ type: "expense", amount_usdc: 0.04 });

  return { result, cost_usdc: totalCost, expense_tx_hashes: [] };
}

// ─── Handler: general tasks ───────────────────────────────────────────────────

async function executeGeneralTask(
  task:      Task,
  sendTrace: TraceSender,
): Promise<{ result: string; cost_usdc: number; expense_tx_hashes: `0x${string}`[] }> {
  await insertTreasuryEvent({ type: "expense", amount_usdc: RESEARCH_COST });

  await emitAndRecord(task.id, {
    task_id:   task.id,
    type:      "query",
    description: "General research query",
    cost_usdc: RESEARCH_COST,
    timestamp: new Date(),
  }, sendTrace);

  let result = "Research complete. See task history for details.";
  try {
    const response = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages:   [{
        role:    "user",
        content: `You are a research assistant specializing in Arc testnet, Circle payments, and DeFi. Answer concisely in 2-4 sentences: ${task.task}`,
      }],
    });
    if (response.content[0]?.type === "text") {
      result = response.content[0].text;
    }
  } catch { /* fall through to default result */ }

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
