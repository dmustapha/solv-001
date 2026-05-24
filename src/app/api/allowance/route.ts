import { NextResponse } from "next/server";

const USDC    = "0x3600000000000000000000000000000000000000";
const GATEWAY = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";

/**
 * GET /api/allowance?owner=0x...
 * Returns the USDC allowance granted by `owner` to the Circle Gateway contract.
 * Uses the authenticated server-side RPC — avoids exposing the API key client-side
 * and avoids MetaMask's unreliable Arc Testnet RPC endpoint.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner") ?? "0x0000000000000000000000000000000000000000";

  const ownerPadded   = owner.toLowerCase().replace("0x", "").padStart(64, "0");
  const gatewayPadded = GATEWAY.toLowerCase().replace("0x", "").padStart(64, "0");

  const rpcRes = await fetch(process.env.ARC_RPC_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method:  "eth_call",
      params:  [{ to: USDC, data: `0xdd62ed3e${ownerPadded}${gatewayPadded}` }, "latest"],
      id:      1,
    }),
  });

  const { result } = await rpcRes.json() as { result?: string };
  return NextResponse.json({ allowance: result ?? "0x0" });
}
