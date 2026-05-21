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
  payment_received: "↓",
  query:            "→",
  nanopayment:      "↑",
  reasoning:        "◈",
  result:           "✓",
};

const TRACE_COLORS: Record<string, string> = {
  payment_received: "#16C97A",
  nanopayment:      "#E09820",
  query:            "#4B8BF0",
  reasoning:        "#9060E8",
  result:           "#16C97A",
};

export default function TaskTracePanel({ traceEvents, reasoning, isActive, activeTask: _activeTask }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [traceEvents, reasoning]);

  return (
    <div className="bg-[#0D1016] border border-[#18202E] rounded-sm h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#18202E] flex items-center justify-between shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-[#60788A]">Execution Trace</span>
        {isActive && (
          <span className="flex items-center gap-1.5 text-[10px] text-[#4B8BF0] font-mono uppercase tracking-widest">
            <span className="w-1 h-1 rounded-full bg-[#4B8BF0] animate-pulse" />
            Active
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] scrollbar-thin flex flex-col gap-0.5">
        {traceEvents.length === 0 && !reasoning && (
          <div className="text-[#283040] text-center mt-16">
            Submit a task to see the execution trace
          </div>
        )}

        {traceEvents.map((event, i) => (
          <TraceRow key={i} event={event} />
        ))}

        {reasoning && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-widest text-[#9060E8]/60 mb-2">
              Reasoning
            </div>
            <div className="text-[#D6E0EC]/70 leading-relaxed whitespace-pre-wrap bg-[#09050F] border border-[#9060E8]/15 rounded-sm p-3 text-[11px]">
              {reasoning}
              {isActive && <span className="animate-pulse text-[#9060E8]">▌</span>}
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
  const color = TRACE_COLORS[event.type] ?? "#60788A";
  const arcUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://explorer.arcnetwork.xyz";

  return (
    <div className="flex items-start gap-2.5 py-0.5 group">
      <span className="shrink-0 mt-px text-[11px]" style={{ color }}>{icon}</span>
      <div className="flex-1 min-w-0 text-[#D6E0EC]/75">
        {event.description}
        {event.cost_usdc && (
          <span className="ml-2 text-[#E09820]/80">
            [{event.cost_usdc.toFixed(3)} USDC
            {event.arc_tx_hash && (
              <a
                href={`${arcUrl}/tx/${event.arc_tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-[#4B8BF0] hover:text-[#00C8FF] transition-colors"
              >
                {event.arc_tx_hash.slice(0, 8)}↗
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
            className="ml-2 text-[#4B8BF0]/60 hover:text-[#4B8BF0] transition-colors text-[10px]"
          >
            [{event.arc_tx_hash.slice(0, 8)}↗]
          </a>
        )}
      </div>
      <span className="text-[#283040] shrink-0 text-[10px] group-hover:text-[#60788A] transition-colors">
        {new Date(event.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}
