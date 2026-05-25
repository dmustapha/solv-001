import { NextRequest }        from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { parseUnits }          from "viem";
import { randomBytes }         from "crypto";
import { TASK_PRICING }        from "@/types";
import type { TaskType, EIP3009Auth } from "@/types";

const ARC_CHAIN_ID = 5042002;
const ARC_USDC     = "0x3600000000000000000000000000000000000000" as const;

// ─── POST /api/sign-demo ──────────────────────────────────────────────────────
// Server-side EIP-3009 signer for demo mode. Signs a transferWithAuthorization
// using TEST_PAYER_PRIVATE_KEY so demos work without MetaMask or Arc Testnet.
//
// Body:  { task_type: TaskType }
// Returns: { payment_authorization: EIP3009Auth, payer_wallet: address }

export async function POST(req: NextRequest): Promise<Response> {
  let task_type: TaskType;
  try {
    ({ task_type } = await req.json() as { task_type: TaskType });
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pricing = TASK_PRICING[task_type];
  if (!pricing) {
    return Response.json({ error: `Unknown task_type: ${task_type}` }, { status: 400 });
  }

  const pk = process.env.TEST_PAYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) {
    return Response.json({ error: "Demo mode not configured (TEST_PAYER_PRIVATE_KEY missing)" }, { status: 503 });
  }

  const agentWallet = process.env.CIRCLE_WALLET_ADDRESS as `0x${string}`;
  if (!agentWallet) {
    return Response.json({ error: "Agent wallet not configured" }, { status: 503 });
  }

  const account      = privateKeyToAccount(pk);
  const price        = parseUnits(pricing.price_usdc.toFixed(6), 6);
  const now          = BigInt(Math.floor(Date.now() / 1000));
  const validAfter   = now - 600n;
  const validBefore  = now + 604800n; // 7 days
  const nonce        = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;

  const signature = await account.signTypedData({
    domain: {
      name:              "USDC",
      version:           "2",
      chainId:           ARC_CHAIN_ID,
      verifyingContract: ARC_USDC,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from",        type: "address" },
        { name: "to",          type: "address" },
        { name: "value",       type: "uint256" },
        { name: "validAfter",  type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce",       type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from:        account.address,
      to:          agentWallet,
      value:       price,
      validAfter,
      validBefore,
      nonce,
    },
  });

  const payment_authorization: EIP3009Auth = {
    from:        account.address,
    to:          agentWallet,
    value:       price.toString(),
    validAfter:  validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
    signature,
  };

  return Response.json({ payment_authorization, payer_wallet: account.address });
}
