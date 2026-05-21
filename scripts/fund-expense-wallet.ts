/**
 * Fund the expense wallet with testnet USDC so GatewayClient.pay() can work.
 * Uses Circle SDK requestTestnetTokens + GatewayClient.deposit().
 */
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const apiKey       = process.env.CIRCLE_API_KEY!;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET!;
  const expenseKey   = process.env.EXPENSE_WALLET_PRIVATE_KEY! as `0x${string}`;
  const expenseAddr  = process.env.SELLER_EOA_ADDRESS!;  // same address

  const circleClient = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  // Step 1: Request testnet USDC for the expense wallet via Circle faucet
  console.log(`Requesting testnet USDC for expense wallet: ${expenseAddr}`);
  try {
    const drip = await (circleClient as unknown as {
      requestTestnetTokens: (args: { address: string; blockchain: string; native: boolean; usdc: boolean }) => Promise<unknown>
    }).requestTestnetTokens({
      address:    expenseAddr,
      blockchain: "ARC-TESTNET",
      native:     false,
      usdc:       true,
    });
    console.log("Faucet drip result:", JSON.stringify(drip, null, 2));
  } catch (e) {
    console.warn("Faucet drip failed:", e instanceof Error ? e.message : String(e));
  }

  // Wait a moment for testnet confirmation
  console.log("Waiting 5s for testnet...");
  await new Promise(r => setTimeout(r, 5000));

  // Step 2: Check USDC balance on expense wallet via Arc RPC
  const { getTransactionCount } = await import("../src/lib/arc-canteen.js");
  try {
    const count = await getTransactionCount(expenseAddr as `0x${string}`);
    console.log(`Expense wallet tx count on Arc: ${count}`);
  } catch (e) {
    console.warn("Arc RPC check failed:", e instanceof Error ? e.message : String(e));
  }

  // Step 3: Deposit into GatewayClient
  console.log("Depositing $2 USDC into GatewayClient...");
  const gwClient = new GatewayClient({ chain: "arcTestnet", privateKey: expenseKey });
  try {
    await gwClient.deposit("2");
    console.log("✓ Gateway deposit successful");
    const bal = await gwClient.getBalances();
    console.log("Gateway balances:", JSON.stringify(bal, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2));
  } catch (e) {
    console.error("Gateway deposit failed:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main().catch(e => {
  console.error("Fatal:", e.message ?? e);
  process.exit(1);
});
