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
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [submitError,    setSubmitError]    = useState("");
  const [treasuryError,  setTreasuryError]  = useState("");
  const [tasksError,     setTasksError]     = useState("");
  const treasuryRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const tasksRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef      = useRef<AbortController | null>(null);

  const fetchTreasury = useCallback(async () => {
    try {
      const res  = await fetch("/api/treasury");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as TreasuryState;
      setTreasury(data);
      setTreasuryError("");
    } catch { setTreasuryError("Treasury data unavailable"); }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res  = await fetch("/api/tasks");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Task[];
      setTasks(data);
      setTasksError("");
    } catch { setTasksError("Task list unavailable"); }
  }, []);

  useEffect(() => {
    fetchTreasury();
    fetchTasks();
    treasuryRef.current = setInterval(fetchTreasury, 5_000);
    tasksRef.current    = setInterval(fetchTasks,    3_000);
    return () => {
      if (treasuryRef.current) clearInterval(treasuryRef.current);
      if (tasksRef.current)    clearInterval(tasksRef.current);
      abortRef.current?.abort();
    };
  }, [fetchTreasury, fetchTasks]);

  const handleTaskSubmit = useCallback(async (payload: Record<string, unknown>) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSubmitting(true);
    setTraceEvents([]);
    setReasoning("");
    setSubmitError("");

    let res: Response;
    try {
      res = await fetch("/api/tasks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
        signal:  controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") {
        setSubmitError("Network error — could not reach the agent.");
      }
      setIsSubmitting(false);
      return;
    }

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setSubmitError(body.error ?? `Server error ${res.status}`);
      setIsSubmitting(false);
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          for (const line of block.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as SSEEvent;

              if (event.type === "treasury_snapshot") setTreasury(event.data);
              if (event.type === "reasoning_chunk")   setReasoning(prev => prev + event.data);
              if (event.type === "trace")             setTraceEvents(prev => [...prev, event.data]);
              if (event.type === "error")             setSubmitError(event.data);
              if (
                event.type === "complete" ||
                event.type === "deferred" ||
                event.type === "rejected"
              ) {
                setIsSubmitting(false);
                fetchTasks();
                fetchTreasury();
              }
            } catch { /* malformed JSON — skip */ }
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") {
        setSubmitError("Stream interrupted unexpectedly.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchTasks, fetchTreasury]);

  return (
    <div className="grid grid-cols-12 gap-2 h-[calc(100vh-88px)]">

      {/* Left: Treasury + Submit */}
      <div className="col-span-3 flex flex-col gap-2 overflow-y-auto scrollbar-thin">
        <TreasuryPanel treasury={treasury} />
        {treasuryError && (
          <p className="text-[10px] font-mono px-1" style={{ color: "var(--red)" }}>
            {treasuryError}
          </p>
        )}
        <TaskSubmitForm onSubmit={handleTaskSubmit} isSubmitting={isSubmitting} />
        {submitError && (
          <p className="text-[11px] font-mono px-1" style={{ color: "var(--red)" }}>
            {submitError}
          </p>
        )}
      </div>

      {/* Centre: Execution Trace */}
      <div className="col-span-5">
        <TaskTracePanel
          traceEvents={traceEvents}
          reasoning={reasoning}
          isActive={isSubmitting}
          activeTask={null}
        />
      </div>

      {/* Right: Task History */}
      <div className="col-span-4 flex flex-col gap-2">
        {tasksError && (
          <p className="text-[10px] font-mono px-1" style={{ color: "var(--red)" }}>
            {tasksError}
          </p>
        )}
        <TaskHistoryPanel tasks={tasks} />
      </div>
    </div>
  );
}
