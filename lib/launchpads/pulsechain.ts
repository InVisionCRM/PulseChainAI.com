// PulseChain launchpad registry.
//
// PUMP.tires is the dominant pump.fun-style launchpad on PulseChain: coins launch
// on a bonding curve and graduate to PulseX once 200M PLS of bid liquidity has
// accumulated, at which point liquidity is locked permanently and ownership is
// renounced. Its factory/deployer address is the key that attributes a token to
// the pad (already used across the app to badge pump.tires tokens).

import type { Launchpad } from './types';

// Same address used in services/contractAuditService.ts, app/api/token-metrics,
// and app/api/portfolio/insights to detect pump.tires tokens by creator.
export const PUMP_TIRES_FACTORY = '0x6538A83a81d855B965983161AF6a83e616D16fD5';

export const PULSECHAIN_LAUNCHPADS: Launchpad[] = [
  {
    id: 'pump-tires',
    name: 'PUMP.tires',
    chain: 'pulsechain',
    url: 'https://pump.tires',
    status: 'active',
    dexVersion: 'unknown', // graduates to PulseX (v1/v2), not a Uniswap fork
    description:
      'PulseChain’s pump.fun-style launchpad: coins launch on a bonding curve and ' +
      'graduate to PulseX once 200M PLS of bid liquidity accumulates — liquidity is ' +
      'then locked permanently and ownership renounced.',
    factory: PUMP_TIRES_FACTORY,
    contracts: [
      {
        label: 'Factory / Deployer',
        address: PUMP_TIRES_FACTORY,
        role: 'factory',
        verified: true, // deployed bytecode present (source is not verified on the explorer)
      },
    ],
    notes:
      'Bonding-curve progress for coins still on the curve is not exposed by a free ' +
      'API/subgraph and the factory source is unverified, so only graduated (trading) ' +
      'coins are attributed here.',
  },
];
