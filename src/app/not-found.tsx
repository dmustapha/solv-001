import Link from "next/link";
import SolvLogo from "@/components/SolvLogo";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-6"
      style={{ background: "var(--bg)" }}
    >
      <SolvLogo size={32} color="var(--wire-2)" />

      <div className="text-center flex flex-col gap-2">
        <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
          404
        </div>
        <h1 className="text-[20px] font-mono font-semibold" style={{ color: "var(--text-1)" }}>
          Page not found
        </h1>
        <p className="text-[13px]" style={{ color: "var(--text-2)" }}>
          This route doesn&apos;t exist.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="btn-amber px-4 py-2 text-[13px] font-mono font-medium"
          style={{ borderRadius: "4px" }}
        >
          Open Dashboard
        </Link>
        <Link
          href="/"
          className="btn-ghost px-4 py-2 text-[13px] font-mono"
          style={{ borderRadius: "4px" }}
        >
          Home
        </Link>
      </div>
    </div>
  );
}
