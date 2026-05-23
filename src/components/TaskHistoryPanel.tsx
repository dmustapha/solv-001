"use client";

import { isArcTxHash } from "@/lib/utils";
import type { Task } from "@/types";

interface Props { tasks: Task[]; }

const STATUS_COLOR: Record<string, string> = {
  complete:  "var(--green)",
  deferred:  "var(--amber)",
  rejected:  "var(--red)",
  failed:    "var(--red)",
  executing: "var(--blue)",
  reasoning: "var(--violet)",
  pending:   "var(--text-3)",
};

const STATUS_LABEL: Record<string, string> = {
  complete:  "complete",
  deferred:  "deferred",
  rejected:  "rejected",
  failed:    "failed",
  executing: "executing",
  reasoning: "reasoning",
  pending:   "pending",
};

const TASK_LABELS: Record<string, string> = {
  wallet_intelligence:    "Wallet Intelligence",
  counterparty_vet:       "Counterparty Vetting",
  contract_summary:       "Contract Summary",
  conditional_payment:    "Conditional Payment",
  scheduled_disbursement: "Scheduled Disbursement",
  wallet_watch:           "Wallet Watch",
  contract_watch:         "Contract Watch",
  general:                "General Analysis",
};

export default function TaskHistoryPanel({ tasks }: Props) {
  return (
    <div className="panel h-full flex flex-col">
      {/* Header */}
      <div className="panel-header">
        <span className="label">Task History</span>
        {tasks.length > 0 && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 border"
            style={{
              color:       "var(--text-2)",
              borderColor: "var(--wire-2)",
              background:  "var(--surf-2)",
            }}
          >
            {tasks.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
            <div
              className="text-[28px] font-mono opacity-20"
              style={{ color: "var(--amber)" }}
            >
              ░
            </div>
            <div className="text-[12px] font-mono" style={{ color: "var(--text-3)" }}>
              No tasks yet
            </div>
            <div className="text-[10px] font-mono" style={{ color: "var(--text-3)" }}>
              Submit your first task to get started
            </div>
          </div>
        )}

        {tasks.map((task, i) => (
          <TaskRow key={task.id} task={task} index={i} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, index }: { task: Task; index: number }) {
  const dotColor  = STATUS_COLOR[task.status]  ?? STATUS_COLOR.pending;
  const statusLbl = STATUS_LABEL[task.status]  ?? task.status;
  const typeLabel = TASK_LABELS[task.task_type] ?? task.task_type.replace(/_/g, " ");
  const arcUrl    = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://explorer.arcnetwork.xyz";

  return (
    <div
      className="px-4 py-3 border-b transition-colors animate-fade-up opacity-0"
      style={{
        borderColor:       "var(--wire)",
        animationDelay:    `${Math.min(index * 40, 320)}ms`,
        animationFillMode: "both",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--surf-2)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {/* Task text + status dot */}
      <div className="flex items-start gap-2.5 mb-2">
        <span
          className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: dotColor }}
        />
        <span
          className="text-[12px] line-clamp-2 flex-1 leading-snug font-mono"
          style={{ color: "var(--text-1)" }}
        >
          {task.task}
        </span>
      </div>

      {/* Type + status */}
      <div className="flex items-center gap-2 text-[10px] font-mono ml-4 mb-1.5">
        <span style={{ color: "var(--text-3)" }}>{typeLabel}</span>
        <span style={{ color: "var(--wire-2)" }}>·</span>
        <span style={{ color: dotColor }}>{statusLbl}</span>
      </div>

      {/* Financials */}
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

      {/* Reasoning snippet */}
      {task.reasoning && (
        <p
          className="text-[10px] mt-1.5 ml-4 line-clamp-2 leading-relaxed italic"
          style={{ color: "var(--text-2)" }}
        >
          {task.reasoning}
        </p>
      )}

      {/* TX links */}
      {(isArcTxHash(task.income_tx_hash) || task.expense_tx_hashes.some(isArcTxHash)) && (
        <div className="flex items-center gap-3 mt-2 ml-4">
          {isArcTxHash(task.income_tx_hash) && (
            <a
              href={`${arcUrl}/tx/${task.income_tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
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
              href={`${arcUrl}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono transition-colors"
              style={{ color: "var(--amber)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            >
              expense ↗
            </a>
          ))}
          {task.expense_tx_hashes.filter(isArcTxHash).length > 2 && (
            <span className="text-[10px] font-mono" style={{ color: "var(--text-3)" }}>
              +{task.expense_tx_hashes.filter(isArcTxHash).length - 2} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
