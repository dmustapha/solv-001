import { NextResponse } from "next/server";

const USDC = "0x3600000000000000000000000000000000000000";

/**
 * GET /api/balance?address=0x...
 * Returns the USDC balance for an address using the server-side authenticated RPC.
 * Avoids MetaMask's unreliable Arc Testnet RPC endpoint for balance reads.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address") ?? "0x0000000000000000000000000000000000000000";

  const padded = address.toLowerCase().replace("0x", "").padStart(64, "0");

  const rpcRes = await fetch(process.env.ARC_RPC_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method:  "eth_call",
      params:  [{ to: USDC, data: `0x70a08231${padded}` }, "latest"],
      id:      1,
    }),
  });

  const { result } = await rpcRes.json() as { result?: string };
  const raw = result && result !== "0x" ? BigInt(result) : 0n;
  const usdc = Number(raw) / 1e6;

  return NextResponse.json({ usdc });
}
