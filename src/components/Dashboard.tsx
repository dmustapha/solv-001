"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import TreasuryPanel    from "./TreasuryPanel";
import TaskTracePanel   from "./TaskTracePanel";
import TaskHistoryPanel from "./TaskHistoryPanel";
import TaskSubmitForm   from "./TaskSubmitForm";
import type { TreasuryState, Task, TraceEvent, SSEEvent } from "@/types";

export default function Dashboard() {
  const [treasury,     setTreasury]     = useState<TreasuryState | null>(null);
  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [traceEvents,  setTraceEvents]  = useState<TraceEvent[]>([]);
  const [reasoning,    setReasoning]    = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const treasuryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tasksRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Poll treasury every 5s ──────────────────────────────────────────────────
  const fetchTreasury = useCallback(async () => {
    try {
      const res  = await fetch("/api/treasury");
      const data = await res.json() as TreasuryState;
      setTreasury(data);
    } catch { /* silent — stale state OK */ }
  }, []);

  // ── Poll task list every 3s ─────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    try {
      const res  = await fetch("/api/tasks");
      const data = await res.json() as Task[];
      setTasks(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchTreasury();
    fetchTasks();
    treasuryRef.current = setInterval(fetchTreasury, 5_000);
    tasksRef.current    = setInterval(fetchTasks,    3_000);
    return () => {
      if (treasuryRef.current) clearInterval(treasuryRef.current);
      if (tasksRef.current)    clearInterval(tasksRef.current);
    };
  }, [fetchTreasury, fetchTasks]);

  // ── Task submission with SSE trace ─────────────────────────────────────────
  const handleTaskSubmit = useCallback(async (payload: Record<string, unknown>) => {
    setIsSubmitting(true);
    setTraceEvents([]);
    setReasoning("");

    const res = await fetch("/api/tasks", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      setIsSubmitting(false);
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      for (const line of text.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6)) as SSEEvent;

          if (event.type === "treasury_snapshot") {
            setTreasury(event.data);
          }
          if (event.type === "reasoning_chunk") {
            setReasoning(prev => prev + event.data);
          }
          if (event.type === "trace") {
            setTraceEvents(prev => [...prev, event.data]);
          }
          if (event.type === "complete" || event.type === "deferred" || event.type === "rejected") {
            setIsSubmitting(false);
            fetchTasks();
            fetchTreasury();
          }
        } catch { /* malformed SSE line — skip */ }
      }
    }

    setIsSubmitting(false);
  }, [fetchTasks, fetchTreasury]);

  return (
    <div className="grid grid-cols-12 gap-3 h-[calc(100vh-100px)]">
      {/* Left: Treasury State */}
      <div className="col-span-3 flex flex-col gap-3">
        <TreasuryPanel treasury={treasury} />
        <TaskSubmitForm onSubmit={handleTaskSubmit} isSubmitting={isSubmitting} />
      </div>

      {/* Centre: Task Trace */}
      <div className="col-span-5">
        <TaskTracePanel
          traceEvents={traceEvents}
          reasoning={reasoning}
          isActive={isSubmitting}
          activeTask={null}
        />
      </div>

      {/* Right: Task History */}
      <div className="col-span-4">
        <TaskHistoryPanel tasks={tasks} />
      </div>
    </div>
  );
}
