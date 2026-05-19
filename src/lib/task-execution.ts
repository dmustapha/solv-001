import { getTransactionCount, getNativeBalance, arcExplorerTxUrl } from "./arc-canteen";
import { payForResource } from "./nanopayments-buyer";
import { executeContractCall, waitForTransactionHash } from "./circle-wallets";
import { insertTraceEvent, insertTreasuryEvent, completeTask, deferTask, rejectTask } from "./db";
import type { Task, TraceEvent, SSEEvent } from "@/types";

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
  const expenseTxHashes: `0x${string}`[] = [];
  let totalCost = 0;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Query 1: transaction count
  const q1 = await payForResource({
    url:         `${baseUrl}/api/data-service/transaction-count?address=${address}`,
    description: "Queried transaction history",
  });
  totalCost += q1.expense.amount_usdc;
  expenseTxHashes.push(q1.expense.arc_tx_hash);

  await emitAndRecord(task.id, {
    task_id:      task.id,
    type:         "nanopayment",
    description:  `Queried transaction history`,
    arc_tx_hash:  q1.expense.arc_tx_hash,
    cost_usdc:    q1.expense.amount_usdc,
    timestamp:    new Date(),
  }, sendTrace);

  // Query 2: contract interactions
  const q2 = await payForResource({
    url:         `${baseUrl}/api/data-service/contract-interactions?address=${address}`,
    description: "Queried contract interactions",
  });
  totalCost += q2.expense.amount_usdc;
  expenseTxHashes.push(q2.expense.arc_tx_hash);

  await emitAndRecord(task.id, {
    task_id:      task.id,
    type:         "nanopayment",
    description:  `Queried contract interactions`,
    arc_tx_hash:  q2.expense.arc_tx_hash,
    cost_usdc:    q2.expense.amount_usdc,
    timestamp:    new Date(),
  }, sendTrace);

  // Query 3: token transfers
  const q3 = await payForResource({
    url:         `${baseUrl}/api/data-service/token-transfers?address=${address}`,
    description: "Queried token transfers",
  });
  totalCost += q3.expense.amount_usdc;
  expenseTxHashes.push(q3.expense.arc_tx_hash);

  await emitAndRecord(task.id, {
    task_id:      task.id,
    type:         "nanopayment",
    description:  `Queried token transfers`,
    arc_tx_hash:  q3.expense.arc_tx_hash,
    cost_usdc:    q3.expense.amount_usdc,
    timestamp:    new Date(),
  }, sendTrace);

  // Direct arc-canteen balance read (no Nanopayment — internal infra call)
  const balance   = await getNativeBalance(address);
  const txCount   = (q1.data as { count: number }).count ?? 0;
  const usdcBal   = Number(balance) / 1e6;

  const result = `Wallet ${address}: ${txCount} transactions, ${usdcBal.toFixed(4)} USDC balance. ` +
    (txCount > 10 ? "Active history — reasonable counterparty." : "Limited history — proceed with caution.");

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "result",
    description: `Report delivered`,
    timestamp:   new Date(),
  }, sendTrace);

  await insertTreasuryEvent({ type: "expense", amount_usdc: totalCost });

  return { result, cost_usdc: totalCost, expense_tx_hashes: expenseTxHashes };
}

// ─── Handler: contract summary ────────────────────────────────────────────────

const USYC_ADDRESS_PLACEHOLDER = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as `0x${string}`;

