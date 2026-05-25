// Top up the payer wallet's Circle gateway balance so test payments settle
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { GatewayClient } from "@circle-fin/x402-batching/client";

const PAYER_KEY  = "0x3661767a8f1298138129e305cc3178e086b459cb090a117cf014aa59884ae0be" as `0x${string}`;
const DEPOSIT    = "1"; // USDC

async function main() {
  const gwClient = new GatewayClient({ chain: "arcTestnet", privateKey: PAYER_KEY });

  const before = await gwClient.getBalances();
  console.log(`Wallet:  $${before.wallet.formatted} USDC`);
  console.log(`Gateway: $${before.gateway.formattedAvailable} USDC available`);
  console.log(`\nDepositing ${DEPOSIT} USDC into gateway...`);

  await gwClient.deposit(DEPOSIT);
  console.log("✓ Deposit submitted");

  // Wait a moment for indexing
  await new Promise(r => setTimeout(r, 5000));

  const after = await gwClient.getBalances();
  console.log(`\nAfter deposit:`);
  console.log(`Wallet:  $${after.wallet.formatted} USDC`);
  console.log(`Gateway: $${after.gateway.formattedAvailable} USDC available`);
}
main().catch(e => { console.error("Error:", e.message ?? e); process.exit(1); });
