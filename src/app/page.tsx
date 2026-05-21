import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="min-h-screen px-4 pt-4 pb-0">
      <header className="flex items-center justify-between mb-3 pb-3 border-b border-[#18202E]">
        <div>
          <h1 className="text-[13px] font-mono font-semibold text-[#D6E0EC] tracking-wide">
            solv-001
          </h1>
          <p className="text-[10px] text-[#60788A] mt-0.5 uppercase tracking-widest">
            Autonomous AI Agent · Arc Testnet · Circle 4-tool stack
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#60788A] font-mono uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16C97A] animate-pulse" />
          Live
        </div>
      </header>
      <Dashboard />
    </main>
  );
}
