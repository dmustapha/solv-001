"use client";

import { useEffect, useRef } from "react";
import { isArcTxHash } from "@/lib/utils";
import { ARC_EXPLORER_URL } from "@/lib/constants";
import TaskProgressBar from "./TaskProgressBar";
import type { TraceEvent, ReasoningDecision } from "@/types";

interface Props {
  traceEvents:        TraceEvent[];
  reasoning:          string;
  reasoningDecision?: ReasoningDecision | null;
  isActive:           boolean;
}

const TRACE_ICONS: Record<string, string> = {
  payment_received: "↓",
  query:            "→",
  nanopayment:      "↑",
  reasoning:        "◈",
  result:           "✓",
};

const TRACE_COLORS: Record<string, string> = {
  payment_received: "var(--green)",
  nanopayment:      "var(--amber)",
  query:            "var(--blue)",
  reasoning:        "var(--violet)",
  result:           "var(--green)",
};

const DECISION_STYLES: Record<string, { color: string; border: string; bg: string }> = {
  ACCEPT: { color: "var(--green)",  border: "rgba(0,200,128,0.3)",  bg: "rgba(0,200,128,0.06)" },
  DEFER:  { color: "var(--amber)",  border: "rgba(232,160,16,0.3)", bg: "rgba(232,160,16,0.06)" },
  REJECT: { color: "var(--red)",    border: "rgba(255,68,68,0.3)",  bg: "rgba(255,68,68,0.06)" },
};

export default function TaskTracePanel({ traceEvents, reasoning, reasoningDecision, isActive }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [traceEvents, reasoning]);

  const isEmpty = traceEvents.length === 0 && !reasoning;

  return (
    <div className="panel h-full flex flex-col">
      {/* Header */}
      <div className="panel-header">
        <span className="label">Execution Trace</span>
        {isActive && (
          <span
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "var(--amber)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
              style={{ background: "var(--amber)" }}
            />
            Agent running
          </span>
        )}
      </div>

      {/* SSE progress bar */}
      <TaskProgressBar
        reasoning={reasoning}
        reasoningDecision={reasoningDecision ?? null}
        traceEvents={traceEvents}
        isActive={isActive}
      />

      <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] scrollbar-thin flex flex-col gap-0.5">

        {/* Empty state — idle (no task running) */}
        {isEmpty && !isActive && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
            <div
              className="text-[32px] font-mono"
              style={{ color: "var(--amber)", opacity: 0.35 }}
            >
              ◈
            </div>
            <div className="text-[12px] font-mono" style={{ color: "var(--text-2)" }}>
              Submit a task to see the execution trace
            </div>
            <div className="text-[10px] font-mono" style={{ color: "var(--text-3)" }}>
              EIP-3009 payment → reasoning → x402 queries → result
            </div>
          </div>
        )}

        {/* Starting indicator — active but no content yet */}
        {isEmpty && isActive && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
            <div className="flex items-center gap-1.5">
              <span className="animate-pulse" style={{ animationDelay: "0ms",   fontSize: "18px", color: "var(--amber)", opacity: 0.6 }}>·</span>
              <span className="animate-pulse" style={{ animationDelay: "200ms", fontSize: "18px", color: "var(--amber)", opacity: 0.6 }}>·</span>
              <span className="animate-pulse" style={{ animationDelay: "400ms", fontSize: "18px", color: "var(--amber)", opacity: 0.6 }}>·</span>
            </div>
            <div className="text-[11px] font-mono" style={{ color: "var(--text-3)" }}>
              Initializing agent
            </div>
          </div>
        )}

        {/* Reasoning block */}
        {reasoning && (
          <div className="mb-4 animate-fade-up">
            <div
              className="text-[10px] uppercase tracking-widest mb-2"
              style={{ color: "var(--violet)" }}
            >
              Agent Reasoning
            </div>
            <div
              className="leading-relaxed whitespace-pre-wrap p-3 text-[11px] border"
              style={{
                background:  "rgba(112,72,216,0.06)",
                borderColor: "rgba(112,72,216,0.2)",
                color:       "var(--text-1)",
              }}
            >
              {reasoning}
              {isActive && traceEvents.length === 0 && !reasoningDecision && (
                <span className="animate-blink" style={{ color: "var(--violet)" }}>▌</span>
              )}
            </div>
            {reasoningDecision && (() => {
              const ds = DECISION_STYLES[reasoningDecision.decision] ?? DECISION_STYLES.DEFER;
              return (
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 border"
                    style={{ color: ds.color, borderColor: ds.border, background: ds.bg }}
                  >
                    {reasoningDecision.decision}
                  </span>
                  <span className="text-[10px] font-mono line-clamp-1" style={{ color: "var(--text-2)" }}>
                    {reasoningDecision.explanation}
                  </span>
                </div>
              );
            })()}
          </div>
        )}

        {/* Trace events */}
        {traceEvents.map((event, i) => (
          <TraceRow
            key={`${event.type}-${new Date(event.timestamp).getTime()}-${i}`}
            event={event}
            index={i}
          />
        ))}

        {/* Working indicator — shown when active and there's content to anchor it */}
        {isActive && (traceEvents.length > 0 || reasoning) && (
          <div className="flex items-center gap-1 py-1.5 pl-0.5" style={{ color: "var(--text-3)" }}>
            <span className="animate-pulse" style={{ animationDelay: "0ms",   fontSize: "10px" }}>·</span>
            <span className="animate-pulse" style={{ animationDelay: "200ms", fontSize: "10px" }}>·</span>
            <span className="animate-pulse" style={{ animationDelay: "400ms", fontSize: "10px" }}>·</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function TraceRow({ event, index }: { event: TraceEvent; index: number }) {
  const icon   = TRACE_ICONS[event.type]  ?? "·";
  const color  = TRACE_COLORS[event.type] ?? "var(--text-2)";
  const hashOk = isArcTxHash(event.arc_tx_hash);

  return (
    <div
      className="flex items-start gap-2.5 py-0.5 animate-slide-left opacity-0"
      style={{
        animationDelay:    `${Math.min(index * 50, 600)}ms`,
        animationFillMode: "both",
      }}
    >
      <span className="shrink-0 mt-px text-[11px]" style={{ color }}>{icon}</span>
      <div className="flex-1 min-w-0" style={{ color: "var(--text-1)" }}>
        {event.description}
        {event.cost_usdc && (
          <span className="ml-2" style={{ color: "var(--amber)" }}>
            [{event.cost_usdc.toFixed(3)} USDC
            {hashOk && (
              <a
                href={`${ARC_EXPLORER_URL}/tx/${event.arc_tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 trace-hash text-[10px] font-mono"
              >
                {event.arc_tx_hash!.slice(0, 8)}↗
              </a>
            )}
            ]
          </span>
        )}
        {!event.cost_usdc && hashOk && (
          <a
            href={`${ARC_EXPLORER_URL}/tx/${event.arc_tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-[10px] font-mono link-hover"
            style={{ color: "var(--text-3)" }}
          >
            [{event.arc_tx_hash!.slice(0, 8)}↗]
          </a>
        )}
      </div>
      <span className="shrink-0 text-[10px] trace-ts">
        {new Date(event.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}
