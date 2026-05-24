"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import AppNav          from "./AppNav";
import TaskSubmitForm  from "./TaskSubmitForm";
import TaskHistoryPanel from "./TaskHistoryPanel";
import TaskTracePanel  from "./TaskTracePanel";
import TaskResultView  from "./TaskResultView";
import { ARC_CHAIN_ID, ARC_CHAIN_HEX, ARC_EXPLORER_URL } from "@/lib/constants";
import { getMetaMaskProvider } from "@/lib/wallet-provider";
import type { Task, TraceEvent, SSEEvent, ReasoningDecision, TaskType } from "@/types";

type UIState = "idle" | "composing" | "loading" | "complete" | "terminal" | "error";

const WALLET_KEY = "solv001_wallet";
const CHAIN_KEY  = "solv001_chainId";

export default function Dashboard() {
  const [uiState,           setUiState]           = useState<UIState>("idle");
  const [selectedTaskType,  setSelectedTaskType]  = useState<TaskType | null>(null);
  const [tasks,             setTasks]             = useState<Task[]>([]);
  const [traceEvents,       setTraceEvents]       = useState<TraceEvent[]>([]);
  const [reasoning,         setReasoning]         = useState("");
  const [reasoningDecision, setReasoningDecision] = useState<ReasoningDecision | null>(null);
  const [activeResult,      setActiveResult]      = useState<string | null>(null);
  const [terminalData,      setTerminalData]      = useState<{ type: "deferred" | "rejected"; reason: string } | null>(null);
  const [submitError,       setSubmitError]       = useState("");
  const [walletAddress,     setWalletAddress]     = useState<`0x${string}` | null>(null);
  const [chainId,           setChainId]           = useState<number | null>(null);
  const [usdcBalance,       setUsdcBalance]       = useState<number | null>(null);
  const [viewingTask,       setViewingTask]       = useState<(Task & { trace: TraceEvent[] }) | null>(null);
  const [walletError,       setWalletError]       = useState("");

  const walletRef = useRef<`0x${string}` | null>(null);
  const tasksRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef  = useRef<AbortController | null>(null);

  walletRef.current = walletAddress;

  const isOnArcTestnet = chainId === ARC_CHAIN_ID;

  async function fetchUSDCBalance(address: string): Promise<void> {
    try {
      const res = await fetch(`/api/balance?address=${address}`);
      if (!res.ok) { setUsdcBalance(null); return; }
      const { usdc } = await res.json() as { usdc: number };
      setUsdcBalance(usdc);
    } catch { setUsdcBalance(null); }
  }

  useEffect(() => {
    const eth = getMetaMaskProvider();
    if (!eth) return;

    const savedWallet = localStorage.getItem(WALLET_KEY) as `0x${string}` | null;
    const savedChain  = localStorage.getItem(CHAIN_KEY);

    if (savedWallet) {
      eth.request({ method: "eth_accounts" })
        .then((accounts) => {
          const list = accounts as string[];
          if (list.length > 0 && list[0].toLowerCase() === savedWallet.toLowerCase()) {
            const addr  = list[0] as `0x${string}`;
            const chain = savedChain ? parseInt(savedChain, 10) : null;
            setWalletAddress(addr);
            setChainId(chain);
            if (chain === ARC_CHAIN_ID) fetchUSDCBalance(addr);
          }
        })
        .catch(() => {});
    }

    const onAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      if (list.length === 0) {
        setWalletAddress(null);
        setChainId(null);
        setUsdcBalance(null);
        localStorage.removeItem(WALLET_KEY);
        localStorage.removeItem(CHAIN_KEY);
      } else {
        const addr = list[0] as `0x${string}`;
        setWalletAddress(addr);
        localStorage.setItem(WALLET_KEY, addr);
      }
    };

    const onChainChanged = (hexChain: unknown) => {
      const parsed = parseInt(hexChain as string, 16);
      setChainId(parsed);
      localStorage.setItem(CHAIN_KEY, String(parsed));
      if (parsed === ARC_CHAIN_ID && walletRef.current) fetchUSDCBalance(walletRef.current);
    };

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged",    onChainChanged);
    return () => {
      eth.removeListener("accountsChanged", onAccountsChanged);
      eth.removeListener("chainChanged",    onChainChanged);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTasks = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) return;
    try {
      const res = await fetch(`/api/tasks?wallet=${wallet}`);
      if (!res.ok) return;
      setTasks(await res.json() as Task[]);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    tasksRef.current = setInterval(fetchTasks, 5_000);
    return () => {
      if (tasksRef.current) clearInterval(tasksRef.current);
      abortRef.current?.abort();
    };
  }, [fetchTasks]);

  useEffect(() => {
    if (walletAddress) {
      fetchTasks();
    } else {
      setTasks([]);
    }
  }, [walletAddress, fetchTasks]);

  const connectWallet = useCallback(async () => {
    const eth = getMetaMaskProvider();
    if (!eth) { setWalletError("No wallet detected. Install MetaMask or Rabby."); return; }
    setWalletError("");
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" }) as string[];
      const addr     = accounts[0] as `0x${string}`;
      const hexChain = await eth.request({ method: "eth_chainId" }) as string;
      const chain    = parseInt(hexChain, 16);
      setWalletAddress(addr);
      setChainId(chain);
      localStorage.setItem(WALLET_KEY, addr);
      localStorage.setItem(CHAIN_KEY,  String(chain));
      if (chain === ARC_CHAIN_ID) await fetchUSDCBalance(addr);
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Wallet connection failed");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Always calls wallet_addEthereumChain so MetaMask updates to the working RPC
  // (the public https://rpc.arcnetwork.xyz endpoint is rate-limited and unreliable).
  const addArcNetwork = useCallback(async () => {
    const eth     = getMetaMaskProvider();
    const rpcUrl  = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.arcnetwork.xyz";
    if (!eth) return;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId:           ARC_CHAIN_HEX,
        chainName:         "Arc Testnet",
        nativeCurrency:    { name: "Arc", symbol: "ARC", decimals: 18 },
        rpcUrls:           [rpcUrl],
        blockExplorerUrls: ["https://explorer.arcnetwork.xyz"],
      }],
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchToArcTestnet = useCallback(async () => {
    const eth = getMetaMaskProvider();
    if (!eth) return;
    setWalletError("");
    try {
      // Always add/update Arc Testnet config first (fixes broken public RPC in MetaMask)
      await addArcNetwork();
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_HEX }] });
      setChainId(ARC_CHAIN_ID);
      localStorage.setItem(CHAIN_KEY, String(ARC_CHAIN_ID));
      if (walletRef.current) await fetchUSDCBalance(walletRef.current);
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      // 4001 = user rejected — silent. Anything else = show error.
      if (code !== 4001) {
        setWalletError(err instanceof Error ? err.message : "Failed to switch to Arc Testnet");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addArcNetwork]);

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
    setChainId(null);
    setUsdcBalance(null);
    setTasks([]);
    setWalletError("");
    localStorage.removeItem(WALLET_KEY);
    localStorage.removeItem(CHAIN_KEY);
  }, []);

  const handleNewTask = useCallback(() => {
    abortRef.current?.abort();
    setUiState("idle");
    setSelectedTaskType(null);
    setTraceEvents([]);
    setReasoning("");
    setReasoningDecision(null);
    setActiveResult(null);
    setTerminalData(null);
    setSubmitError("");
    setViewingTask(null);
  }, []);

  const handleTaskTypeSelect = useCallback((type: TaskType) => {
    setSelectedTaskType(type);
    setUiState("composing");
  }, []);

  const handleTaskSubmit = useCallback(async (payload: Record<string, unknown>) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setUiState("loading");
    setTraceEvents([]);
    setReasoning("");
    setReasoningDecision(null);
    setActiveResult(null);
    setTerminalData(null);
    setSubmitError("");

    let res: Response;
    try {
      res = await fetch("/api/tasks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
        signal:  controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") {
        setSubmitError("Network error — could not reach the agent.");
        setUiState("error");
      }
      return;
    }

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setSubmitError(body.error ?? `Server error ${res.status}`);
      setUiState("error");
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          for (const line of block.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as SSEEvent;
              if (event.type === "reasoning_chunk")    setReasoning(prev => prev + event.data);
              if (event.type === "reasoning_complete") setReasoningDecision(event.data);
              if (event.type === "trace")              setTraceEvents(prev => [...prev, event.data]);
              if (event.type === "complete") {
                setActiveResult(event.data.result);
                setUiState("complete");
                fetchTasks();
              }
              if (event.type === "deferred") {
                setTerminalData({ type: "deferred", reason: event.data.reason });
                setUiState("terminal");
                fetchTasks();
              }
              if (event.type === "rejected") {
                setTerminalData({ type: "rejected", reason: event.data.reason });
                setUiState("terminal");
                fetchTasks();
              }
              if (event.type === "error") {
                const raw = event.data as string;
                const msg = raw.includes("insufficient_balance")
                  ? "Insufficient USDC balance on Arc testnet. Get testnet USDC at faucet.circle.com then retry."
                  : raw;
                setSubmitError(msg);
                setUiState("error");
              }
            } catch { /* malformed JSON */ }
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") {
        setSubmitError("Stream interrupted unexpectedly.");
        setUiState("error");
      }
    }
  }, [fetchTasks]);

  const viewTask = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`);
      if (!res.ok) return;
      setViewingTask(await res.json() as Task & { trace: TraceEvent[] });
    } catch { /* silent */ }
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
      <AppNav
        walletAddress={walletAddress}
        usdcBalance={usdcBalance}
        isOnArcTestnet={isOnArcTestnet}
        onConnect={connectWallet}
        onSwitchChain={switchToArcTestnet}
        onDisconnect={disconnectWallet}
      />

      {walletError && (
        <div
          className="px-5 py-2 text-[12px] border-b shrink-0"
          style={{ color: "var(--red)", borderColor: "var(--wire)", background: "rgba(232,64,76,0.05)" }}
        >
          {walletError}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* ── Main task area ───────────────────────────────────── */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col p-5 gap-4 overflow-y-auto">
          {viewingTask ? (
            <ViewingOverlay task={viewingTask} onClose={() => setViewingTask(null)} />
          ) : (uiState === "idle" || uiState === "composing") ? (
            <TaskSubmitForm
              walletAddress={walletAddress}
              isOnArcTestnet={isOnArcTestnet}
              usdcBalance={usdcBalance}
              uiState={uiState}
              selectedTaskType={selectedTaskType}
              onTaskTypeSelect={handleTaskTypeSelect}
              onSubmit={handleTaskSubmit}
              onBack={uiState === "composing" ? handleNewTask : undefined}
            />
          ) : uiState === "loading" ? (
            <TaskTracePanel
              traceEvents={traceEvents}
              reasoning={reasoning}
              reasoningDecision={reasoningDecision}
              isActive={true}
            />
          ) : uiState === "complete" ? (
            <div className="panel flex-1 flex flex-col">
              <div className="panel-header">
                <span className="label">Result</span>
                <NewTaskBtn onClick={handleNewTask} />
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <TaskResultView result={activeResult} reasoning={null} task_type={selectedTaskType} />
              </div>
            </div>
          ) : uiState === "terminal" ? (
            <div className="panel flex-1 flex flex-col">
              <div className="panel-header">
                <span
                  className="label"
                  style={{ color: terminalData?.type === "rejected" ? "var(--red)" : "var(--amber)" }}
                >
                  {terminalData?.type === "rejected" ? "Task Rejected" : "Task Deferred"}
                </span>
                <NewTaskBtn onClick={handleNewTask} label="New Task" />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div
                  className="w-full max-w-lg p-6 border text-[13px] leading-relaxed"
                  style={{
                    borderColor: terminalData?.type === "rejected" ? "rgba(232,64,76,0.3)" : "rgba(232,160,16,0.3)",
                    background:  terminalData?.type === "rejected" ? "rgba(232,64,76,0.04)" : "rgba(232,160,16,0.04)",
                    color:       "var(--text-1)",
                  }}
                >
                  {terminalData?.reason}
                </div>
              </div>
            </div>
          ) : (
            <div className="panel flex-1 flex flex-col">
              <div className="panel-header">
                <span className="label" style={{ color: "var(--red)" }}>Error</span>
                <NewTaskBtn onClick={handleNewTask} label="Try Again" />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div
                  className="w-full max-w-lg p-6 border text-[13px] font-mono"
                  style={{ borderColor: "rgba(232,64,76,0.3)", background: "rgba(232,64,76,0.04)", color: "var(--red)" }}
                >
                  {submitError || "An unexpected error occurred."}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── History sidebar (right) ───────────────────────────── */}
        <aside
          className="w-72 shrink-0 border-l flex flex-col overflow-hidden"
          style={{ borderColor: "var(--wire)" }}
        >
          <TaskHistoryPanel
            tasks={tasks}
            walletAddress={walletAddress}
            onTaskClick={viewTask}
          />
        </aside>

      </div>
    </div>
  );
}

// ─── Shared "new task" button ─────────────────────────────────────────────────

function NewTaskBtn({ onClick, label = "New Task" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="btn-wire text-[12px] font-medium px-3 py-1.5"
    >
      {label}
    </button>
  );
}

// ─── Viewing overlay: historical task result + trace ─────────────────────────

function ViewingOverlay({
  task,
  onClose,
}: {
  task: Task & { trace: TraceEvent[] };
  onClose: () => void;
}) {
  return (
    <div className="panel flex-1 flex flex-col">
      <div className="panel-header">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="label">Task Result</span>
          <span
            className="text-[11px] font-mono line-clamp-1"
            style={{ color: "var(--text-3)" }}
          >
            {task.task}
          </span>
        </div>
        <button
          onClick={onClose}
          className="btn-wire text-[12px] font-medium px-3 py-1.5 shrink-0"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <TaskResultView result={task.result} reasoning={task.reasoning} task_type={task.task_type} />

        {task.trace.length > 0 && (
          <div className="px-4 pt-2 pb-4 border-t" style={{ borderColor: "var(--wire)" }}>
            <div className="label mb-3">Execution Trace</div>
            <div className="flex flex-col gap-1.5">
              {task.trace.map((event, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                  <span className="shrink-0" style={{ color: "var(--text-3)" }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ color: "var(--text-2)" }}>{event.description}</span>
                  {event.arc_tx_hash && (
                    <a
                      href={`${ARC_EXPLORER_URL}/tx/${event.arc_tx_hash}`}
                      target="_blank" rel="noopener noreferrer"
                      className="ml-auto shrink-0 text-[10px] transition-opacity hover:opacity-70"
                      style={{ color: "var(--blue)" }}
                    >
                      ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
