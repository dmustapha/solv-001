// Check payer wallet Arc USDC balance directly on-chain
const ARC_RPC  = "https://rpc.testnet.arc-node.thecanteenapp.com/v1/swrm_d4643bb9d2ec62adf991e2b84a5968aca7bf48995bdb1f01b22e7f903da00f2c";
const ARC_USDC = "0x3600000000000000000000000000000000000000";
const PAYER    = "0x156D30820aec51eEB34C74977Eb5f106322c2B50";

// balanceOf(address) = 0x70a08231
const data = `0x70a08231000000000000000000000000${PAYER.slice(2).toLowerCase()}`;
const res  = await fetch(ARC_RPC, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: ARC_USDC, data }, "latest"], id: 1 }),
});
const json = await res.json() as { result: string };
const raw  = BigInt(json.result ?? "0x0");
console.log(`On-chain Arc USDC balance: ${Number(raw) / 1e6} USDC (${raw} units)`);
