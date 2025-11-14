import { GET as runEthereumSync } from '@/app/api/ethereum-full-sync/route';
import { POST as runPulsechainSync } from '@/app/api/simple-pulsechain-sync/route';

async function main() {
  console.log('🚀 Starting Ethereum HEX staking full sync...');
  const ethResponse = await runEthereumSync();
  const ethPayload = await ethResponse.json();
  console.log('Ethereum sync result:', JSON.stringify(ethPayload, null, 2));

  console.log('\n🚀 Starting PulseChain HEX staking simple sync...');
  const pulseResponse = await runPulsechainSync();
  const pulsePayload = await pulseResponse.json();
  console.log('PulseChain sync result:', JSON.stringify(pulsePayload, null, 2));
}

main().catch((error) => {
  console.error('Sync runner failed:', error);
  process.exit(1);
});
