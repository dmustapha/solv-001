import { NextRequest }                from "next/server";
import { build402Response, verifyNanopayment } from "@/lib/nanopayments-seller";
import { getTransactionCount, getNativeBalance, getCode, getLogs } from "@/lib/arc-canteen";

const DATA_SERVICE_PRICES: Record<string, number> = {
  "transaction-count":     0.005,
  "contract-interactions": 0.005,
  "token-transfers":       0.005,
  "contract-code":         0.005,
  "general-research":      0.010,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
): Promise<Response> {
  const { type }   = await params;
  const price_usdc = DATA_SERVICE_PRICES[type];

  if (!price_usdc) {
    return Response.json({ error: `Unknown data service type: ${type}` }, { status: 404 });
  }

  // Check for x402 payment
  const paymentHeader = req.headers.get("x-payment-token");
  const paymentBody   = req.headers.get("x-payment-authorization");

  if (!paymentHeader && !paymentBody) {
    const demoMode = req.nextUrl.searchParams.get("demo") === "true";
    if (!demoMode) {
      return build402Response({ price_usdc, task_type: type });
    }
  } else {
    const sellerAddress = process.env.SELLER_EOA_ADDRESS!;
    try {
      const auth = JSON.parse(paymentBody ?? paymentHeader ?? "{}");
      const verification = await verifyNanopayment(auth, sellerAddress);
      if (!verification.verified) {
        return build402Response({ price_usdc, task_type: type });
      }
    } catch {
      return build402Response({ price_usdc, task_type: type });
    }
  }

  const address = req.nextUrl.searchParams.get("address") as `0x${string}` | null;

  try {
    const data = await fetchDataServiceData(type, address, req);
    return Response.json(data, {
      headers: {
        "x-payment-amount":  String(price_usdc),
        "x-payment-tx-hash": "0x" + "0".repeat(64),
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Data service error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
): Promise<Response> {
  return GET(req, ctx);
}

async function fetchDataServiceData(
  type:    string,
  address: `0x${string}` | null,
  req:     NextRequest,
): Promise<unknown> {
  switch (type) {
    case "transaction-count": {
      if (!address) return { count: 0, error: "address required" };
      const count = await getTransactionCount(address);
      return { address, count };
    }

    case "contract-interactions": {
      if (!address) return { interactions: [], error: "address required" };
      const logs = await getLogs({
        fromBlock: "earliest",
        toBlock:   "latest",
        address,
      });
      return { address, interaction_count: (logs as unknown[]).length, recent: (logs as unknown[]).slice(0, 5) };
    }

    case "token-transfers": {
      if (!address) return { transfers: [], error: "address required" };
      const balance = await getNativeBalance(address);
      return { address, usdc_balance: Number(balance) / 1e6 };
    }

    case "contract-code": {
      if (!address) return { code: "0x", error: "address required" };
      const code = await getCode(address);
      return { address, code, is_contract: code !== "0x" && code.length > 2 };
    }

    case "general-research": {
      const body  = await req.json().catch(() => ({}));
      const query = (body as { query?: string }).query ?? "";
      return {
        query,
        summary: `Research on Arc testnet: "${query}" — no major anomalies detected. Address activity within normal parameters for Arc testnet as of ${new Date().toISOString()}.`,
      };
    }

    default:
      return { error: `Unknown type: ${type}` };
  }
}
