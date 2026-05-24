// Test if approving GatewayWalletBatched fixes insufficient_balance on settle
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http, parseUnits, parseAbi } from "viem";
import { randomBytes } from "crypto";

const PRIVATE_KEY    = "0x3661767a8f1298138129e305cc3178e086b459cb090a117cf014aa59884ae0be" as `0x${string}`;
const AGENT_WALLET   = "0x927c1d756d12879aebea0772f3ee220f21f4841a" as `0x${string}`;
const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as `0x${string}`;
const ARC_USDC       = "0x3600000000000000000000000000000000000000" as `0x${string}`;
const ARC_CHAIN_ID   = 5042002;
const ARC_NETWORK    = "eip155:5042002";
const FACILITATOR    = "https://gateway-api-testnet.circle.com";
const ARC_RPC        = "https://rpc.testnet.arc-node.thecanteenapp.com/v1/swrm_d4643bb9d2ec62adf991e2b84a5968aca7bf48995bdb1f01b22e7f903da00f2c";

const arcChain = {
  id: ARC_CHAIN_ID, name: "Arc Testnet", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC] } },
} as const;

const account      = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({ account, chain: arcChain, transport: http(ARC_RPC) });
const publicClient = createPublicClient({ chain: arcChain, transport: http(ARC_RPC) });

async function main() {
  console.log("Payer:", account.address);

  // Step 1: Approve gateway to spend USDC
  console.log("\n1. Approving GatewayWalletBatched to spend USDC...");
  const MAX_UINT = 2n ** 256n - 1n;
  const approveTx = await walletClient.writeContract({
    address: ARC_USDC,
    abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
    functionName: "approve",
    args: [GATEWAY_WALLET, MAX_UINT],
  });
  console.log("  approve tx:", approveTx);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log("  status:", receipt.status);

  // Step 2: Check allowance
  const allowance = await publicClient.readContract({
    address: ARC_USDC,
    abi: parseAbi(["function allowance(address owner, address spender) view returns (uint256)"]),
    functionName: "allowance",
    args: [account.address, GATEWAY_WALLET],
  });
  console.log(`  Allowance: ${Number(allowance) / 1e6} USDC`);

  // Step 3: Build new payment auth and try settle
  console.log("\n2. Trying settle with approved allowance...");
  const price = parseUnits("0.10", 6);
  const now   = BigInt(Math.floor(Date.now() / 1000));
  const nonce = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;

  const signature = await walletClient.signTypedData({
    account,
    domain: { name: "GatewayWalletBatched", version: "1", chainId: ARC_CHAIN_ID, verifyingContract: GATEWAY_WALLET },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" }, { name: "to", type: "address" },
        { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: { from: account.address, to: AGENT_WALLET, value: price, validAfter: now - 600n, validBefore: now + 604900n, nonce },
  });

  const accepted = {
    scheme: "exact", network: ARC_NETWORK, asset: ARC_USDC,
    amount: price.toString(), payTo: AGENT_WALLET, maxTimeoutSeconds: 604900,
    extra: { name: "GatewayWalletBatched", version: "1", verifyingContract: GATEWAY_WALLET },
  };
  const paymentPayload = {
    x402Version: 2, scheme: "exact", network: ARC_NETWORK,
    resource: { url: "https://solv-001.vercel.app/api/tasks", description: "task", mimeType: "application/json" },
    accepted,
    payload: {
      authorization: { from: account.address, to: AGENT_WALLET, value: price.toString(), validAfter: (now-600n).toString(), validBefore: (now+604900n).toString(), nonce },
      signature,
    },
  };

  const sRes = await fetch(`${FACILITATOR}/v1/x402/settle`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentPayload, paymentRequirements: accepted }),
  });
  console.log("  Settle status:", sRes.status);
  const sBody = await sRes.json();
  console.log("  Settle body:", JSON.stringify(sBody, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
