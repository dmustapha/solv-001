import type { EIP3009Auth } from "@/types";

const FACILITATOR_URL = "https://gateway-api-testnet.circle.com";

export interface PaymentVerification {
  verified: boolean;
  tx_hash?: `0x${string}`;
  error?: string;
}

// ─── Verify EIP-3009 payment authorization via Circle Gateway facilitator ─────
// [UNVERIFIED adaptation] — derived from createGatewayMiddleware internals.
// The facilitator accepts signed EIP-3009 authorizations and settles them onchain.

export async function verifyNanopayment(
  auth: EIP3009Auth,
  sellerAddress: string,
): Promise<PaymentVerification> {
  // Confirm payment goes to our seller address
  if (auth.to.toLowerCase() !== sellerAddress.toLowerCase()) {
    return { verified: false, error: "Payment authorization recipient mismatch" };
  }

  // Check authorization time window
  const now = Math.floor(Date.now() / 1000);
  if (now < parseInt(auth.validAfter, 10) || now > parseInt(auth.validBefore, 10)) {
    return { verified: false, error: "Payment authorization expired or not yet valid" };
  }

  // Submit to Circle Gateway facilitator for settlement
  // [UNVERIFIED] — /v1/payments/settle is the assumed endpoint.
  // Adjust if Circle docs show a different path.
  const response = await fetch(`${FACILITATOR_URL}/v1/payments/settle`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      from:        auth.from,
      to:          auth.to,
      value:       auth.value,
      validAfter:  auth.validAfter,
      validBefore: auth.validBefore,
      nonce:       auth.nonce,
      signature:   auth.signature,
      token:       process.env.ARC_USDC_ADDRESS,
      chainId:     26,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return {
      verified: false,
      error: `Facilitator rejected payment: ${JSON.stringify(body)}`,
    };
  }

  const result = await response.json();
  return {
    verified:  true,
    tx_hash:   result.txHash as `0x${string}`,
  };
}

// ─── 402 response builder ─────────────────────────────────────────────────────

export function build402Response(params: {
  price_usdc: number;
  task_type: string;
}): Response {
  return Response.json(
    {
      error:    "Payment required",
      payment: {
        method:           "x402",
        chain:            "arcTestnet",
        chain_id:         26,
        currency:         "USDC",
        token_address:    process.env.ARC_USDC_ADDRESS,
        price_usdc:       params.price_usdc,
        price_units:      (params.price_usdc * 1_000_000).toFixed(0),
        seller_address:   process.env.SELLER_EOA_ADDRESS,
        facilitator_url:  FACILITATOR_URL,
        task_type:        params.task_type,
        instructions:     "Sign an EIP-3009 transferWithAuthorization and include it in payment_authorization.",
      },
    },
    { status: 402 },
  );
}
