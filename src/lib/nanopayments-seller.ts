import type { EIP3009Auth } from "@/types";

const FACILITATOR_URL        = "https://gateway-api-testnet.circle.com";
const TESTNET_GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
const ARC_NETWORK            = "eip155:5042002";
const ARC_USDC               = "0x3600000000000000000000000000000000000000";

// Ensure Google DNS is used as fallback when local resolver fails for Circle Gateway
// This runs once on module load in the Next.js server environment
try {
  const dns = await import("node:dns");
  const currentServers = dns.getServers();
  if (!currentServers.includes("8.8.8.8")) {
    dns.setServers([...currentServers, "8.8.8.8", "8.8.4.4"]);
  }
} catch { /* non-critical — best effort */ }

export interface PaymentVerification {
  verified: boolean;
  tx_hash?: `0x${string}`;
  error?: string;
}

// ─── Verify EIP-3009 payment authorization via Circle Gateway facilitator ─────
// Derived from Circle Gateway x402 protocol.
// The facilitator accepts signed EIP-3009 authorizations and settles them onchain.

export async function verifyNanopayment(
  auth: EIP3009Auth,
  sellerAddress: string,
): Promise<PaymentVerification> {
  // Confirm payment goes to our Circle wallet
  if (auth.to.toLowerCase() !== sellerAddress.toLowerCase()) {
    return { verified: false, error: "Payment authorization recipient mismatch" };
  }

  // Check authorization time window
  const now = Math.floor(Date.now() / 1000);
  if (now < parseInt(auth.validAfter, 10) || now > parseInt(auth.validBefore, 10)) {
    return { verified: false, error: "Payment authorization expired or not yet valid" };
  }

  // Build x402 payment payload for Circle Gateway
  const accepted = {
    scheme:            "exact",
    network:           ARC_NETWORK,
    asset:             ARC_USDC,
    amount:            auth.value,
    payTo:             sellerAddress,
    maxTimeoutSeconds: 604900,
    extra: {
      name:              "GatewayWalletBatched",
      version:           "1",
      verifyingContract: TESTNET_GATEWAY_WALLET,
    },
  };

  const paymentPayload = {
    x402Version: 2,
    scheme:      "exact",
    network:     ARC_NETWORK,
    resource: {
      url:         "https://solv-001.vercel.app/api/tasks",
      description: "task",
      mimeType:    "application/json",
    },
    accepted,
    payload: {
      authorization: {
        from:        auth.from,
        to:          auth.to,
        value:       auth.value,
        validAfter:  auth.validAfter,
        validBefore: auth.validBefore,
        nonce:       auth.nonce,
      },
      signature: auth.signature,
    },
  };

  // Verify through Circle Gateway
  const verifyRes = await fetch(`${FACILITATOR_URL}/v1/x402/verify`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ paymentPayload, paymentRequirements: accepted }),
  });

  if (!verifyRes.ok) {
    const body = await verifyRes.json().catch(() => ({}));
    return { verified: false, error: `Facilitator verify failed: ${JSON.stringify(body)}` };
  }

  const verifyResult = await verifyRes.json() as { isValid?: boolean; invalidReason?: string };
  if (!verifyResult.isValid) {
    return { verified: false, error: `Payment invalid: ${verifyResult.invalidReason ?? "unknown"}` };
  }

  // Settle on-chain
  const settleRes = await fetch(`${FACILITATOR_URL}/v1/x402/settle`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ paymentPayload, paymentRequirements: accepted }),
  });

  if (!settleRes.ok) {
    const body = await settleRes.json().catch(() => ({}));
    return { verified: false, error: `Facilitator settle failed: ${JSON.stringify(body)}` };
  }

  const settleResult = await settleRes.json() as { success?: boolean; transaction?: string; errorReason?: string };
  if (!settleResult.success) {
    return { verified: false, error: `Settlement failed: ${settleResult.errorReason ?? "unknown"}` };
  }

  return {
    verified: true,
    tx_hash:  settleResult.transaction as `0x${string}` | undefined,
  };
}

// ─── 402 response builder ─────────────────────────────────────────────────────
// Includes PAYMENT-REQUIRED header so GatewayClient.pay() can parse x402 v2 requirements.

