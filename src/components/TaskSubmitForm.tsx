"use client";

import { useState } from "react";
import { createWalletClient, custom, parseUnits } from "viem";
import { TASK_PRICING } from "@/types";
import type { TaskType, EIP3009Auth } from "@/types";

const ARC_CHAIN_ID   = 5042002;
const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const;

interface Props {
  walletAddress:    `0x${string}` | null;
  isOnArcTestnet:   boolean;
  uiState:          "idle" | "composing" | string;
  selectedTaskType: TaskType | null;
  onTaskTypeSelect: (type: TaskType) => void;
  onSubmit:         (payload: Record<string, unknown>) => void;
  onBack?:          () => void;
}

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEth(): EthProvider | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: EthProvider }).ethereum ?? null;
}

const TASK_LABELS: Record<TaskType, string> = {
  wallet_intelligence:    "Wallet Intelligence",
  counterparty_vet:       "Counterparty Vetting",
  contract_summary:       "Contract Summary",
  conditional_payment:    "Conditional Payment",
  scheduled_disbursement: "Scheduled Disbursement",
  wallet_watch:           "Wallet Watch",
  contract_watch:         "Contract Watch",
  general:                "General Analysis",
};

const TASK_DESCRIPTIONS: Record<TaskType, string> = {
  wallet_intelligence:    "Full cross-chain activity profile for any address",
  counterparty_vet:       "Risk assessment before sending funds",
  contract_summary:       "Plain-English audit of any contract",
  conditional_payment:    "Execute a payment when an on-chain condition is met",
  scheduled_disbursement: "Send USDC at a specific time or date",
  wallet_watch:           "Get alerted when a wallet makes a move",
  contract_watch:         "Monitor contract events continuously",
  general:                "Open-ended financial reasoning and research",
};

const TASK_PLACEHOLDERS: Record<TaskType, string> = {
  wallet_intelligence:    "e.g., Profile 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  counterparty_vet:       "e.g., Vet 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 before I send $5k",
  contract_summary:       "e.g., Summarize the USYC teller at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A",
  conditional_payment:    "e.g., Send 10 USDC to 0xabc... when agent balance exceeds 50 USDC",
  scheduled_disbursement: "e.g., Send 5 USDC to 0xabc... on 2026-06-01",
  wallet_watch:           "e.g., Watch 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 for new activity",
  contract_watch:         "e.g., Monitor 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A for events",
  general:                "e.g., What is the current USYC APY and should I hold or sell?",
};

// Category accent colors
const TASK_ACCENT: Record<TaskType, string> = {
  wallet_intelligence:    "var(--blue)",
  counterparty_vet:       "var(--blue)",
  contract_summary:       "var(--blue)",
  conditional_payment:    "var(--green)",
  scheduled_disbursement: "var(--green)",
  wallet_watch:           "var(--violet)",
  contract_watch:         "var(--violet)",
  general:                "var(--amber)",
};

