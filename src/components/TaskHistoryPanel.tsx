"use client";

import { isArcTxHash } from "@/lib/utils";
import { isJsonBlob } from "@/lib/format";
import { ARC_EXPLORER_URL, TASK_LABELS } from "@/lib/constants";
import SolvLogo from "@/components/SolvLogo";
import type { Task, TaskType } from "@/types";

interface Props {
  tasks:         Task[];
  walletAddress: `0x${string}` | null;
  onTaskClick:   (id: string) => void;
  globalView?:   boolean;
}

const STATUS_COLOR: Record<string, string> = {
  complete:  "var(--green)",
  deferred:  "var(--amber)",
  rejected:  "var(--red)",
  failed:    "var(--red)",
  executing: "var(--blue)",
  reasoning: "var(--violet)",
  pending:   "var(--text-3)",
};

const WATCH_TYPES = new Set<TaskType>(["wallet_watch", "contract_watch"]);
const SCHED_TYPES = new Set<TaskType>(["scheduled_disbursement", "conditional_payment"]);

function getStatusDisplay(task: Task): { label: string; color: string } {
  if (task.status === "deferred") {
    if (WATCH_TYPES.has(task.task_type)) return { label: "monitoring", color: "var(--blue)" };
    if (SCHED_TYPES.has(task.task_type)) return { label: "scheduled", color: "var(--violet)" };
    return { label: "deferred", color: "var(--amber)" };
  }
  return {
    label: task.status,
    color: STATUS_COLOR[task.status] ?? "var(--text-3)",
  };
}


export default function TaskHistoryPanel({ tasks, walletAddress, onTaskClick, globalView = false }: Props) {
  return (
    <div className="panel flex-1 flex flex-col min-h-0">
      <div className="panel-header">
        <span className="label">{globalView ? "All Tasks" : "Your Tasks"}</span>
        {tasks.length > 0 && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 border"
            style={{ color: "var(--text-2)", borderColor: "var(--wire-2)", background: "var(--surf-2)" }}
          >
            {tasks.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {!walletAddress && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-12 text-center">
            <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
              Connect wallet to see your history
            </div>
          </div>
        )}

        {(walletAddress || globalView) && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
            <SolvLogo size={32} color="var(--wire-2)" />
            <div className="text-[12px]" style={{ color: "var(--text-3)" }}>
              {globalView ? "No tasks recorded yet" : "No tasks yet"}
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-3)" }}>
              {globalView
                ? "Tasks appear here as the agent completes them"
                : "Submit your first task to get started"}
            </div>
          </div>
        )}

        {(walletAddress || globalView) && tasks.map((task, i) => (
          <TaskRow key={task.id} task={task} index={i} onClick={globalView ? undefined : () => onTaskClick(task.id)} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, index, onClick }: { task: Task; index: number; onClick?: () => void }) {
  const { label: statusLbl, color: dotColor } = getStatusDisplay(task);
  const typeLabel = TASK_LABELS[task.task_type] ?? task.task_type.replace(/_/g, " ");

  // Snippet: prefer result, fall back to non-JSON reasoning
  const snippet = task.result
    ? task.result.slice(0, 120)
    : (task.reasoning && !isJsonBlob(task.reasoning))
      ? task.reasoning.slice(0, 120)
      : null;

  return (
    <div
      className={`px-4 py-3 border-b animate-fade-up opacity-0${onClick ? " card-interactive" : ""}`}
      style={{
        borderColor:       "var(--wire)",
        animationDelay:    `${Math.min(index * 40, 480)}ms`,
        animationFillMode: "both",
      }}
      onClick={onClick}
    >
      <div className="flex items-start gap-2.5 mb-2">
        <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
        <span className="text-[12px] line-clamp-2 flex-1 leading-snug" style={{ color: "var(--text-1)" }}>
          {task.task}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[10px] font-mono ml-4 mb-1.5">
        <span style={{ color: "var(--text-3)" }}>{typeLabel}</span>
        <span style={{ color: "var(--wire-2)" }}>·</span>
        <span style={{ color: dotColor }}>{statusLbl}</span>
      </div>

      <div className="flex items-center gap-3 text-[10px] font-mono ml-4">
        {task.income_usdc > 0 && (
          <span style={{ color: "var(--green)" }}>+${task.income_usdc.toFixed(3)}</span>
        )}
        {task.cost_usdc != null && (
          <span style={{ color: "var(--red)" }}>-${task.cost_usdc.toFixed(3)}</span>
        )}
        {task.net_usdc != null && (
          <span style={{ color: task.net_usdc >= 0 ? "var(--green)" : "var(--red)" }}>
            =${task.net_usdc.toFixed(3)}
          </span>
        )}
        <span className="ml-auto" style={{ color: "var(--text-3)" }}>
          {new Date(task.created_at).toLocaleDateString()}
        </span>
      </div>

      {snippet && (
        <p className="text-[10px] mt-1.5 ml-4 line-clamp-2 leading-relaxed" style={{ color: "var(--text-2)" }}>
          {snippet}
        </p>
      )}

      {(isArcTxHash(task.income_tx_hash) || task.expense_tx_hashes.some(isArcTxHash)) && (
        <div className="flex items-center gap-3 mt-2 ml-4" onClick={e => e.stopPropagation()}>
          {isArcTxHash(task.income_tx_hash) && (
            <a
              href={`${ARC_EXPLORER_URL}/tx/${task.income_tx_hash}`}
              target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-mono transition-colors"
              style={{ color: "var(--green)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            >
              income ↗
            </a>
          )}
          {task.expense_tx_hashes.filter(isArcTxHash).slice(0, 2).map((hash) => (
            <a
              key={hash}
              href={`${ARC_EXPLORER_URL}/tx/${hash}`}
              target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-mono transition-colors"
              style={{ color: "var(--amber)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            >
              expense ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
