"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import TaskSubmitForm   from "./TaskSubmitForm";
import TaskHistoryPanel from "./TaskHistoryPanel";
import TaskTracePanel   from "./TaskTracePanel";
import TaskResultView   from "./TaskResultView";
import type { Task, TraceEvent, SSEEvent, ReasoningDecision, TaskType } from "@/types";

type UIState = "idle" | "composing" | "loading" | "complete" | "terminal" | "error";

type EthProvider = {
  request:        (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on:             (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
};

function getEth(): EthProvider | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: EthProvider }).ethereum ?? null;
}

const WALLET_KEY   = "solv001_wallet";
const CHAIN_KEY    = "solv001_chainId";
const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_HEX = "0x4cef52";

export default function Dashboard() {
  const [uiState,            setUiState]            = useState<UIState>("idle");
  const [selectedTaskType,   setSelectedTaskType]   = useState<TaskType | null>(null);
  const [tasks,              setTasks]              = useState<Task[]>([]);
  const [traceEvents,        setTraceEvents]        = useState<TraceEvent[]>([]);
  const [reasoning,          setReasoning]          = useState("");
  const [reasoningDecision,  setReasoningDecision]  = useState<ReasoningDecision | null>(null);
  const [activeResult,       setActiveResult]       = useState<string | null>(null);
  const [terminalData,       setTerminalData]       = useState<{ type: "deferred" | "rejected"; reason: string } | null>(null);
  const [submitError,        setSubmitError]        = useState("");
  const [walletAddress,      setWalletAddress]      = useState<`0x${string}` | null>(null);
  const [chainId,            setChainId]            = useState<number | null>(null);
  const [usdcBalance,        setUsdcBalance]        = useState<number | null>(null);
  const [viewingTask,        setViewingTask]        = useState<(Task & { trace: TraceEvent[] }) | null>(null);
  const [walletError,        setWalletError]        = useState("");

  const walletRef = useRef<`0x${string}` | null>(null);
  const tasksRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef  = useRef<AbortController | null>(null);

  walletRef.current = walletAddress;

  const isOnArcTestnet = chainId === ARC_CHAIN_ID;

  async function fetchUSDCBalance(address: string): Promise<void> {
    const eth          = getEth();
    const usdcContract = process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS;
    if (!eth || !usdcContract) return;
    const calldata = "0x70a08231" + "000000000000000000000000" + address.slice(2).toLowerCase();
    try {
      const result = await eth.request({ method: "eth_call", params: [{ to: usdcContract, data: calldata }, "latest"] });
      setUsdcBalance(Number(BigInt(result as string)) / 1e6);
    } catch { setUsdcBalance(null); }
  }

  // Silent reconnect on mount + wallet event subscriptions
  useEffect(() => {
    const eth = getEth();
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

  // Wallet-filtered task polling
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

  // Fetch tasks when wallet connects/changes; clear when disconnected
  useEffect(() => {
    if (walletAddress) {
      fetchTasks();
    } else {
      setTasks([]);
    }
  }, [walletAddress, fetchTasks]);

  const connectWallet = useCallback(async () => {
    const eth = getEth();
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

  const switchToArcTestnet = useCallback(async () => {
    const eth = getEth();
    if (!eth) return;
    setWalletError("");
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_HEX }] });
      const chain = ARC_CHAIN_ID;
      setChainId(chain);
      localStorage.setItem(CHAIN_KEY, String(chain));
      if (walletRef.current) await fetchUSDCBalance(walletRef.current);
    } catch {
      try {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId:           ARC_CHAIN_HEX,
            chainName:         "Arc Testnet",
            nativeCurrency:    { name: "USD Coin", symbol: "USDC", decimals: 6 },
            rpcUrls:           ["https://rpc.arcnetwork.xyz"],
            blockExplorerUrls: ["https://explorer.arcnetwork.xyz"],
          }],
        });
        const chain = ARC_CHAIN_ID;
        setChainId(chain);
        localStorage.setItem(CHAIN_KEY, String(chain));
        if (walletRef.current) await fetchUSDCBalance(walletRef.current);
      } catch (addErr) {
        setWalletError(addErr instanceof Error ? addErr.message : "Failed to add Arc Testnet");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
                setSubmitError(event.data);
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
    <div className="grid grid-cols-12 gap-2 h-[calc(100vh-88px)]">

      {/* Left col: Wallet + History */}
      <div className="col-span-4 flex flex-col gap-2 overflow-hidden">

        {/* Wallet bar */}
        <div className="panel p-3 flex flex-col gap-2 shrink-0">
          {!walletAddress ? (
            <button
              type="button"
              onClick={connectWallet}
              className="w-full border py-2 text-[12px] font-mono transition-all"
              style={{ background: "transparent", borderColor: "var(--amber)", color: "var(--amber)" }}
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
              style={{ background: "transparent", borderColor: "var(--amber)", color: "var(--amber)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,160,16,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              Switch to Arc Testnet
            </button>
          ) : (
            <div
              className="px-2 py-1.5 border flex items-center gap-2"
              style={{ background: "rgba(0,200,128,0.04)", borderColor: "rgba(0,200,128,0.2)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--green)" }} />
              <span className="text-[10px] font-mono truncate" style={{ color: "var(--text-2)" }}>
                {walletAddress}
              </span>
              {usdcBalance !== null && (
                <span
                  className="ml-auto text-[10px] font-mono shrink-0"
                  style={{ color: "var(--green)" }}
                >
                  ${usdcBalance.toFixed(2)}
                </span>
              )}
            </div>
          )}
          {walletError && (
            <p className="text-[10px] font-mono" style={{ color: "var(--red)" }}>{walletError}</p>
          )}
        </div>

        {/* Task history */}
        <TaskHistoryPanel
          tasks={tasks}
          walletAddress={walletAddress}
          onTaskClick={viewTask}
        />
      </div>

      {/* Right col: Main work area */}
      <div className="col-span-8 flex flex-col gap-2 overflow-hidden">
        {viewingTask ? (
          <ViewingOverlay task={viewingTask} onClose={() => setViewingTask(null)} />
        ) : (uiState === "idle" || uiState === "composing") ? (
          <TaskSubmitForm
            walletAddress={walletAddress}
            isOnArcTestnet={isOnArcTestnet}
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
            activeTask={null}
          />
        ) : uiState === "complete" ? (
          <div className="panel h-full flex flex-col">
            <div className="panel-header">
              <span className="label">Result</span>
              <button
                onClick={handleNewTask}
                className="text-[10px] font-mono px-2 py-1 border transition-colors"
                style={{ borderColor: "var(--wire)", color: "var(--text-2)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-2)"; }}
              >
                New Task
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <TaskResultView result={activeResult} reasoning={null} task_type={selectedTaskType} />
            </div>
          </div>
        ) : uiState === "terminal" ? (
          <div className="panel h-full flex flex-col">
            <div className="panel-header">
              <span
                className="label"
                style={{ color: terminalData?.type === "rejected" ? "var(--red)" : "var(--amber)" }}
              >
                {terminalData?.type === "rejected" ? "Task Rejected" : "Task Deferred"}
              </span>
              <button
                onClick={handleNewTask}
                className="text-[10px] font-mono px-2 py-1 border transition-colors"
                style={{ borderColor: "var(--wire)", color: "var(--text-2)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-2)"; }}
              >
                New Task
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div
                className="w-full max-w-lg p-6 border text-[13px] font-mono leading-relaxed"
                style={{
                  borderColor: terminalData?.type === "rejected" ? "rgba(255,68,68,0.3)" : "rgba(232,160,16,0.3)",
                  background:  terminalData?.type === "rejected" ? "rgba(255,68,68,0.04)" : "rgba(232,160,16,0.04)",
                  color:       "var(--text-1)",
                }}
              >
                {terminalData?.reason}
              </div>
            </div>
          </div>
        ) : (
          /* error */
          <div className="panel h-full flex flex-col">
            <div className="panel-header">
              <span className="label" style={{ color: "var(--red)" }}>Error</span>
              <button
                onClick={handleNewTask}
                className="text-[10px] font-mono px-2 py-1 border transition-colors"
                style={{ borderColor: "var(--wire)", color: "var(--text-2)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-2)"; }}
              >
                Try Again
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div
                className="w-full max-w-lg p-6 border text-[13px] font-mono"
                style={{ borderColor: "rgba(255,68,68,0.3)", background: "rgba(255,68,68,0.04)", color: "var(--red)" }}
              >
                {submitError || "An unexpected error occurred."}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
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
  const arcUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://explorer.arcnetwork.xyz";

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="label">Task Result</span>
          <span
            className="text-[10px] font-mono line-clamp-1"
            style={{ color: "var(--text-3)" }}
          >
            {task.task}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] font-mono px-2 py-1 border transition-colors shrink-0"
          style={{ borderColor: "var(--wire)", color: "var(--text-2)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-2)"; }}
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <TaskResultView result={task.result} reasoning={task.reasoning} task_type={task.task_type} />

        {/* Trace events */}
        {task.trace.length > 0 && (
          <div className="px-4 pt-2 pb-4 border-t" style={{ borderColor: "var(--wire)" }}>
            <div
              className="text-[10px] font-mono uppercase tracking-wider mb-2"
              style={{ color: "var(--text-3)" }}
            >
              Execution Trace
            </div>
            <div className="flex flex-col gap-1">
              {task.trace.map((event, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                  <span className="shrink-0" style={{ color: "var(--text-3)" }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ color: "var(--text-2)" }}>{event.description}</span>
                  {event.arc_tx_hash && (
                    <a
                      href={`${arcUrl}/tx/${event.arc_tx_hash}`}
                      target="_blank" rel="noopener noreferrer"
                      className="ml-auto shrink-0 text-[10px]"
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