export default function TaskSubmitForm({
  walletAddress,
  isOnArcTestnet,
  uiState,
  selectedTaskType,
  onTaskTypeSelect,
  onSubmit,
  onBack,
}: Props) {
  const [task,  setTask]  = useState("");
  const [error, setError] = useState("");

  const pricing = selectedTaskType ? TASK_PRICING[selectedTaskType] : null;

  async function buildPaymentAuth(taskType: TaskType): Promise<EIP3009Auth> {
    const walletClient = createWalletClient({
      transport: custom(getEth()! as Parameters<typeof custom>[0]),
    });

    const [account]   = await walletClient.requestAddresses();
    const agentWallet = process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS as `0x${string}`;
    const price       = parseUnits(TASK_PRICING[taskType].price_usdc.toFixed(6), 6);
    const now         = BigInt(Math.floor(Date.now() / 1000));
    const validAfter  = now - 600n;
    const validBefore = now + 604900n;
    const nonce       = `0x${crypto.getRandomValues(new Uint8Array(32)).reduce(
      (acc, b) => acc + b.toString(16).padStart(2, "0"), "",
    )}` as `0x${string}`;

    const signature = await walletClient.signTypedData({
      account,
      domain: {
        name:              "GatewayWalletBatched",
        version:           "1",
        chainId:           ARC_CHAIN_ID,
        verifyingContract: GATEWAY_WALLET,
      },
      types: {
        TransferWithAuthorization: [
          { name: "from",        type: "address" },
          { name: "to",          type: "address" },
          { name: "value",       type: "uint256" },
          { name: "validAfter",  type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce",       type: "bytes32" },
        ],
      },
      primaryType: "TransferWithAuthorization",
      message: { from: account, to: agentWallet, value: price, validAfter, validBefore, nonce },
    });

    return {
      from:        account,
      to:          agentWallet,
      value:       price.toString(),
      validAfter:  validAfter.toString(),
      validBefore: validBefore.toString(),
      nonce,
      signature,
    };
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!task.trim())       { setError("Task description is required"); return; }
    if (task.length > 2000) { setError("Task must be 2000 characters or fewer"); return; }
    if (!walletAddress)     { setError("Connect your wallet first"); return; }
    if (!isOnArcTestnet)    { setError("Switch to Arc Testnet first"); return; }
    if (!selectedTaskType)  { setError("Select a task type"); return; }

    try {
      const auth = await buildPaymentAuth(selectedTaskType);
      onSubmit({
        task,
        task_type:             selectedTaskType,
        payer_wallet:          auth.from,
        payment_authorization: auth,
      });
      setTask("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment signing failed");
    }
  };

  // ── Idle: task type selection grid ────────────────────────────────────────
  if (uiState === "idle") {
    const canSubmit = !!(walletAddress && isOnArcTestnet);

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-[20px] font-semibold mb-1" style={{ color: "var(--text-1)" }}>
            Select a task
          </h2>
          <p className="text-[13px]" style={{ color: "var(--text-2)" }}>
            {!walletAddress
              ? "Connect your wallet using the button above to get started."
              : !isOnArcTestnet
              ? "Switch to Arc Testnet to submit tasks."
              : "Pay per task · USDC · No subscriptions"}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(TASK_PRICING) as TaskType[]).map((type) => {
            const accent = TASK_ACCENT[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => { if (canSubmit) onTaskTypeSelect(type); }}
                disabled={!canSubmit}
                className="border p-4 text-left flex flex-col gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background:  "var(--surf)",
                  borderColor: "var(--wire)",
                  borderLeft:  `3px solid ${accent}`,
                  minHeight:   "88px",
                }}
                onMouseEnter={e => {
                  if (canSubmit) {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background   = "var(--surf-2)";
                    el.style.borderColor  = accent;
                  }
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background  = "var(--surf)";
                  el.style.borderColor = "var(--wire)";
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[14px] font-medium leading-snug" style={{ color: "var(--text-1)" }}>
                    {TASK_LABELS[type]}
                  </span>
                  <span
                    className="text-[13px] font-mono font-semibold shrink-0"
                    style={{ color: "var(--amber)" }}
                  >
                    ${TASK_PRICING[type].price_usdc.toFixed(2)}
                  </span>
                </div>
                <span className="text-[12px] leading-snug" style={{ color: "var(--text-2)" }}>
                  {TASK_DESCRIPTIONS[type]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Composing: textarea + submit ──────────────────────────────────────────
  return (
    <div className="panel flex-1 flex flex-col">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          {onBack && (
            <>
              <button
                type="button"
                onClick={onBack}
                className="text-[13px] font-medium transition-colors"
                style={{ color: "var(--text-2)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-2)"; }}
              >
                ← Back
              </button>
              <span className="h-3 w-px" style={{ background: "var(--wire-2)" }} />
            </>
          )}
          <span className="text-[14px] font-semibold" style={{ color: "var(--text-1)" }}>
            {selectedTaskType ? TASK_LABELS[selectedTaskType] : "New Task"}
          </span>
        </div>
        {pricing && (
          <span className="font-mono text-[14px] font-semibold" style={{ color: "var(--amber)" }}>
            ${pricing.price_usdc.toFixed(2)}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4 gap-3">
        <textarea
          value={task}
          onChange={e => setTask(e.target.value)}
          placeholder={selectedTaskType ? TASK_PLACEHOLDERS[selectedTaskType] : "Describe your task..."}
          className="flex-1 border px-3 py-3 text-[14px] resize-none focus:outline-none transition-colors"
          style={{
            background:   "var(--surf-2)",
            borderColor:  "var(--wire)",
            color:        "var(--text-1)",
            minHeight:    "120px",
          }}
          onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--amber)"; }}
          onBlur={e =>  { (e.currentTarget as HTMLElement).style.borderColor = "var(--wire)"; }}
          maxLength={2000}
          autoFocus
        />

        {task.length > 1800 && (
          <div className="text-[11px] font-mono text-right -mt-1" style={{ color: "var(--amber)" }}>
            {task.length}/2000
          </div>
        )}

        {error && (
          <p className="text-[12px]" style={{ color: "var(--red)" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={!walletAddress || !isOnArcTestnet || !task.trim()}
          className="w-full border py-3 text-[13px] font-medium transition-all disabled:opacity-30"
          style={{ background: "transparent", borderColor: "var(--amber)", color: "var(--amber)" }}
          onMouseEnter={e => {
            if (walletAddress && isOnArcTestnet) {
              (e.currentTarget as HTMLElement).style.background = "rgba(232,160,16,0.08)";
            }
          }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {pricing
            ? `Run ${TASK_LABELS[selectedTaskType!]} · $${pricing.price_usdc.toFixed(2)} USDC`
            : "Run task"}
        </button>
      </form>
    </div>
  );
}
