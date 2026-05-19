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
  const [taskType, setTaskType] = useState<TaskType>("wallet_intelligence");
  const [estimate, setEstimate] = useState<{ price_usdc: number; estimated_margin: number } | null>(null);
  const [demoMode, setDemoMode] = useState(true);  // Default true for judges without wallets
  const [error,    setError]    = useState("");

  const pricing = TASK_PRICING[taskType];

  const fetchEstimate = async () => {
    const res  = await fetch(`/api/tasks/estimate?task_type=${taskType}`);
    const data = await res.json();
    setEstimate(data);
  };

  // Build EIP-3009 payment authorization via MetaMask
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
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">Submit Task</h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={task}
          onChange={e => setTask(e.target.value)}
          placeholder="Vet wallet 0xABCD — should I send them 500 USDC?"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500"
          rows={3}
          disabled={isSubmitting}
        />

        <div className="flex gap-2">
          <select
            value={taskType}
            onChange={e => setTaskType(e.target.value as TaskType)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
            disabled={isSubmitting}
          >
            {(Object.keys(TASK_PRICING) as TaskType[]).map(t => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchEstimate}
            className="text-xs text-blue-400 hover:text-blue-300 px-2 border border-gray-700 rounded"
            disabled={isSubmitting}
          >
            Estimate
          </button>
        </div>

        {estimate && (
          <div className="text-xs text-gray-400 bg-gray-800 rounded p-2">
            Fee: <span className="text-green-400">${estimate.price_usdc} USDC</span>
            {" "}· Margin: <span className="text-yellow-400">{estimate.estimated_margin}%</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            id="demoMode"
            checked={demoMode}
            onChange={e => setDemoMode(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="demoMode" className="text-gray-400">
            Demo mode (no payment required)
          </label>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs font-medium py-2 rounded transition-colors"
        >
          {isSubmitting ? "Executing..." : `Submit Task${!demoMode ? ` — $${pricing.price_usdc} USDC` : ""}`}
        </button>
      </form>
    </div>
  );
}
