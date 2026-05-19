import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="min-h-screen p-4">
      <header className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-white">solv-001</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Autonomous AI agent · Arc testnet · Circle 4-tool stack
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live on Arc Testnet
        </div>
      </header>
      <Dashboard />
    </main>
  );
}
