"use client";

import { useState } from "react";
import { createWalletClient, custom, parseUnits } from "viem";
import { TASK_PRICING } from "@/types";
import type { TaskType, EIP3009Auth } from "@/types";

interface Props {
  onSubmit:    (payload: Record<string, unknown>) => void;
  isSubmitting: boolean;
}

export default function TaskSubmitForm({ onSubmit, isSubmitting }: Props) {
  const [task,     setTask]     = useState("");
  const [taskType, setTaskType] = useState<TaskType>("contract_summary");
  const [estimate, setEstimate] = useState<{ price_usdc: number; estimated_margin: number } | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [error,    setError]    = useState("");

  const pricing = TASK_PRICING[taskType];

  const fetchEstimate = async () => {
    const res  = await fetch(`/api/tasks/estimate?task_type=${taskType}`);
    const data = await res.json();
    setEstimate(data);
  };

  async function buildPaymentAuth(): Promise<EIP3009Auth | null> {
    if (typeof window === "undefined" || !(window as Window & { ethereum?: unknown }).ethereum) return null;

    const walletClient = createWalletClient({
      transport: custom((window as unknown as { ethereum: Parameters<typeof custom>[0] }).ethereum),
    });

    const [account] = await walletClient.requestAddresses();
    const sellerAddress = process.env.NEXT_PUBLIC_SELLER_EOA_ADDRESS as `0x${string}`;
    const price         = parseUnits(pricing.price_usdc.toFixed(6), 6);
    const now           = BigInt(Math.floor(Date.now() / 1000));
    const validAfter    = now - 60n;
    const validBefore   = now + 3600n;
    const nonce         = `0x${crypto.getRandomValues(new Uint8Array(32)).reduce((acc, b) => acc + b.toString(16).padStart(2, "0"), "")}` as `0x${string}`;

    const signature = await walletClient.signTypedData({
      account,
      domain: {
        name:              "USD Coin",
        version:           "2",
        chainId:           26,
        verifyingContract: process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS as `0x${string}`,
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
      message: {
        from:        account,
        to:          sellerAddress,
        value:       price,
        validAfter,
        validBefore,
        nonce,
      },
    });

    return {
      from:        account,
      to:          sellerAddress,
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
    if (!task.trim()) { setError("Task description required"); return; }

    if (demoMode) {
      onSubmit({ task, task_type: taskType, payer_wallet: "0xDEMO0000000000000000000000000000000000001", demo_mode: true });
      setTask("");
      return;
    }

    try {
      const auth = await buildPaymentAuth();
      if (!auth) { setError("MetaMask not detected. Enable demo mode to test without a wallet."); return; }

      onSubmit({
        task,
        task_type: taskType,
        payer_wallet:           auth.from,
        payment_authorization:  auth,
        demo_mode:              false,
      });
      setTask("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment signing failed");
    }
  };

  return (
    <div className="bg-[#0D1016] border border-[#18202E] rounded-sm p-4">
      <div className="text-[10px] uppercase tracking-widest text-[#60788A] mb-3">Submit Task</div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={task}
          onChange={e => setTask(e.target.value)}
          placeholder="e.g., Summarize the USYC teller contract at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A"
          className="w-full bg-[#111620] border border-[#18202E] rounded-sm px-3 py-2.5 text-[12px] font-mono text-[#D6E0EC] placeholder-[#283040] resize-none focus:outline-none focus:border-[#00C8FF]/40 transition-colors"
          rows={3}
          disabled={isSubmitting}
        />

        <div className="flex gap-2 items-center">
          <select
            value={taskType}
            onChange={e => setTaskType(e.target.value as TaskType)}
            className="flex-1 bg-[#111620] border border-[#18202E] rounded-sm px-2.5 py-1.5 text-[11px] text-[#60788A] font-mono focus:outline-none focus:border-[#00C8FF]/40 appearance-none transition-colors"
            disabled={isSubmitting}
          >
            {(Object.keys(TASK_PRICING) as TaskType[]).map(t => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchEstimate}
            className="text-[11px] font-mono text-[#60788A] hover:text-[#D6E0EC] px-3 py-1.5 border border-[#18202E] hover:border-[#283040] rounded-sm transition-colors"
            disabled={isSubmitting}
          >
            est.
          </button>
        </div>

        {estimate && (
          <div className="text-[11px] font-mono text-[#60788A] flex items-center gap-3 px-0.5">
            <span>fee <span className="text-[#16C97A]">${estimate.price_usdc}</span></span>
            <span className="text-[#18202E]">·</span>
            <span>margin <span className="text-[#E09820]">{estimate.estimated_margin}%</span></span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="demoMode"
            checked={demoMode}
            onChange={e => setDemoMode(e.target.checked)}
            className="w-3 h-3 rounded-sm accent-[#00C8FF]"
          />
          <label htmlFor="demoMode" className="text-[11px] text-[#60788A] cursor-pointer select-none">
            Try without wallet (demo mode)
          </label>
        </div>

        {error && <p className="text-[11px] text-[#F04858] font-mono">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#111620] hover:bg-[#141C28] disabled:opacity-40 border border-[#18202E] hover:border-[#00C8FF]/30 text-[#00C8FF] text-[12px] font-mono py-2 rounded-sm transition-all"
        >
          {isSubmitting
            ? "executing..."
            : `run task${!demoMode ? ` — $${pricing.price_usdc} USDC` : ""}`}
        </button>
      </form>
    </div>
  );
}
