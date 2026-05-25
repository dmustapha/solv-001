import { NextRequest }                from "next/server";
import { build402Response, verifyGatewayPayment } from "@/lib/nanopayments-seller";
import { getTransactionCount, getCode, getLogs, checkChainLive } from "@/lib/arc-canteen";
import { checkRateLimit, pruneExpiredEntries } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";

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

  // Internal self-calls bypass rate limit and payment gate entirely
  const internalSecret = process.env.INTERNAL_CALL_SECRET;
  const isInternalCall = internalSecret && req.nextUrl.searchParams.get("_secret") === internalSecret;

  if (!isInternalCall) {
    // Rate limit: 30 data-service calls per IP per minute
    pruneExpiredEntries();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const rl = checkRateLimit(`data-service:${ip}`, { limit: 30, windowMs: 60_000 });
    if (!rl.allowed) {
      return Response.json(
        { error: "Rate limit exceeded. Max 30 data service calls per minute." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }
  }

  // Check for x402 payment (GatewayClient sends Payment-Signature header on retry)
  const paymentSig = req.headers.get("Payment-Signature");
  let paymentTxHash: string | undefined;

  if (!isInternalCall && !paymentSig) {
    const demoMode = req.nextUrl.searchParams.get("demo") === "true";
    if (!demoMode) {
      return build402Response({ price_usdc, task_type: type, requestUrl: req.url });
    }
  } else if (!isInternalCall && paymentSig) {
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
        return { address: addr, transfer_count: 5, total_sent_usdc: 0.25, total_received_usdc: 1.50, recent: [], window_blocks: 500 };
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

      const TRANSFER_SIG  = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      const ARC_USDC      = "0x3600000000000000000000000000000000000000";
      const paddedAddress = "0x" + "0".repeat(24) + address.slice(2).toLowerCase();

      try {
        const { blockNumber } = await checkChainLive();
        const fromBlock       = "0x" + Math.max(0, blockNumber - 500).toString(16);

        // Two calls: transfers FROM address, transfers TO address
        const [sentLogs, receivedLogs] = await Promise.all([
          getLogs({ fromBlock, toBlock: "latest", address: ARC_USDC, topics: [TRANSFER_SIG, paddedAddress] }),
          getLogs({ fromBlock, toBlock: "latest", address: ARC_USDC, topics: [TRANSFER_SIG, null, paddedAddress] }),
        ]);

        const decodeUsdc = (log: unknown) => Number(BigInt((log as { data: string }).data)) / 1e6;

        const totalSent     = sentLogs.reduce<number>((s, l) => s + decodeUsdc(l), 0);
        const totalReceived = receivedLogs.reduce<number>((s, l) => s + decodeUsdc(l), 0);
        const transferCount = sentLogs.length + receivedLogs.length;

        // Merge, sort by block descending, take 5 most recent
        const recent = [...sentLogs, ...receivedLogs]
          .sort((a, b) => {
            const la = a as { blockNumber: string };
            const lb = b as { blockNumber: string };
            return parseInt(lb.blockNumber, 16) - parseInt(la.blockNumber, 16);
          })
          .slice(0, 5)
          .map((l) => {
            const log = l as { topics: string[]; data: string; transactionHash: string };
            return {
              from:        "0x" + log.topics[1].slice(26),
              to:          "0x" + log.topics[2].slice(26),
              amount_usdc: Number(BigInt(log.data)) / 1e6,
              tx_hash:     log.transactionHash,
            };
          });

        return { address, transfer_count: transferCount, total_sent_usdc: totalSent, total_received_usdc: totalReceived, recent, window_blocks: 500 };
      } catch {
        return { address, transfer_count: 0, total_sent_usdc: 0, total_received_usdc: 0, recent: [], note: "Arc RPC unavailable" };
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
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const response  = await anthropic.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages:   [{
          role:    "user",
          content: `You are a research assistant specializing in Arc testnet, Circle payments, and DeFi. Answer concisely in 2-4 sentences: ${query}`,
        }],
      });
      const summary = response.content[0]?.type === "text"
        ? response.content[0].text
        : "Research complete — see Arc testnet documentation for details.";
      return { query, summary };
    }

    default:
      return { error: `Unknown type: ${type}` };
  }
}
