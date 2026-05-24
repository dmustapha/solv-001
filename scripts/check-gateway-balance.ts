import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { GatewayClient } from "@circle-fin/x402-batching/client";

const PAYER_KEY = "0x3661767a8f1298138129e305cc3178e086b459cb090a117cf014aa59884ae0be" as `0x${string}`;

async function main() {
  const gwClient = new GatewayClient({ chain: "arcTestnet", privateKey: PAYER_KEY });
  console.log("GatewayClient methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(gwClient)));
  try {
    const balances = await gwClient.getBalances();
    console.log("Payer gateway balances:", JSON.stringify(balances, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2));
  } catch (e: any) {
    console.log("getBalances error:", e.message);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
