"use client";

import { useState } from "react";
import { createWalletClient, custom, parseUnits } from "viem";
import { Brain, Shield, FileText, Coins, Clock, Eye, BarChart2, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ARC_CHAIN_ID, TASK_LABELS } from "@/lib/constants";
import { TASK_PRICING } from "@/types";
import type { TaskType, EIP3009Auth } from "@/types";

const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const;

interface Props {
  walletAddress:    `0x${string}` | null;
  isOnArcTestnet:   boolean;
  usdcBalance:      number | null;
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

const TASK_ICONS: Record<TaskType, LucideIcon> = {
  wallet_intelligence:    Brain,
  counterparty_vet:       Shield,
  contract_summary:       FileText,
  conditional_payment:    Coins,
  scheduled_disbursement: Clock,
  wallet_watch:           Eye,
  contract_watch:         BarChart2,
  general:                Lightbulb,
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
  usdcBalance,
  uiState,
  selectedTaskType,
  onTaskTypeSelect,
  onSubmit,
  onBack,
}: Props) {
  const [task,    setTask]    = useState("");
  const [error,   setError]   = useState("");
  const [focused, setFocused] = useState(false);

  const pricing = selectedTaskType ? TASK_PRICING[selectedTaskType] : null;
  const hasEnoughUsdc = pricing === null || usdcBalance === null || usdcBalance >= pricing.price_usdc;

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

    const price = TASK_PRICING[selectedTaskType].price_usdc;
    if (usdcBalance !== null && usdcBalance < price) {
      setError(
        `Insufficient USDC balance. This task costs $${price.toFixed(2)} but your balance is $${usdcBalance.toFixed(2)}. Get testnet USDC at faucet.circle.com`,
      );
      return;
    }

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
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-8 py-10">

        {/* Context */}
        <div className="text-center">
          <div
            className="text-[10px] font-mono tracking-widest mb-3"
            style={{ color: "var(--amber-dim)" }}
          >
            SOLV-001 · Arc Testnet
          </div>
          <p className="text-[13px] max-w-xs" style={{ color: "var(--text-2)" }}>
            {!walletAddress
              ? "Connect your wallet using the button above to get started."
              : !isOnArcTestnet
              ? "Switch to Arc Testnet to submit tasks."
              : usdcBalance === 0
              ? <>
                  No USDC balance.{" "}
                  <a
                    href="https://faucet.circle.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--blue)" }}
                    className="underline underline-offset-2"
                  >
                    Get testnet USDC →
                  </a>
                </>
              : "Select a task type. Pay per task, no subscription."}
          </p>
        </div>

        {/* Task grid — centered, max-width contained, 2-col on mobile */}
        <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(TASK_PRICING) as TaskType[]).map((type) => {
            const accent = TASK_ACCENT[type];
            const Icon   = TASK_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => { if (canSubmit) onTaskTypeSelect(type); }}
                disabled={!canSubmit}
                className="border p-4 text-left flex flex-col gap-2 card-interactive rounded disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  borderColor: "var(--wire)",
                  borderLeft:  `3px solid ${accent}`,
                  minHeight:   "100px",
                  borderRadius: "4px",
                }}
              >
                <div className="flex items-start justify-between gap-1">
                  <Icon size={14} style={{ color: accent, flexShrink: 0, marginTop: 1 }} aria-hidden />
                  <span
                    className="text-[12px] font-mono font-semibold shrink-0"
                    style={{ color: "var(--amber)" }}
                  >
                    ${TASK_PRICING[type].price_usdc.toFixed(2)}
                  </span>
                </div>
                <span className="text-[13px] font-medium leading-snug" style={{ color: "var(--text-1)" }}>
                  {TASK_LABELS[type]}
                </span>
                <span className="text-[12px] leading-snug mt-auto" style={{ color: "var(--text-2)" }}>
                  {TASK_DESCRIPTIONS[type]}
                </span>
              </button>
            );
          })}
        </div>

      </div>
    );
  }

  // ── Composing: Claude.ai-style input ─────────────────────────────────────
  const accent = selectedTaskType ? TASK_ACCENT[selectedTaskType] : "var(--amber)";

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl flex flex-col gap-4">

        {/* Back + task type header */}
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn-ghost text-[12px] px-2 py-1 rounded"
              style={{ borderRadius: "4px" }}
            >
              ← Back
            </button>
          )}
          <span className="text-[14px] font-semibold" style={{ color: "var(--text-1)" }}>
            {selectedTaskType ? TASK_LABELS[selectedTaskType] : "New Task"}
          </span>
          {pricing && (
            <span className="ml-auto font-mono text-[14px] font-semibold" style={{ color: "var(--amber)" }}>
              ${pricing.price_usdc.toFixed(2)} USDC
            </span>
          )}
        </div>

        {/* Claude.ai-style input box */}
        <div
          className="relative border-2 transition-all"
          style={{
            borderRadius:  "8px",
            borderColor:   focused ? accent : "var(--wire)",
            background:    "var(--surf-2)",
            boxShadow:     focused ? "var(--shadow-amber)" : "none",
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col">
            <textarea
              value={task}
              onChange={e => setTask(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={selectedTaskType ? TASK_PLACEHOLDERS[selectedTaskType] : "Describe your task..."}
              className="w-full bg-transparent px-5 pt-4 pb-2 text-[14px] resize-none focus:outline-none leading-relaxed"
              style={{
                color:     "var(--text-1)",
                minHeight: "140px",
              }}
              maxLength={2000}
              autoFocus
            />

            {/* Footer row inside input box */}
            <div
              className="flex items-center justify-between px-5 pb-3 pt-2 border-t"
              style={{ borderColor: "var(--wire)" }}
            >
              <span className="text-[11px] font-mono" style={{ color: "var(--text-3)" }}>
                claude-sonnet-4-6 · Arc Testnet
              </span>
              <div className="flex items-center gap-3">
                {task.length > 1000 && (
                  <span
                    className="text-[11px] font-mono tabular-nums"
                    style={{ color: task.length > 1800 ? "var(--red)" : "var(--text-3)" }}
                  >
                    {task.length}/2000
                  </span>
                )}
                <button
                  type="submit"
                  disabled={!walletAddress || !isOnArcTestnet || !task.trim() || !hasEnoughUsdc}
                  className="btn-amber px-4 py-1.5 text-[13px] font-medium"
                  style={{ borderRadius: "6px" }}
                >
                  {pricing
                    ? `Run · $${pricing.price_usdc.toFixed(2)}`
                    : "Run task →"}
                </button>
              </div>
            </div>
          </form>
        </div>

        {error && (
          <p className="text-[12px]" style={{ color: "var(--red)" }}>{error}</p>
        )}
      </div>
    </div>
  );
}
