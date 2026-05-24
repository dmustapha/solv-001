"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
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
      <header
        className="flex items-center justify-between px-5 py-2.5 border-b shrink-0"
        style={{ borderColor: "var(--wire)", background: "var(--surf)" }}
      >
        <div className="flex items-center gap-5">
          <Link
            href="/dashboard"
            className="text-[12px] font-mono font-semibold tracking-widest transition-colors"
            style={{ color: "var(--amber)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          >
            ← Dashboard
          </Link>
          <span className="h-3 w-px" style={{ background: "var(--wire-2)" }} />
          <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
            Agent Status · All Wallets
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--green)", animation: "pulseDot 2s ease-in-out infinite" }}
          />
          <span className="text-[10px] font-mono" style={{ color: "var(--green)" }}>LIVE</span>
        </div>
      </header>

      <div className="flex-1 min-h-0 px-4 pt-3 pb-3">
        <div className="grid grid-cols-12 gap-2 h-[calc(100vh-88px)]">
          {/* Treasury */}
          <div className="col-span-4 flex flex-col gap-2">
            <TreasuryPanel treasury={treasury} />
            {treasuryError && (
              <p className="text-[10px] font-mono px-1" style={{ color: "var(--red)" }}>
                {treasuryError}
              </p>
            )}
          </div>

          {/* Global task history */}
          <div className="col-span-8 flex flex-col gap-2 overflow-hidden">
            <TaskHistoryPanel
              tasks={tasks}
              walletAddress={null}
              globalView={true}
              onTaskClick={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
