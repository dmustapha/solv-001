"use client";

import { isJsonBlob } from "@/lib/format";
import type { TaskType } from "@/types";

interface Props {
  result:    string | null;
  reasoning: string | null;
  task_type: TaskType | null;
}

// Detect numbered sections like "1. WALLET OVERVIEW:" or "1. Overview:"
const SECTION_HEADER = /^(\d+\.\s+[A-Z][A-Za-z\s]+:)/m;

function renderResult(result: string): React.ReactNode {
  // Short result — centered large text
  if (result.length < 150 && !result.includes("\n")) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] p-8">
        <p
          className="text-[18px] font-mono text-center leading-relaxed"
          style={{ color: "var(--amber)" }}
        >
          {result}
        </p>
      </div>
    );
  }

  // Numbered sections — parse and render with headers
  if (SECTION_HEADER.test(result)) {
    const lines    = result.split("\n");
    const elements: React.ReactNode[] = [];
    let   key      = 0;

    for (const line of lines) {
      if (SECTION_HEADER.test(line)) {
        elements.push(
          <div
            key={key++}
            className="text-[11px] font-mono uppercase tracking-wider mt-4 mb-1.5 first:mt-0"
            style={{ color: "var(--amber)" }}
          >
            {line}
          </div>,
        );
      } else if (line.trim() === "") {
        elements.push(<div key={key++} className="h-1" />);
      } else {
        elements.push(
          <p
            key={key++}
            className="text-[12px] font-mono leading-relaxed"
            style={{ color: "var(--text-1)" }}
          >
            {line}
          </p>,
        );
      }
    }
    return <div className="p-4">{elements}</div>;
  }

  // Default — pre-wrap block
  return (
    <pre
      className="p-4 text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-words"
      style={{ color: "var(--text-1)" }}
    >
      {result}
    </pre>
  );
}

export default function TaskResultView({ result, reasoning, task_type: _task_type }: Props) {
  // Case 1: has result
  if (result && result.trim()) {
    return <div className="h-full overflow-y-auto scrollbar-thin">{renderResult(result)}</div>;
  }

  // Case 2: no result, but reasoning is a JSON blob — watch/scheduled monitoring active
  if (!result && reasoning && isJsonBlob(reasoning)) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 p-8">
        <span
          className="text-[10px] font-mono uppercase tracking-widest px-3 py-1 border"
          style={{
            color:       "var(--blue)",
            borderColor: "rgba(59,130,246,0.3)",
            background:  "rgba(59,130,246,0.06)",
          }}
        >
          Monitoring Active
        </span>
        <p className="text-[11px] font-mono text-center" style={{ color: "var(--text-3)" }}>
          Daily checks are running. You will be notified when conditions are met.
        </p>
      </div>
    );
  }

  // Case 3: no result, non-JSON reasoning — show treasury reasoning as fallback
  if (!result && reasoning && !isJsonBlob(reasoning)) {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin p-4">
        <div
          className="text-[10px] font-mono uppercase tracking-wider mb-3"
          style={{ color: "var(--amber)" }}
        >
          Agent Reasoning
        </div>
        <p
          className="text-[12px] font-mono leading-relaxed italic"
          style={{ color: "var(--text-2)" }}
        >
          {reasoning}
        </p>
      </div>
    );
  }

  // Case 4: nothing
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <p className="text-[11px] font-mono" style={{ color: "var(--text-3)" }}>
        No result available
      </p>
    </div>
  );
}
