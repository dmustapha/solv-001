"use client";

import type { TraceEvent, ReasoningDecision } from "@/types";

interface Props {
  reasoning:         string;
  reasoningDecision: ReasoningDecision | null;
  traceEvents:       TraceEvent[];
  isActive:          boolean;
}

/** Maps SSE stream progress to a 0-100 percentage for the progress bar */
function computeProgress(
  reasoning: string,
  reasoningDecision: ReasoningDecision | null,
  traceEvents: TraceEvent[],
): number {
  if (reasoningDecision) {
    const nanopayments = traceEvents.filter(e => e.type === "nanopayment").length;
    const hasResult    = traceEvents.some(e => e.type === "result");
    if (hasResult) return 95;
    return 55 + Math.min(nanopayments * 12, 36);
  }
  if (reasoning.length > 0) {
    // Reasoning phase: 15% to 55% based on text length (rough estimate)
    return Math.min(15 + Math.floor(reasoning.length / 40), 52);
  }
  return 8; // payment verified, waiting for reasoning
}

const PHASE_LABELS: [number, string][] = [
  [8,  "Payment received"],
  [15, "Claude reasoning..."],
  [55, "Decision made"],
  [67, "Fetching data"],
  [90, "Writing result"],
  [95, "Wrapping up"],
];

function getPhaseLabel(pct: number): string {
  for (let i = PHASE_LABELS.length - 1; i >= 0; i--) {
    if (pct >= PHASE_LABELS[i][0]) return PHASE_LABELS[i][1];
  }
  return "Processing...";
}

export default function TaskProgressBar({ reasoning, reasoningDecision, traceEvents, isActive }: Props) {
  if (!isActive) return null;

  const pct   = computeProgress(reasoning, reasoningDecision, traceEvents);
  const label = getPhaseLabel(pct);

  return (
    <div className="flex flex-col gap-2 px-4 pt-3 pb-2 border-b" style={{ borderColor: "var(--wire)" }}>
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-mono"
          style={{ color: "var(--text-2)" }}
        >
          {label}
        </span>
        <span
          className="text-[10px] font-mono tabular-nums"
          style={{ color: "var(--text-3)" }}
        >
          {pct}%
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
