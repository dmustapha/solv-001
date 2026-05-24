"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AppNav          from "@/components/AppNav";
import TreasuryPanel    from "@/components/TreasuryPanel";
import TaskHistoryPanel from "@/components/TaskHistoryPanel";
import type { TreasuryState, Task } from "@/types";

export default function StatusPage() {
  const [treasury,      setTreasury]      = useState<TreasuryState | null>(null);
  const [tasks,         setTasks]         = useState<Task[]>([]);
  const [treasuryError, setTreasuryError] = useState("");
  const treasuryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tasksRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTreasury = useCallback(async () => {
    try {
      const res = await fetch("/api/treasury");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTreasury(await res.json() as TreasuryState);
      setTreasuryError("");
    } catch { setTreasuryError("Treasury data unavailable"); }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) return;
      setTasks(await res.json() as Task[]);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchTreasury();
    fetchTasks();
    treasuryRef.current = setInterval(fetchTreasury, 10_000);
    tasksRef.current    = setInterval(fetchTasks,    15_000);
    return () => {
      if (treasuryRef.current) clearInterval(treasuryRef.current);
      if (tasksRef.current)    clearInterval(tasksRef.current);
    };
  }, [fetchTreasury, fetchTasks]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <AppNav />

      <div className="flex flex-1 min-h-0">
        {/* Task history — primary */}
        <main className="flex-1 min-w-0 flex flex-col p-5 gap-4 overflow-y-auto">
          <TaskHistoryPanel
            tasks={tasks}
            walletAddress={null}
            globalView={true}
            onTaskClick={() => {}}
          />
        </main>

        {/* Treasury — sidebar */}
        <aside
          className="w-72 shrink-0 border-l flex flex-col p-4 gap-3 overflow-y-auto"
          style={{ borderColor: "var(--wire)" }}
        >
          <TreasuryPanel treasury={treasury} />
          {treasuryError && (
            <p className="text-[11px] px-1" style={{ color: "var(--red)" }}>
              {treasuryError}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
