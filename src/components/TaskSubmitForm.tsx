"use client";

import { useState } from "react";
import { createWalletClient, custom, parseUnits } from "viem";
import { TASK_PRICING } from "@/types";
import type { TaskType, EIP3009Auth } from "@/types";

const ARC_CHAIN_ID   = 5042002;
const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const;

interface Props {
  walletAddress:     `0x${string}` | null;
  isOnArcTestnet:    boolean;
  uiState:           "idle" | "composing" | string;
  selectedTaskType:  TaskType | null;
  onTaskTypeSelect:  (type: TaskType) => void;
  onSubmit:          (payload: Record<string, unknown>) => void;
  onBack?:           () => void;
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
  wallet_intelligence:    "Deep profile of any wallet address",
  counterparty_vet:       "Risk check before transacting",
  contract_summary:       "Plain-English contract audit",
  conditional_payment:    "Trigger payment on-chain condition",
  scheduled_disbursement: "Time-based payment execution",
  wallet_watch:           "Alert when wallet activity detected",
  contract_watch:         "Monitor contract events continuously",
  general:                "Open-ended financial reasoning",
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

    const [account]    = await walletClient.requestAddresses();
    const agentWallet  = process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS as `0x${string}`;
    const price        = parseUnits(TASK_PRICING[taskType].price_usdc.toFixed(6), 6);
    const now          = BigInt(Math.floor(Date.now() / 1000));
    const validAfter   = now - 600n;
    const validBefore  = now + 604900n;
    const nonce        = `0x${crypto.getRandomValues(new Uint8Array(32)).reduce(
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
    if (!task.trim())        { setError("Task description is required"); return; }
    if (task.length > 2000)  { setError("Task must be 2000 characters or fewer"); return; }
    if (!walletAddress)      { setError("Connect your wallet first"); return; }
    if (!isOnArcTestnet)     { setError("Switch to Arc Testnet first"); return; }
    if (!selectedTaskType)   { setError("Select a task type"); return; }

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

  // ── Idle: card grid task type selector ────────────────────────────────────
  if (uiState === "idle") {
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header">
          <span className="label">What can I help you with?</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TASK_PRICING) as TaskType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  if (!walletAddress || !isOnArcTestnet) return;
                  onTaskTypeSelect(type);
                }}
                disabled={!walletAddress || !isOnArcTestnet}
                className="border p-3 text-left flex flex-col gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--surf-2)", borderColor: "var(--wire)" }}
                onMouseEnter={e => {
                  if (walletAddress && isOnArcTestnet) {
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--amber)";
                    (e.currentTarget as HTMLElement).style.background  = "rgba(232,160,16,0.04)";
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--wire)";
                  (e.currentTarget as HTMLElement).style.background  = "var(--surf-2)";
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-mono font-semibold" style={{ color: "var(--text-1)" }}>
                    {TASK_LABELS[type]}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: "var(--amber)" }}>
                    ${TASK_PRICING[type].price_usdc.toFixed(2)}
                  </span>
                </div>
                <span className="text-[10px] font-mono leading-snug" style={{ color: "var(--text-3)" }}>
                  {TASK_DESCRIPTIONS[type]}
                </span>
              </button>
            ))}
          </div>

          {(!walletAddress || !isOnArcTestnet) && (
            <p className="text-[10px] font-mono text-center mt-4" style={{ color: "var(--text-3)" }}>
              {!walletAddress ? "Connect your wallet to submit tasks" : "Switch to Arc Testnet to continue"}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Composing: textarea + submit ───────────────────────────────────────────
  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-[11px] font-mono transition-colors"
              style={{ color: "var(--text-3)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-3)"; }}
            >
              ←
            </button>
          )}
          <span className="label">{selectedTaskType ? TASK_LABELS[selectedTaskType] : "Task"}</span>
        </div>
        {pricing && (
          <span className="text-[13px] font-mono font-semibold" style={{ color: "var(--amber)" }}>
            ${pricing.price_usdc.toFixed(2)} USDC
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4 gap-3">
        <textarea
          value={task}
          onChange={e => setTask(e.target.value)}
          placeholder={selectedTaskType ? TASK_PLACEHOLDERS[selectedTaskType] : "Describe your task..."}
          className="flex-1 border px-3 py-2.5 text-[13px] font-mono resize-none focus:outline-none transition-colors"
          style={{ background: "var(--surf-2)", borderColor: "var(--wire)", color: "var(--text-1)", minHeight: "120px" }}
          onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--amber)"; }}
          onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--wire)"; }}
          maxLength={2000}
          autoFocus
        />

        {task.length > 1800 && (
          <div className="text-[10px] font-mono text-right -mt-2" style={{ color: "var(--amber)" }}>
            {task.length}/2000
          </div>
        )}

        {error && (
          <p className="text-[11px] font-mono" style={{ color: "var(--red)" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={!walletAddress || !isOnArcTestnet || !task.trim()}
          className="w-full border py-2.5 text-[12px] font-mono font-semibold transition-all disabled:opacity-30"
          style={{ background: "transparent", borderColor: "var(--amber)", color: "var(--amber)" }}
          onMouseEnter={e => {
            if (walletAddress && isOnArcTestnet) {
              (e.currentTarget as HTMLElement).style.background = "rgba(232,160,16,0.08)";
            }
          }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {pricing ? `Run task — $${pricing.price_usdc.toFixed(2)} USDC` : "Run task"}
        </button>
      </form>
    </div>
  );
}
