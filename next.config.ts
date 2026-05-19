import type { NextConfig } from "next";

const config: NextConfig = {
  // Serve /.well-known/agent.json via rewrite to /api/agent-card
  async rewrites() {
    return [
      {
        source:      "/.well-known/agent.json",
        destination: "/api/agent-card",
      },
    ];
  },
  // Required for child_process spawn (arc-canteen) in server actions
  serverExternalPackages: [],
  // Expose Arc explorer URL and agent wallet address to browser
  env: {
    NEXT_PUBLIC_ARC_EXPLORER_URL:      process.env.ARC_EXPLORER_URL ?? "https://explorer.arcnetwork.xyz",
    NEXT_PUBLIC_AGENT_WALLET_ADDRESS:  process.env.CIRCLE_WALLET_ADDRESS ?? "",
    NEXT_PUBLIC_SELLER_EOA_ADDRESS:    process.env.SELLER_EOA_ADDRESS ?? "",
    NEXT_PUBLIC_ARC_USDC_ADDRESS:      process.env.ARC_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000",
    NEXT_PUBLIC_APP_URL:               process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  },
};

export default config;
