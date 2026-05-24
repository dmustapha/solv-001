import { defineChain } from "viem";

// Shared Arc Testnet chain definition — used by both server (usyc.ts) and client (TaskSubmitForm)
export const arcTestnet = defineChain({
  id:   5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: [process.env.ARC_RPC_URL ?? "https://rpc.arcnetwork.xyz"] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.arcnetwork.xyz" },
  },
});

export const ARC_CHAIN_ID       = 5042002;
export const ARC_CHAIN_ID_HEX   = "0x4cef52";  // 5042002 in hex — for wallet_switchEthereumChain
export const ARC_USDC_ADDRESS   = "0x3600000000000000000000000000000000000000" as const;
export const ARC_TELLER_ADDRESS = "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A" as const;
export const ARC_USYC_ADDRESS   = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as const;
