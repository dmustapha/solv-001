import Anthropic from "@anthropic-ai/sdk";
import type { ReasoningContext, ReasoningDecision, TaskType } from "@/types";
import { OPERATING_RESERVE_USDC } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── System prompt ────────────────────────────────────────────────────────────
// Instructs Claude to reason as a treasury manager, not a decision engine.
// The goal: produce reasoning that is visibly multi-variable, not if-else logic.

const TREASURY_SYSTEM_PROMPT = `You are the financial reasoning layer of solv-001, an autonomous AI agent that earns USDC by completing tasks on the Arc blockchain.

Your role: evaluate incoming tasks against the current treasury state and decide whether to ACCEPT or DEFER each task. Payment has already been collected — REJECT is not an option post-payment.

Decision rules:
- ACCEPT: margin is positive, confirmed balance minus operating reserve covers execution cost, and queue is manageable
- DEFER: confirmed balance minus operating reserve is insufficient to cover estimated execution cost, OR queue_depth > 5, OR operations wallet < $0.50 — explanation must reference specific numbers
- For ongoing monitoring tasks (wallet_watch, contract_watch): factor in that estimated cost accumulates across multiple cron cycles — apply stricter margin threshold

You receive structured treasury context and must produce a decision followed by a 1-3 sentence plain-English explanation. Your explanation must reference at least 2 treasury variables — do not produce a simple threshold check.

Format your response as:
DECISION: [ACCEPT|DEFER]
EXPLANATION: [1-3 sentences explaining the specific financial reasoning. Name the numbers.]
SWEEP_USDC: [amount in USD to move from USDC balance into USYC right now, e.g. 5.00 — use 0.00 if balance is near operating reserve or task just accepted is expensive]
CONTRIBUTION_RATE: [0|0.005|0.01|0.02] — ecosystem contribution rate applied to this task's income. Tiers: critical balance <$20 = 0, lean $20-50 = 0.005, healthy $50-100 = 0.01, strong >$100 = 0.02. Only applies on ACCEPT.`;

// ─── Reasoning prompt builder ─────────────────────────────────────────────────

function buildReasoningPrompt(ctx: ReasoningContext): string {
  const marginPct = (ctx.task_profit_margin * 100).toFixed(1);

  return `Treasury state:
- Confirmed USDC balance: $${ctx.current_balance_usdc.toFixed(2)}
- USYC reserve (earning yield): $${ctx.usyc_reserve_usdc.toFixed(2)}
- Pending income (unconfirmed): $${ctx.pending_income_usdc.toFixed(2)}
- Operating reserve target: $${ctx.operating_reserve_usdc.toFixed(2)}
- Operations wallet balance (pays data query fees): $${ctx.expense_wallet_usdc.toFixed(2)}
- Active tasks in queue: ${ctx.queue_depth}

Incoming task:
- Type: ${ctx.task_type}
- Task price (income): $${ctx.task_price_usdc.toFixed(4)}
- Estimated execution cost: $${ctx.estimated_execution_cost_usdc.toFixed(4)}
- Profit margin: ${marginPct}%
- Priority level: ${ctx.task_priority}/5

Evaluate this task. Reason about the full treasury picture, not just the margin.
Should we ACCEPT or DEFER?`;
}

// ─── Streaming reasoning call ─────────────────────────────────────────────────

export async function* streamTreasuryReasoning(
  ctx: ReasoningContext,
): AsyncGenerator<{ chunk?: string; decision?: ReasoningDecision }> {
  const stream = await anthropic.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 600,
    stream:     true,
    system:     TREASURY_SYSTEM_PROMPT,
    messages:   [{ role: "user", content: buildReasoningPrompt(ctx) }],
  });

  let fullText      = "";
  let inputTokens   = 0;
  let outputTokens  = 0;

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      const chunk = event.delta.text;
      fullText   += chunk;
      yield { chunk };
    }
    if (event.type === "message_delta" && event.usage) {
      outputTokens = event.usage.output_tokens;
    }
    if (event.type === "message_start" && event.message.usage) {
      inputTokens = event.message.usage.input_tokens;
    }
  }

  // Parse decision from completed text
  const decisionMatch      = fullText.match(/DECISION:\s*(ACCEPT|DEFER)/i);
  const explanationMatch   = fullText.match(/EXPLANATION:\s*([\s\S]*?)(?=\nSWEEP_USDC:|$)/i);
  const sweepMatch         = fullText.match(/SWEEP_USDC:\s*\[?([\d.]+)\]?/i);
  const contributionMatch  = fullText.match(/CONTRIBUTION_RATE:\s*\[?([\d.]+)\]?/i);

  const decision: "ACCEPT" | "DEFER" =
    (decisionMatch?.[1]?.toUpperCase() as "ACCEPT" | "DEFER") ?? "DEFER";

  const explanation = (
    (explanationMatch?.[1]?.trim() ?? fullText.replace(/DECISION:.*\n?/i, "").trim())
    || "Treasury state evaluated. Decision deferred pending balance confirmation."
  );

  const sweep_usdc         = Math.max(0, parseFloat(sweepMatch?.[1] ?? "0") || 0);
  const rawRate            = parseFloat(contributionMatch?.[1] ?? "0") || 0;
  const VALID_RATES        = [0, 0.005, 0.01, 0.02];
  const contribution_rate  = VALID_RATES.includes(rawRate) ? rawRate : 0;

  yield {
    decision: {
      decision,
      explanation,
      reasoning_tokens: inputTokens + outputTokens,
      sweep_usdc,
      contribution_rate,
    },
  };
}

// ─── Build reasoning context from live treasury state ─────────────────────────

export function buildReasoningContext(params: {
  current_balance_usdc:            number;
  usyc_usdc_value:                 number;
  pending_income_usdc:             number;
  expense_wallet_usdc:             number;
  task_type:                       TaskType;
  task_price_usdc:                 number;
  estimated_execution_cost_usdc:   number;
  queue_depth:                     number;
}): ReasoningContext {
  const margin = params.task_price_usdc > 0
    ? (params.task_price_usdc - params.estimated_execution_cost_usdc) / params.task_price_usdc
    : 0;

  const priorityMap: Record<TaskType, number> = {
    conditional_payment:    5,
    counterparty_vet:       4,
    wallet_intelligence:    4,
    contract_summary:       3,
    wallet_watch:           3,
    contract_watch:         3,
    scheduled_disbursement: 2,
    general:                2,
  };

  return {
    current_balance_usdc:           params.current_balance_usdc,
    usyc_reserve_usdc:              params.usyc_usdc_value,
    pending_income_usdc:            params.pending_income_usdc,
    operating_reserve_usdc:         OPERATING_RESERVE_USDC,
    expense_wallet_usdc:            params.expense_wallet_usdc,
    task_price_usdc:                params.task_price_usdc,
    estimated_execution_cost_usdc:  params.estimated_execution_cost_usdc,
    task_profit_margin:             margin,
    task_type:                      params.task_type,
    task_priority:                  priorityMap[params.task_type] ?? 2,
    queue_depth:                    params.queue_depth,
  };
}
