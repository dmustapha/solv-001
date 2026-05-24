/**
 * Deposit USDC into GatewayClient (run after wallet is funded via faucet.circle.com)
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GatewayClient } from '@circle-fin/x402-batching/client';

async function main() {
  const expenseKey = process.env.EXPENSE_WALLET_PRIVATE_KEY! as `0x${string}`;
  const gwClient = new GatewayClient({ chain: 'arcTestnet', privateKey: expenseKey });

  console.log('Checking balances before deposit...');
  const before = await gwClient.getBalances();
  console.log('Before:', JSON.stringify(before, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

  console.log('\nDepositing 15 USDC into GatewayClient...');
  await gwClient.deposit('15');
  console.log('✓ Deposit successful');

  const after = await gwClient.getBalances();
  console.log('After:', JSON.stringify(after, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

main().catch(e => { console.error('Fatal:', e.message ?? e); process.exit(1); });
