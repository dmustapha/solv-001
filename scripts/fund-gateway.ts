// Deposit USDC into GatewayWalletBatched so settle() works
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http, parseUnits, parseAbi } from "viem";

const PRIVATE_KEY    = "0x3661767a8f1298138129e305cc3178e086b459cb090a117cf014aa59884ae0be" as `0x${string}`;
const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as `0x${string}`;
const ARC_USDC       = "0x3600000000000000000000000000000000000000" as `0x${string}`;
const ARC_CHAIN_ID   = 5042002;
const ARC_RPC        = "https://rpc.testnet.arc-node.thecanteenapp.com/v1/swrm_d4643bb9d2ec62adf991e2b84a5968aca7bf48995bdb1f01b22e7f903da00f2c";

const arcChain = {
  id: ARC_CHAIN_ID, name: "Arc Testnet", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC] } },
} as const;

const GATEWAY_ABI = parseAbi([
  "function deposit(address token, uint256 value)",
  "function availableBalance(address token, address depositor) view returns (uint256)",
  "function totalBalance(address token, address depositor) view returns (uint256)",
]);
const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

async function main() {
  const account      = privateKeyToAccount(PRIVATE_KEY);
  const walletClient = createWalletClient({ account, chain: arcChain, transport: http(ARC_RPC) });
  const publicClient = createPublicClient({ chain: arcChain, transport: http(ARC_RPC) });

  // Check current gateway balance
  const [walletBal, gwAvail, gwTotal] = await Promise.all([
    publicClient.readContract({ address: ARC_USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] }),
    publicClient.readContract({ address: GATEWAY_WALLET, abi: GATEWAY_ABI, functionName: "availableBalance", args: [ARC_USDC, account.address] }),
    publicClient.readContract({ address: GATEWAY_WALLET, abi: GATEWAY_ABI, functionName: "totalBalance", args: [ARC_USDC, account.address] }),
  ]);
  
  console.log(`Wallet USDC: $${Number(walletBal) / 1e6}`);
  console.log(`Gateway available: $${Number(gwAvail) / 1e6}`);
  console.log(`Gateway total: $${Number(gwTotal) / 1e6}`);

  const depositAmount = parseUnits("5", 6); // Deposit $5 USDC

  // 1. Approve gateway to spend USDC (if not already done)
  const allowance = await publicClient.readContract({ address: ARC_USDC, abi: ERC20_ABI, functionName: "allowance", args: [account.address, GATEWAY_WALLET] });
  if (allowance < depositAmount) {
    console.log("\nApproving gateway...");
    const approveTx = await walletClient.writeContract({ address: ARC_USDC, abi: ERC20_ABI, functionName: "approve", args: [GATEWAY_WALLET, 2n ** 256n - 1n] });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log("  Approved ✅");
  } else {
    console.log(`\nAllowance already sufficient: $${Number(allowance) / 1e6}`);
  }

  // 2. Deposit into gateway
  console.log(`\nDepositing $${Number(depositAmount) / 1e6} USDC into gateway...`);
  const depositTx = await walletClient.writeContract({
    address: GATEWAY_WALLET,
    abi: GATEWAY_ABI,
    functionName: "deposit",
    args: [ARC_USDC, depositAmount],
  });
  console.log("  tx:", depositTx);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: depositTx });
  console.log("  status:", receipt.status);

  // 3. Check new balances
  const [newWalletBal, newGwAvail] = await Promise.all([
    publicClient.readContract({ address: ARC_USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] }),
    publicClient.readContract({ address: GATEWAY_WALLET, abi: GATEWAY_ABI, functionName: "availableBalance", args: [ARC_USDC, account.address] }),
  ]);
  
  console.log(`\nAfter deposit:`);
  console.log(`  Wallet USDC: $${Number(newWalletBal) / 1e6}`);
  console.log(`  Gateway available: $${Number(newGwAvail) / 1e6}`);
}

main().catch(e => { console.error(e); process.exit(1); });