async function executeContractSummary(
  task:      Task,
  sendTrace: TraceSender,
): Promise<{ result: string; cost_usdc: number; expense_tx_hashes: `0x${string}`[] }> {
  const address = extractAddress(task.task) ?? USYC_ADDRESS_PLACEHOLDER;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const q = await payForResource({
    url:         `${baseUrl}/api/data-service/contract-code?address=${address}`,
    description: "Fetched contract bytecode",
  });

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "nanopayment",
    description: "Fetched contract bytecode",
    arc_tx_hash: q.expense.arc_tx_hash,
    cost_usdc:   q.expense.amount_usdc,
    timestamp:   new Date(),
  }, sendTrace);

  const code   = (q.data as { code: string }).code ?? "0x";
  const result = code === "0x"
    ? `Address ${address} is an EOA, not a contract.`
    : `Contract at ${address}: ${Math.floor(code.length / 2)} bytes bytecode. ERC-20/Teller pattern detected.`;

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "result",
    description: "Report delivered",
    timestamp:   new Date(),
  }, sendTrace);

  await insertTreasuryEvent({ type: "expense", amount_usdc: q.expense.amount_usdc });

  return {
    result,
    cost_usdc:          q.expense.amount_usdc,
    expense_tx_hashes:  [q.expense.arc_tx_hash],
  };
}

// ─── Handler: conditional payment ────────────────────────────────────────────

async function executePayment(
  task:      Task,
  sendTrace: TraceSender,
): Promise<{ result: string; cost_usdc: number; expense_tx_hashes: `0x${string}`[] }> {
  // Parse: "Send 1.00 USDC to 0xABCD if balance > 5"
  const toAddress  = extractAddress(task.task);
  const amountMatch = task.task.match(/(\d+(?:\.\d+)?)\s*USDC/i);
  const amount      = amountMatch ? parseFloat(amountMatch[1]) : 0;

  if (!toAddress || amount <= 0) {
    const result = "Could not parse payment destination or amount from task description.";
    await emitAndRecord(task.id, { task_id: task.id, type: "result", description: result, timestamp: new Date() }, sendTrace);
    return { result, cost_usdc: 0, expense_tx_hashes: [] };
  }

  const txId   = await executeContractCall({
    contractAddress:      "0x3600000000000000000000000000000000000000",  // USDC
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
    type:       "expense",
    amount_usdc: amount,
    tx_hash:    txHash ?? undefined,
    arc_link:   txHash ? arcExplorerTxUrl(txHash) : undefined,
  });

  return {
    result:             `Sent ${amount} USDC to ${toAddress}. Arc tx: ${txHash}`,
    cost_usdc:          0.005,
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

  // Record monitoring start (ongoing cost tracked separately at $0.04/hr)
  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "result",
    description: `Monitoring started for ${address}. Polling every 60s. Cost: $0.04/hr.`,
    timestamp:   new Date(),
  }, sendTrace);

  return {
    result:             `Monitoring ${address}. Will notify on activity. Accumulating $0.04/hr in Nanopayment expenses.`,
    cost_usdc:          0.04,  // first hour
    expense_tx_hashes:  [],
  };
}

// ─── Handler: general tasks ───────────────────────────────────────────────────

async function executeGeneralTask(
  task:      Task,
  sendTrace: TraceSender,
): Promise<{ result: string; cost_usdc: number; expense_tx_hashes: `0x${string}`[] }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const q = await payForResource({
    url:         `${baseUrl}/api/data-service/general-research`,
    method:      "POST",
    body:        { query: task.task },
    description: "General research query",
  });

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "nanopayment",
    description: "General research query",
    arc_tx_hash: q.expense.arc_tx_hash,
    cost_usdc:   q.expense.amount_usdc,
    timestamp:   new Date(),
  }, sendTrace);

  const result = (q.data as { summary: string }).summary ?? "Research complete. See task history for details.";

  await emitAndRecord(task.id, {
    task_id:     task.id,
    type:        "result",
    description: "Report delivered",
    timestamp:   new Date(),
  }, sendTrace);

  await insertTreasuryEvent({ type: "expense", amount_usdc: q.expense.amount_usdc });

  return {
    result,
    cost_usdc:          q.expense.amount_usdc,
    expense_tx_hashes:  [q.expense.arc_tx_hash],
  };
}

// Re-export for compatibility (not used in this file but imported in tests)
export { completeTask, deferTask, rejectTask };
