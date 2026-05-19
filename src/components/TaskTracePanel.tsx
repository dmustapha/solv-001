"use client";

import { useEffect, useRef } from "react";
import type { TraceEvent, Task } from "@/types";

interface Props {
  traceEvents: TraceEvent[];
  reasoning:   string;
  isActive:    boolean;
  activeTask:  Task | null;
}

const TRACE_ICONS: Record<string, string> = {
  payment_received: "→",
  query:            "→",
  nanopayment:      "→",
  reasoning:        "◈",
  result:           "✓",
};

const TRACE_COLORS: Record<string, string> = {
  payment_received: "text-green-400",
  nanopayment:      "text-yellow-400",
  query:            "text-blue-400",
  reasoning:        "text-purple-400",
  result:           "text-green-400",
};

export default function TaskTracePanel({ traceEvents, reasoning, isActive, activeTask: _activeTask }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [traceEvents, reasoning]);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">Execution Trace</h2>
        {isActive && (
          <span className="flex items-center gap-1.5 text-xs text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Active
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs scrollbar-thin space-y-1">
        {traceEvents.length === 0 && !reasoning && (
          <div className="text-gray-600 text-center mt-8">
            Submit a task to see the execution trace
          </div>
        )}

        {traceEvents.map((event, i) => (
          <TraceRow key={i} event={event} />
        ))}

        {reasoning && (
          <div className="mt-3 mb-2">
            <div className="text-purple-500 text-xs uppercase tracking-wide mb-1.5">
              Claude Reasoning
            </div>
            <div className="text-gray-300 leading-relaxed whitespace-pre-wrap bg-gray-800 rounded p-2 text-xs">
              {reasoning}
              {isActive && <span className="animate-pulse">▌</span>}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function TraceRow({ event }: { event: TraceEvent }) {
  const icon  = TRACE_ICONS[event.type]  ?? "·";
  const color = TRACE_COLORS[event.type] ?? "text-gray-400";
  const arcUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://explorer.arcnetwork.xyz";

  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className={`shrink-0 ${color}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-gray-300">{event.description}</span>
        {event.cost_usdc && (
          <span className="ml-2 text-yellow-500">
            [Nanopayment: ${event.cost_usdc.toFixed(3)}
            {event.arc_tx_hash && (
              <a
                href={`${arcUrl}/tx/${event.arc_tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-blue-400 hover:text-blue-300"
              >
                Arc tx: {event.arc_tx_hash.slice(0, 8)}...↗
              </a>
            )}
            ]
          </span>
        )}
        {!event.cost_usdc && event.arc_tx_hash && (
          <a
            href={`${arcUrl}/tx/${event.arc_tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-blue-400 hover:text-blue-300 text-xs"
          >
            [Arc tx: {event.arc_tx_hash.slice(0, 8)}...↗]
          </a>
        )}
      </div>
      <span className="text-gray-600 shrink-0 text-xs">
        {new Date(event.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}
