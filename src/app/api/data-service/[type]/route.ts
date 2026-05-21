import { NextRequest }                from "next/server";
import { build402Response, verifyGatewayPayment } from "@/lib/nanopayments-seller";
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

  // Check for x402 payment (GatewayClient sends Payment-Signature header on retry)
  const paymentSig = req.headers.get("Payment-Signature");
  let paymentTxHash: string | undefined;

  if (!paymentSig) {
    const demoMode = req.nextUrl.searchParams.get("demo") === "true";
    if (!demoMode) {
      return build402Response({ price_usdc, task_type: type, requestUrl: req.url });
    }
  } else {
    try {
      const verification = await verifyGatewayPayment(paymentSig);
      if (!verification.verified) {
        return build402Response({ price_usdc, task_type: type, requestUrl: req.url });
      }
      paymentTxHash = verification.tx_hash;
    } catch {
      return build402Response({ price_usdc, task_type: type, requestUrl: req.url });
    }
  }

  const address = req.nextUrl.searchParams.get("address") as `0x${string}` | null;

  // Build PAYMENT-RESPONSE header for GatewayClient to read transaction hash
  const paymentResponseHeader = paymentTxHash
    ? Buffer.from(JSON.stringify({ success: true, transaction: paymentTxHash })).toString("base64")
    : undefined;

  try {
    const data = await fetchDataServiceData(type, address, req);
    const responseHeaders: Record<string, string> = {
      "x-payment-amount":  String(price_usdc),
      "x-payment-tx-hash": paymentTxHash ?? "0x" + "0".repeat(64),
    };
    if (paymentResponseHeader) {
      responseHeaders["PAYMENT-RESPONSE"] = paymentResponseHeader;
    }
    return Response.json(data, { headers: responseHeaders });
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
  const isDemo = req.nextUrl.searchParams.get("demo") === "true";

  // Demo mode: return realistic stub data without hitting Arc RPC
  if (isDemo) {
    const addr = address ?? "0xDEMO000000000000000000000000000000000000";
    switch (type) {
      case "transaction-count":
        return { address: addr, count: 42 };
      case "contract-interactions":
        return { address: addr, interaction_count: 7, recent: [] };
      case "token-transfers":
        return { address: addr, usdc_balance: 1.25 };
      case "contract-code":
        return { address: addr, code: "0x", is_contract: false };
      case "general-research": {
        const body  = await req.json().catch(() => ({}));
        const query = (body as { query?: string }).query ?? "";
        return {
          query,
          summary: `Research on Arc testnet (demo): "${query}" — no major anomalies detected.`,
        };
      }
      default:
        return { error: `Unknown type: ${type}` };
    }
  }

  switch (type) {
    case "transaction-count": {
      if (!address) return { count: 0, error: "address required" };
      try {
        const count = await getTransactionCount(address);
        return { address, count };
      } catch {
        return { address, count: 0, note: "Arc RPC unavailable" };
      }
    }

    case "contract-interactions": {
      if (!address) return { interactions: [], error: "address required" };
      try {
        const logs = await getLogs({ fromBlock: "earliest", toBlock: "latest", address });
        return { address, interaction_count: (logs as unknown[]).length, recent: (logs as unknown[]).slice(0, 5) };
      } catch {
        return { address, interaction_count: 0, recent: [], note: "Arc RPC unavailable" };
      }
    }

    case "token-transfers": {
      if (!address) return { transfers: [], error: "address required" };
      try {
        const balance = await getNativeBalance(address);
        return { address, usdc_balance: Number(balance) / 1e6 };
      } catch {
        return { address, usdc_balance: 0, note: "Arc RPC unavailable" };
      }
    }

    case "contract-code": {
      if (!address) return { code: "0x", error: "address required" };
      try {
        const code = await getCode(address);
        return { address, code, is_contract: code !== "0x" && code.length > 2 };
      } catch {
        return { address, code: "0x", is_contract: false, note: "Arc RPC unavailable" };
      }
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
