"use client";

import { useState, useCallback } from "react";
import { createWalletClient, custom, parseUnits } from "viem";
import { TASK_PRICING } from "@/types";
import type { TaskType, EIP3009Auth } from "@/types";

const ARC_CHAIN_ID     = 26;
const ARC_CHAIN_ID_HEX = "0x1a";

interface Props {
  onSubmit:    (payload: Record<string, unknown>) => void;
  isSubmitting: boolean;
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
  counterparty_vet:       "Risk assessment before transacting",
  contract_summary:       "Plain-English contract audit",
  conditional_payment:    "Trigger payment on-chain condition",
  scheduled_disbursement: "Time-based payment execution",
  wallet_watch:           "Alert when wallet activity detected",
  contract_watch:         "Monitor contract events continuously",
  general:                "Open-ended financial reasoning task",
};

export default function TaskSubmitForm({ onSubmit, isSubmitting }: Props) {
  const [task,          setTask]          = useState("");
  const [taskType,      setTaskType]      = useState<TaskType>("contract_summary");
  const [estimate,      setEstimate]      = useState<{ price_usdc: number; estimated_margin: number } | null>(null);
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | null>(null);
  const [chainId,       setChainId]       = useState<number | null>(null);
  const [usdcBalance,   setUsdcBalance]   = useState<number | null>(null);
  const [error,         setError]         = useState("");
  const [estimating,    setEstimating]    = useState(false);

  const pricing        = TASK_PRICING[taskType];
  const isOnArcTestnet = chainId === ARC_CHAIN_ID;
  const hasEnoughFunds = usdcBalance === null || usdcBalance >= pricing.price_usdc;

  const fetchEstimate = async () => {
    setEstimating(true);
    try {
      const res  = await fetch(`/api/tasks/estimate?task_type=${taskType}`);
      const data = await res.json();
      setEstimate(data);
    } catch { /* silent */ }
    setEstimating(false);
  };

  async function fetchUSDCBalance(address: string): Promise<void> {
    const eth          = getEth();
    const usdcContract = process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS;
    if (!eth || !usdcContract) return;
    const calldata = "0x70a08231" + "000000000000000000000000" + address.slice(2).toLowerCase();
    try {
      const result = await eth.request({
        method: "eth_call",
        params: [{ to: usdcContract, data: calldata }, "latest"],
      });
      setUsdcBalance(Number(BigInt(result as string)) / 1e6);
    } catch {
      setUsdcBalance(null);
    }
  }

  const connectWallet = useCallback(async () => {
    const eth = getEth();
    if (!eth) { setError("No wallet detected. Install MetaMask or Rabby."); return; }
    setError("");
    try {
      const accounts    = await eth.request({ method: "eth_requestAccounts" }) as string[];
      setWalletAddress(accounts[0] as `0x${string}`);
      const chain       = await eth.request({ method: "eth_chainId" }) as string;
      const parsedChain = parseInt(chain, 16);
      setChainId(parsedChain);
      if (parsedChain === ARC_CHAIN_ID) {
        await fetchUSDCBalance(accounts[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchToArcTestnet = useCallback(async () => {
    const eth = getEth();
    if (!eth) return;
    setError("");
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_ID_HEX }],
      });
      setChainId(ARC_CHAIN_ID);
      if (walletAddress) await fetchUSDCBalance(walletAddress);
    } catch {
      try {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId:           ARC_CHAIN_ID_HEX,
            chainName:         "Arc Testnet",
            nativeCurrency:    { name: "USD Coin", symbol: "USDC", decimals: 6 },
            rpcUrls:           ["https://rpc.arcnetwork.xyz"],
            blockExplorerUrls: ["https://explorer.arcnetwork.xyz"],
          }],
        });
        setChainId(ARC_CHAIN_ID);
        if (walletAddress) await fetchUSDCBalance(walletAddress);
      } catch (addErr) {
        setError(addErr instanceof Error ? addErr.message : "Failed to add Arc Testnet");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  async function buildPaymentAuth(): Promise<EIP3009Auth> {
    const walletClient = createWalletClient({
      transport: custom(getEth()! as Parameters<typeof custom>[0]),
    });

    const [account]    = await walletClient.requestAddresses();
    const agentWallet  = process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS as `0x${string}`;
    const usdcContract = process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS as `0x${string}`;
    const price        = parseUnits(pricing.price_usdc.toFixed(6), 6);
    const now          = BigInt(Math.floor(Date.now() / 1000));
    const validAfter   = now - 60n;
    const validBefore  = now + 3600n;
    const nonce        = `0x${crypto.getRandomValues(new Uint8Array(32)).reduce(
      (acc, b) => acc + b.toString(16).padStart(2, "0"), ""
    )}` as `0x${string}`;

    const signature = await walletClient.signTypedData({
      account,
      domain: {
        name:              "USD Coin",
        version:           "2",
        chainId:           ARC_CHAIN_ID,
        verifyingContract: usdcContract,
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
        to:          agentWallet,
        value:       price,
        validAfter,
        validBefore,
        nonce,
      },
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
    if (!task.trim()) { setError("Task description is required"); return; }
    if (task.length > 2000) { setError("Task must be 2000 characters or fewer"); return; }
    if (!walletAddress) { setError("Connect your wallet first"); return; }
    if (!isOnArcTestnet) { setError("Switch to Arc Testnet first"); return; }

    try {
      const auth = await buildPaymentAuth();
      onSubmit({
        task,
        task_type:             taskType,
        payer_wallet:          auth.from,
        payment_authorization: auth,
      });
      setTask("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment signing failed");
    }
  };

  return (
    <div className="panel p-4 flex flex-col gap-3">
      <div className="label">Submit Task</div>

      {/* Wallet status */}
      {!walletAddress ? (
        <button
          type="button"
          onClick={connectWallet}
          className="w-full border py-2 text-[12px] font-mono transition-all"
          style={{
            background:  "transparent",
            borderColor: "var(--amber)",
            color:       "var(--amber)",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,160,16,0.08)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          Connect Wallet
        </button>
      ) : !isOnArcTestnet ? (
        <button
          type="button"
          onClick={switchToArcTestnet}
          className="w-full border py-2 text-[12px] font-mono transition-all"
          style={{
            background:  "transparent",
            borderColor: "var(--amber)",
            color:       "var(--amber)",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,160,16,0.08)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          Switch to Arc Testnet
        </button>
      ) : (
        <div
          className="px-2 py-1.5 border flex items-center gap-2"
          style={{
            background:  "rgba(0,200,128,0.04)",
            borderColor: "rgba(0,200,128,0.2)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: "var(--green)" }}
          />
          <span className="text-[10px] font-mono truncate" style={{ color: "var(--text-2)" }}>
            {walletAddress}
          </span>
          {usdcBalance !== null && (
            <span
              className="ml-auto text-[10px] font-mono shrink-0"
              style={{ color: hasEnoughFunds ? "var(--green)" : "var(--red)" }}
            >
              ${usdcBalance.toFixed(2)}
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Task type selector */}
        <div>
          <select
            value={taskType}
            onChange={e => {
              setTaskType(e.target.value as TaskType);
              setEstimate(null);
            }}
            className="w-full border py-2 px-2.5 text-[11px] font-mono appearance-none transition-colors focus:outline-none"
            style={{
              background:  "var(--surf-2)",
              borderColor: "var(--wire)",
              color:       "var(--text-1)",
            }}
            disabled={isSubmitting}
          >
            {(Object.keys(TASK_PRICING) as TaskType[]).map(t => (
              <option key={t} value={t} style={{ background: "var(--surf-2)" }}>
                {TASK_LABELS[t]} — ${TASK_PRICING[t].price_usdc.toFixed(2)} USDC
              </option>
            ))}
          </select>
          <div className="mt-1 text-[10px] font-mono" style={{ color: "var(--text-3)" }}>
            {TASK_DESCRIPTIONS[taskType]}
          </div>
        </div>

        {/* Price badge */}
        <div
          className="flex items-center justify-between px-3 py-2 border"
          style={{ borderColor: "var(--wire-2)", background: "var(--surf-2)" }}
        >
          <span className="text-[11px] font-mono" style={{ color: "var(--text-2)" }}>
            Task fee
          </span>
          <span className="text-[14px] font-mono font-semibold" style={{ color: "var(--amber)" }}>
            ${pricing.price_usdc.toFixed(2)} USDC
          </span>
        </div>

        {/* Task textarea */}
        <textarea
          value={task}
          onChange={e => setTask(e.target.value)}
          placeholder={`e.g., Summarize the USYC teller contract at 0x9fdF14c5B14173D74C08Af27AebFf39240dC105A`}
          className="w-full border px-3 py-2.5 text-[12px] font-mono resize-none focus:outline-none transition-colors"
          style={{
            background:  "var(--surf-2)",
            borderColor: "var(--wire)",
            color:       "var(--text-1)",
          }}
          onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--amber)"; }}
          onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--wire)"; }}
          rows={3}
          disabled={isSubmitting}
          maxLength={2000}
        />

        {/* Char count */}
        {task.length > 0 && (
          <div
            className="text-[10px] font-mono text-right -mt-2"
            style={{ color: task.length > 1800 ? "var(--amber)" : "var(--text-3)" }}
          >
            {task.length}/2000
          </div>
        )}

        {/* Estimate */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchEstimate}
            disabled={isSubmitting || estimating}
            className="text-[11px] font-mono px-3 py-1.5 border transition-colors disabled:opacity-40"
            style={{ borderColor: "var(--wire)", color: "var(--text-2)" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--wire-2)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-1)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--wire)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-2)";
            }}
          >
            {estimating ? "fetching..." : "Get estimate"}
          </button>

          {estimate && (
            <div className="flex items-center gap-3 text-[11px] font-mono" style={{ color: "var(--text-2)" }}>
              <span>
                Agent margin{" "}
                <span style={{ color: "var(--green)" }}>{estimate.estimated_margin}%</span>
              </span>
            </div>
          )}
        </div>

        {error && (
          <p className="text-[11px] font-mono" style={{ color: "var(--red)" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !walletAddress || !isOnArcTestnet}
          className="w-full border py-2.5 text-[12px] font-mono font-semibold transition-all disabled:opacity-30"
          style={{
            background:  "transparent",
            borderColor: isSubmitting ? "var(--wire)" : "var(--amber)",
            color:       isSubmitting ? "var(--text-3)" : "var(--amber)",
          }}
          onMouseEnter={e => {
            if (!isSubmitting && walletAddress && isOnArcTestnet) {
              (e.currentTarget as HTMLElement).style.background = "rgba(232,160,16,0.08)";
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="w-1 h-1 rounded-full"
                style={{ background: "var(--amber)", animation: "pulseDot 0.8s ease-in-out infinite" }}
              />
              Executing task...
            </span>
          ) : (
            `Run task — $${pricing.price_usdc.toFixed(2)} USDC`
          )}
        </button>
      </form>
    </div>
  );
}