export function build402Response(params: {
  price_usdc:  number;
  task_type:   string;
  requestUrl?: string;
}): Response {
  const sellerAddress = process.env.SELLER_EOA_ADDRESS!;
  // Payments are received at the Circle wallet to avoid self-transfer when
  // the expense EOA is also the seller identity.
  const payToAddress  = process.env.CIRCLE_WALLET_ADDRESS || sellerAddress;
  const amountUnits   = (params.price_usdc * 1_000_000).toFixed(0);
  const responseHeaders: Record<string, string> = {};

  if (params.requestUrl) {
    const paymentRequired = {
      x402Version: 2,
      resource: {
        url:         params.requestUrl,
        description: params.task_type,
        mimeType:    "application/json",
      },
      accepts: [
        {
          scheme:            "exact",
          network:           ARC_NETWORK,
          asset:             ARC_USDC,
          amount:            amountUnits,
          payTo:             payToAddress,
          maxTimeoutSeconds: 604900,
          extra: {
            name:              "GatewayWalletBatched",
            version:           "1",
            verifyingContract: TESTNET_GATEWAY_WALLET,
          },
        },
      ],
    };
    responseHeaders["PAYMENT-REQUIRED"] = Buffer.from(
      JSON.stringify(paymentRequired),
    ).toString("base64");
  }

  return Response.json(
    {
      error:    "Payment required",
      payment: {
        method:          "x402",
        chain:           "arcTestnet",
        chain_id:        5042002,
        currency:        "USDC",
        token_address:   ARC_USDC,
        price_usdc:      params.price_usdc,
        price_units:     amountUnits,
        seller_address:  sellerAddress,
        facilitator_url: FACILITATOR_URL,
        task_type:       params.task_type,
      },
    },
    { status: 402, headers: responseHeaders },
  );
}

// ─── Verify GatewayClient Payment-Signature header via Circle Gateway API ─────
// GatewayClient retries with Payment-Signature: base64(JSON payload) after receiving 402.
// The payload shape is: { x402Version, payload: { authorization, signature }, resource, accepted }
// Circle Gateway expects: { paymentPayload, paymentRequirements } where paymentRequirements = accepted.

export async function verifyGatewayPayment(
  paymentSignatureHeader: string,
): Promise<PaymentVerification> {
  let paymentPayload: { accepted?: unknown; [k: string]: unknown };
  try {
    paymentPayload = JSON.parse(Buffer.from(paymentSignatureHeader, "base64").toString("utf-8"));
  } catch {
    return { verified: false, error: "Invalid Payment-Signature header: not base64 JSON" };
  }

  const paymentRequirements = paymentPayload.accepted;
  if (!paymentRequirements) {
    return { verified: false, error: "Missing accepted requirements in Payment-Signature" };
  }

  // Verify through Circle Gateway facilitator
  const verifyRes = await fetch(`${FACILITATOR_URL}/v1/x402/verify`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ paymentPayload, paymentRequirements }),
  });

  if (!verifyRes.ok) {
    const body = await verifyRes.json().catch(() => ({}));
    return { verified: false, error: `Circle Gateway verify rejected: ${JSON.stringify(body)}` };
  }

  const verifyResult = await verifyRes.json().catch(() => ({})) as { isValid?: boolean; invalidReason?: string };
  if (!verifyResult.isValid) {
    return { verified: false, error: `Payment invalid: ${verifyResult.invalidReason ?? "unknown"}` };
  }

  // Settle payment on-chain
  const settleRes = await fetch(`${FACILITATOR_URL}/v1/x402/settle`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ paymentPayload, paymentRequirements }),
  });

  if (!settleRes.ok) {
    const body = await settleRes.json().catch(() => ({}));
    return { verified: false, error: `Circle Gateway settle failed: ${JSON.stringify(body)}` };
  }

  const settleResult = await settleRes.json().catch(() => ({})) as { success?: boolean; transaction?: string; errorReason?: string };
  if (!settleResult.success) {
    return { verified: false, error: `Settlement failed: ${settleResult.errorReason ?? "unknown"}` };
  }

  return {
    verified: true,
    tx_hash:  settleResult.transaction as `0x${string}` | undefined,
  };
}
