import { listTasks, getAllTimeStats } from "@/lib/db";
import { getAgentWallet }            from "@/lib/circle-wallets";

export default async function ProofPage() {
  const [tasks, stats, wallet] = await Promise.all([
    listTasks(20),
    getAllTimeStats(),
    getAgentWallet().catch(() => null),
  ]);

  const arcUrl      = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://explorer.arcnetwork.xyz";
  const completedTasks = tasks.filter(t => t.status === "complete");
  const allIncomeTx    = completedTasks.flatMap(t => t.income_tx_hash ? [t.income_tx_hash] : []);
  const allExpenseTx   = completedTasks.flatMap(t => t.expense_tx_hashes);

  return (
    <main className="max-w-3xl mx-auto p-8 text-gray-200">
      <h1 className="text-2xl font-bold mb-2">solv-001 — Integration Proof</h1>
      <p className="text-gray-400 text-sm mb-8">
        Verifiable evidence that all Circle tool integrations are live on Arc testnet.
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-blue-400">Agent Wallet (Circle Developer-Controlled)</h2>
        <table className="w-full text-xs text-left border-collapse">
          <tbody>
            <tr className="border-b border-gray-800">
              <td className="py-2 text-gray-400 w-40">Wallet address</td>
              <td className="py-2 font-mono">
                <a href={`${arcUrl}/address/${wallet?.address}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  {wallet?.address ?? "Loading..."}
                </a>
              </td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 text-gray-400">USDC balance</td>
              <td className="py-2 font-mono text-green-400">{(wallet?.usdc_balance ?? 0).toFixed(4)} USDC</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 text-gray-400">Blockchain</td>
              <td className="py-2 font-mono">{wallet?.blockchain ?? "ARC-TESTNET"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-yellow-400">Nanopayments (x402) — Income + Expense</h2>
        <div className="grid grid-cols-2 gap-4 text-xs mb-3">
          <div className="bg-gray-900 rounded p-3">
            <div className="text-gray-400 mb-1">Income transactions</div>
            <div className="text-green-400 text-2xl font-bold">{allIncomeTx.length}</div>
          </div>
          <div className="bg-gray-900 rounded p-3">
            <div className="text-gray-400 mb-1">Expense Nanopayments</div>
            <div className="text-yellow-400 text-2xl font-bold">{allExpenseTx.length}</div>
          </div>
        </div>
        <div className="text-xs text-gray-500 space-y-1">
          {allIncomeTx.slice(0, 3).map((hash, i) => (
            <a key={i} href={`${arcUrl}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="block text-green-500/70 hover:text-green-500 font-mono">
              income: {hash.slice(0, 20)}... ↗
            </a>
          ))}
          {allExpenseTx.slice(0, 3).map((hash, i) => (
            <a key={i} href={`${arcUrl}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="block text-yellow-500/70 hover:text-yellow-500 font-mono">
              expense: {hash.slice(0, 20)}... ↗
            </a>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-purple-400">Claude Reasoning — Sample</h2>
        {completedTasks.slice(0, 1).map(task => (
          <div key={task.id} className="bg-gray-900 rounded p-3 text-xs">
            <div className="text-gray-400 mb-1">Task: {task.task_type}</div>
            <p className="text-gray-300 italic">&ldquo;{task.reasoning}&rdquo;</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-green-400">Summary</h2>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>Total tasks completed: <span className="text-white">{stats.total_completed}</span></li>
          <li>Total income earned: <span className="text-green-400">${stats.total_income.toFixed(4)} USDC</span></li>
          <li>All income and expense transactions: verifiable on Arc explorer above</li>
          <li>Claude reasoning: logged per task (model: claude-sonnet-4-6)</li>
          <li>USYC integration: requires allowlisting — APY display live, deposit after approval</li>
        </ul>
      </section>
    </main>
  );
}
