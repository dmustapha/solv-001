import type { AgentCard }  from "@/types";
import { TASK_PRICING }    from "@/types";

export async function GET(): Promise<Response> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const card: AgentCard = {
    name:        "solv-001",
    version:     "1.0.0",
    description: "An autonomous AI agent that earns USDC completing on-chain tasks, reasons about its treasury with Claude, and sweeps idle capital into USYC. Deployed on Arc testnet.",
    capabilities: Object.entries(TASK_PRICING).map(([task_type, p]) => ({
      task_type:           task_type as keyof typeof TASK_PRICING,
      description:         getTaskDescription(task_type),
      price_usdc:          p.price_usdc,
      estimated_cost_usdc: p.estimated_cost_usdc,
    })),
    pricing: Object.fromEntries(
      Object.entries(TASK_PRICING).map(([k, v]) => [k, { price_usdc: v.price_usdc, currency: "USDC" as const }])
    ),
    payment: {
      method:          "x402",
      chain:           "arcTestnet",
      seller_address:  process.env.SELLER_EOA_ADDRESS as `0x${string}`,
      facilitator_url: "https://gateway-api-testnet.circle.com",
    },
    api: {
      rest: {
        submit_task: `POST ${appUrl}/api/tasks`,
        get_status:  `GET ${appUrl}/api/tasks/{id}`,
        estimate:    `GET ${appUrl}/api/tasks/estimate?task_type={type}`,
      },
      mcp: {
        endpoint:  `${appUrl}/api/mcp`,
        transport: "http-sse",
      },
    },
  };

  return Response.json(card, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control":               "public, max-age=300",
    },
  });
}

function getTaskDescription(taskType: string): string {
  const descriptions: Record<string, string> = {
    wallet_intelligence:    "Analyze wallet transaction history and provide a risk assessment",
    counterparty_vet:       "Vet a wallet address before sending funds",
    contract_summary:       "Summarize a smart contract's bytecode and interactions",
    conditional_payment:    "Send USDC when a specified onchain condition is met",
    scheduled_disbursement: "Execute a scheduled USDC transfer",
    wallet_watch:           "Monitor a wallet for activity and alert on changes",
    contract_watch:         "Monitor a contract for specific events",
    general:                "General on-chain research and data retrieval task",
  };
  return descriptions[taskType] ?? "Task execution on Arc testnet";
}
