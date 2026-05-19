import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey:       process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });

  console.log("Creating wallet set...");
  const { data: wsData } = await client.createWalletSet({ name: "solv-001" });
  const walletSetId = wsData!.walletSet!.id!;
  console.log("WalletSet ID:", walletSetId);

  console.log("Creating wallet on ARC-TESTNET...");
  const { data: wData } = await client.createWallets({
    walletSetId,
    blockchains: ["ARC-TESTNET"],
    count: 1,
  });
  const wallet = wData!.wallets![0];
  console.log("Wallet ID:", wallet.id);
  console.log("Address:", wallet.address);
  console.log("WalletSet ID:", walletSetId);
  console.log("\nAdd these to .env.local:");
  console.log(`CIRCLE_WALLET_ID=${wallet.id}`);
  console.log(`CIRCLE_WALLET_ADDRESS=${wallet.address}`);
  console.log(`CIRCLE_WALLET_SET_ID=${walletSetId}`);
  process.exit(0);
}

main().catch(err => {
  console.error("Wallet creation failed:", err.message ?? err);
  process.exit(1);
});
