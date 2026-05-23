export type TaskType =
  | "wallet_intelligence"
  | "counterparty_vet"
  | "contract_summary"
  | "conditional_payment"
  | "scheduled_disbursement"
  | "wallet_watch"
  | "contract_watch"
  | "general";

export type TaskStatus =
  | "pending"
  | "reasoning"
  | "executing"
  | "complete"
  | "deferred"
  | "rejected"
  | "failed";

export type ClientType = "human" | "agent";

export interface EIP3009Auth {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;           // decimal string USDC base units (6 decimals)
  validAfter: string;      // unix timestamp string
  validBefore: string;     // unix timestamp string
  nonce: `0x${string}`;
  signature: `0x${string}`;
}

export interface TaskSubmission {
  task: string;
  task_type: TaskType;
  payer_wallet: `0x${string}`;
  callback_url?: string;
  client_type?: "human" | "agent";      // optional: A2A callers pass "agent"
  payment_authorization?: EIP3009Auth;  // absent → 402 response returned
}

export interface Task {
  id: string;
  task: string;
  task_type: TaskType;
  payer_wallet: `0x${string}`;
  status: TaskStatus;
  income_usdc: number;
  cost_usdc: number | null;
  net_usdc: number | null;
  reasoning: string | null;
  result: string | null;
  client_type: ClientType;
  income_tx_hash: `0x${string}` | null;
  expense_tx_hashes: `0x${string}`[];
  created_at: Date;
  completed_at: Date | null;
}

export interface TreasuryState {
  usdc_balance: number;
  usyc_balance: number;
  usyc_usdc_value: number;
  usyc_apy: number;
  pending_income_usdc: number;
  today_income_usdc: number;
  today_expense_usdc: number;
  today_net_usdc: number;
  operating_reserve_usdc: number;
  total_tasks_completed: number;
  total_income_all_time_usdc: number;
  last_updated: Date;
}

export interface WalletInfo {
  wallet_id: string;
  address: `0x${string}`;
  usdc_balance: number;
  blockchain: "ARC-TESTNET";
}

export interface USYCPosition {
  usyc_balance: bigint;    // raw token units (18 decimals)
  exchange_rate: number;   // USYC per USDC (from Teller)
  usdc_value: number;      // computed: usyc_balance_ether / exchange_rate
  apy: number;             // annual yield e.g. 0.0485 = 4.85%
}

export interface ReasoningContext {
  current_balance_usdc: number;
  usyc_reserve_usdc: number;
  pending_income_usdc: number;
  operating_reserve_usdc: number;
  task_price_usdc: number;
  estimated_execution_cost_usdc: number;
  task_profit_margin: number;
  task_type: TaskType;
  task_priority: number;
  queue_depth: number;
}

export interface ReasoningDecision {
  decision: "ACCEPT" | "DEFER" | "REJECT";
  explanation: string;
  reasoning_tokens: number;
}

export interface TraceEvent {
  id?: string;
  task_id: string;
  type: "payment_received" | "query" | "nanopayment" | "reasoning" | "result";
  description: string;
  arc_tx_hash?: `0x${string}`;
  cost_usdc?: number;
  timestamp: Date;
}

export interface NanopaymentExpense {
  description: string;
  amount_usdc: number;
  arc_tx_hash: `0x${string}`;
  timestamp: Date;
}

export interface AgentCapability {
  task_type: TaskType;
  description: string;
  price_usdc: number;
  estimated_cost_usdc: number;
}

export interface AgentCard {
  name: "solv-001";
  version: "1.0.0";
  description: string;
  capabilities: AgentCapability[];
  pricing: Partial<Record<TaskType, { price_usdc: number; currency: "USDC" }>>;
  payment: {
    method: "x402";
    chain: "arcTestnet";
    seller_address: `0x${string}`;
    facilitator_url: string;
  };
  api: {
    rest: { submit_task: string; get_status: string; estimate: string };
    mcp: { endpoint: string; transport: "http-sse" };
  };
}

// SSE event shapes sent from POST /api/tasks to browser
export type SSEEvent =
  | { type: "treasury_snapshot"; data: TreasuryState }
  | { type: "reasoning_chunk"; data: string }
  | { type: "reasoning_complete"; data: ReasoningDecision }
  | { type: "trace"; data: TraceEvent }
  | { type: "complete"; data: { task_id: string; result: string; net_usdc: number } }
  | { type: "deferred"; data: { task_id: string; reason: string } }
  | { type: "rejected"; data: { task_id: string; reason: string } }
  | { type: "error"; data: string };

export const TASK_PRICING: Record<TaskType, { price_usdc: number; estimated_cost_usdc: number }> = {
  wallet_intelligence:     { price_usdc: 0.50, estimated_cost_usdc: 0.015 },
  counterparty_vet:        { price_usdc: 0.50, estimated_cost_usdc: 0.015 },
  contract_summary:        { price_usdc: 0.75, estimated_cost_usdc: 0.020 },
  conditional_payment:     { price_usdc: 0.20, estimated_cost_usdc: 0.005 },
  scheduled_disbursement:  { price_usdc: 0.20, estimated_cost_usdc: 0.005 },
  wallet_watch:            { price_usdc: 0.10, estimated_cost_usdc: 0.040 },  // $0.04/hr ongoing
  contract_watch:          { price_usdc: 0.10, estimated_cost_usdc: 0.040 },
  general:                 { price_usdc: 0.30, estimated_cost_usdc: 0.022 },
};

export const OPERATING_RESERVE_USDC = 10;
export const USYC_SWEEP_MULTIPLIER  = 1.5;  // sweep when balance > reserve * 1.5
