const https = require('https');

// Simple script to check stakes
async function checkStakes() {
    try {
        const response = await fetch('http://localhost:3000/api/debug-pulsechain-stakes');
        const data = await response.json();
        
        console.log('=== PULSECHAIN STAKES ANALYSIS ===');
        console.log(`Total PulseChain stakes: ${data.data.totalStakes}`);
        console.log(`Active by flag: ${data.data.activeByFlag}`);
        console.log(`Active by end day: ${data.data.activeByEndDay}`);
        console.log(`Current HEX day: ${data.data.currentDay}`);
        console.log('\nSample stakes:');
        data.data.sampleStakes.forEach((stake, i) => {
            console.log(`${i+1}. ID: ${stake.stake_id}, Active: ${stake.is_active}, End Day: ${stake.end_day}, Days Left: ${stake.days_left}`);
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

checkStakes();