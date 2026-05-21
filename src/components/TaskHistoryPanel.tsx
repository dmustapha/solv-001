"use client";

import type { Task } from "@/types";

interface Props { tasks: Task[]; }

const STATUS_COLOR: Record<string, string> = {
  complete:  "#16C97A",
  deferred:  "#E09820",
  rejected:  "#F04858",
  executing: "#4B8BF0",
  reasoning: "#9060E8",
  pending:   "#60788A",
};

export default function TaskHistoryPanel({ tasks }: Props) {
  return (
    <div className="bg-[#0D1016] border border-[#18202E] rounded-sm h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#18202E] flex items-center justify-between shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-[#60788A]">Task History</span>
        {tasks.length > 0 && (
          <span className="text-[10px] font-mono text-[#283040]">{tasks.length}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-[#18202E] scrollbar-thin">
        {tasks.length === 0 && (
          <div className="px-4 py-6 text-[11px] text-[#283040] text-center mt-8">
            No tasks yet
          </div>
        )}

        {tasks.map(task => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const dotColor = STATUS_COLOR[task.status] ?? STATUS_COLOR.pending;
  const arcUrl   = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://explorer.arcnetwork.xyz";

  return (
    <div className="px-4 py-3 hover:bg-[#0F1520] transition-colors">
      {/* Task text + status dot */}
      <div className="flex items-start gap-2.5 mb-2">
        <span
          className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <span className="text-[12px] text-[#D6E0EC] line-clamp-2 flex-1 leading-snug">
          {task.task}
        </span>
      </div>

      {/* Financials + type */}
      <div className="flex items-center gap-3 text-[10px] font-mono ml-4">
        <span className="text-[#283040]">{task.task_type.replace(/_/g, " ")}</span>
        {task.income_usdc > 0 && (
          <span className="text-[#16C97A]">+${task.income_usdc.toFixed(3)}</span>
        )}
        {task.cost_usdc != null && (
          <span className="text-[#F04858]">-${task.cost_usdc.toFixed(3)}</span>
        )}
        {task.net_usdc != null && (
          <span className={task.net_usdc >= 0 ? "text-[#16C97A]" : "text-[#F04858]"}>
            =${task.net_usdc.toFixed(3)}
          </span>
        )}
        <span className="ml-auto text-[#283040]">
          {new Date(task.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Reasoning snippet */}
      {task.reasoning && (
        <p className="text-[10px] text-[#60788A]/70 mt-1.5 ml-4 line-clamp-2 italic leading-relaxed">
          {task.reasoning}
        </p>
      )}

      {/* TX links */}
      {(task.income_tx_hash || task.expense_tx_hashes.length > 0) && (
        <div className="flex items-center gap-3 mt-2 ml-4">
          {task.income_tx_hash && (
            <a
              href={`${arcUrl}/tx/${task.income_tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#16C97A]/40 hover:text-[#16C97A] transition-colors"
            >
              income ↗
            </a>
          )}
          {task.expense_tx_hashes.slice(0, 2).map((hash, i) => (
            <a
              key={i}
              href={`${arcUrl}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#E09820]/40 hover:text-[#E09820] transition-colors"
            >
              expense ↗
            </a>
          ))}
          {task.expense_tx_hashes.length > 2 && (
            <span className="text-[10px] text-[#283040]">
              +{task.expense_tx_hashes.length - 2} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
