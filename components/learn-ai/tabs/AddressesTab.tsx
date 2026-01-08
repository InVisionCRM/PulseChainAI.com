import React from 'react';
import { motion } from 'motion/react';
import { IconAddressBook } from '@tabler/icons-react';

export default function AddressesTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="rounded-lg border border-white/10 bg-white/5 p-6"
    >
      <h2 className="mb-6 text-2xl font-bold text-[#FA4616]">Important PulseChain Addresses</h2>
      <div className="space-y-6">
        {/* Router Addresses */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-white/90">DEX Router Contracts</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/20 bg-white/5 p-4">
              <h4 className="font-semibold text-[#FA4616] mb-2">PulseX V1 Router</h4>
              <code className="block text-sm text-white/80 bg-black/30 p-2 rounded">
                0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02
              </code>
              <p className="mt-2 text-sm text-white/70">
                Primary decentralized exchange router for token swaps on PulseChain
              </p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/5 p-4">
              <h4 className="font-semibold text-[#FA4616] mb-2">PulseX V2 Router</h4>
              <code className="block text-sm text-white/80 bg-black/30 p-2 rounded">
                0x165C3410fC91EF562C50559f7d2289fEbed552d9
              </code>
              <p className="mt-2 text-sm text-white/70">
                Advanced router with improved liquidity and lower fees
              </p>
            </div>
          </div>
        </div>

        {/* Native Tokens */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-white/90">Native Tokens</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/20 bg-white/5 p-4">
              <h4 className="font-semibold text-[#FA4616] mb-2">Wrapped Pulse (WPLS)</h4>
              <code className="block text-sm text-white/80 bg-black/30 p-2 rounded">
                0xA1077a294dDE1B09bB078844df40758a5D0f9a27
              </code>
              <p className="mt-2 text-sm text-white/70">
                ERC-20 wrapped version of PulseChain's native PLS token
              </p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/5 p-4">
              <h4 className="font-semibold text-[#FA4616] mb-2">HEX Token</h4>
              <code className="block text-sm text-white/80 bg-black/30 p-2 rounded">
                0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39
              </code>
              <p className="mt-2 text-sm text-white/70">
                High-yield blockchain certificate of deposit protocol
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
