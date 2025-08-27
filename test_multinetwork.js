// Test script to check multi-network staking service
import { multiNetworkHexStakingService } from './services/multiNetworkHexStakingService.js';

async function testMultiNetwork() {
    console.log('=== TESTING MULTI-NETWORK STAKING SERVICE ===\n');
    
    try {
        // Test 1: Get top stakes from both networks
        console.log('1. Testing getTopStakes(10)...');
        const topStakes = await multiNetworkHexStakingService.getTopStakes(10);
        
        console.log(`Total active stakes: ${topStakes.totalActiveStakes}`);
        console.log(`Total staked HEX: ${topStakes.totalStakedHearts}`);
        console.log(`\nEthereum: ${topStakes.ethereum.totalActiveStakes} stakes`);
        console.log(`PulseChain: ${topStakes.pulsechain.totalActiveStakes} stakes`);
        
        console.log('\nTop 5 combined stakes:');
        topStakes.topStakes.slice(0, 5).forEach((stake, i) => {
            console.log(`${i+1}. Network: ${stake.network}, ID: ${stake.stakeId}, Amount: ${stake.stakedHearts.slice(0, 10)}...`);
        });
        
    } catch (error) {
        console.error('Error in getTopStakes:', error.message);
    }
    
    try {
        // Test 2: Check a known staker (use a dummy address for testing)
        console.log('\n\n2. Testing getStakerHistory...');
        const stakerAddr = '0x0000000000000000000000000000000000000000'; // dummy address
        const history = await multiNetworkHexStakingService.getStakerHistory(stakerAddr);
        
        console.log(`Networks with data: ${history.networks.join(', ')}`);
        console.log(`Total stakes: ${history.totalStakes}`);
        console.log(`Active stakes: ${history.activeStakes}`);
        console.log(`Ethereum stakes: ${history.ethereum.totalStakes}`);
        console.log(`PulseChain stakes: ${history.pulsechain.totalStakes}`);
        
    } catch (error) {
        console.error('Error in getStakerHistory:', error.message);
    }
}

testMultiNetwork();