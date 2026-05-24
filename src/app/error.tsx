"use client";

import { useEffect } from "react";
import Link from "next/link";
import SolvLogo from "@/components/SolvLogo";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-6"
      style={{ background: "var(--bg)" }}
    >
      <SolvLogo size={32} color="var(--red)" />

      <div className="text-center flex flex-col gap-2">
        <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--red)" }}>
          Runtime Error
        </div>
        <h1 className="text-[20px] font-mono font-semibold" style={{ color: "var(--text-1)" }}>
          Something went wrong
        </h1>
        <p className="text-[13px] max-w-sm" style={{ color: "var(--text-2)" }}>
          {error.message || "An unexpected error occurred. The agent is still running."}
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono" style={{ color: "var(--text-3)" }}>
            digest: {error.digest}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="btn-amber px-4 py-2 text-[13px] font-mono font-medium"
          style={{ borderRadius: "4px" }}
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="btn-ghost px-4 py-2 text-[13px] font-mono"
          style={{ borderRadius: "4px" }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
