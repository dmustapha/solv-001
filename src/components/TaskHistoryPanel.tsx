"use client";

import type { Task } from "@/types";

interface Props { tasks: Task[]; }

const STATUS_COLORS: Record<string, string> = {
  complete:  "text-green-400 bg-green-400/10",
  deferred:  "text-yellow-400 bg-yellow-400/10",
  rejected:  "text-red-400 bg-red-400/10",
  executing: "text-blue-400 bg-blue-400/10",
  reasoning: "text-purple-400 bg-purple-400/10",
  pending:   "text-gray-400 bg-gray-700",
};

export default function TaskHistoryPanel({ tasks }: Props) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-200">
          Task History
          <span className="ml-2 text-xs text-gray-500">({tasks.length})</span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-800 scrollbar-thin">
        {tasks.length === 0 && (
          <div className="p-4 text-xs text-gray-600 text-center mt-8">
            No tasks yet. Submit a task to get started.
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
  const statusClass = STATUS_COLORS[task.status] ?? STATUS_COLORS.pending;
  const arcUrl      = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://explorer.arcnetwork.xyz";

  return (
    <div className="p-3 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs text-gray-300 line-clamp-2 flex-1">{task.task}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded font-mono shrink-0 ${statusClass}`}>
          {task.status}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="font-mono">{task.task_type}</span>

        {task.income_usdc > 0 && (
          <span className="text-green-500">+${task.income_usdc.toFixed(3)}</span>
        )}
        {task.cost_usdc != null && (
          <span className="text-red-400">-${task.cost_usdc.toFixed(3)}</span>
        )}
        {task.net_usdc != null && (
          <span className={task.net_usdc >= 0 ? "text-green-400 font-medium" : "text-red-400"}>
            net ${task.net_usdc.toFixed(3)}
          </span>
        )}
      </div>

      {task.reasoning && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2 italic">{task.reasoning}</p>
      )}

      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {task.income_tx_hash && (
          <a
            href={`${arcUrl}/tx/${task.income_tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-500/70 hover:text-green-500 underline"
          >
            income tx ↗
          </a>
        )}
        {task.expense_tx_hashes.slice(0, 2).map((hash, i) => (
          <a
            key={i}
            href={`${arcUrl}/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-yellow-500/70 hover:text-yellow-500 underline"
          >
            expense tx ↗
          </a>
        ))}
        {task.expense_tx_hashes.length > 2 && (
          <span className="text-xs text-gray-600">+{task.expense_tx_hashes.length - 2} more</span>
        )}
        <span className="text-xs text-gray-600 ml-auto">
          {new Date(task.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
