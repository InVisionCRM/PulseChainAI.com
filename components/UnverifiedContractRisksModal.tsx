import React from 'react';
import { motion } from "framer-motion";

interface UnverifiedContractRisksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UnverifiedContractRisksModal: React.FC<UnverifiedContractRisksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-slate-800/95 backdrop-blur-sm border border-slate-600/50 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">⚠️ Unverified Contract Detected</h2>
              <p className="text-slate-400 text-sm">This contract could not be loaded - potential security risks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-700/50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="prose prose-invert max-w-none">
            {/* Warning Note */}
            <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-6">
              <p className="text-yellow-200 text-sm leading-relaxed">
                <strong>⚠️ Note:</strong> Not all unverified code is malicious by default. However, in ecosystems like PulseChain, the frequency and scale of malicious unverified contracts is significantly higher, making trust without transparency a major risk factor.
              </p>
            </div>

            {/* Main Content */}
            <div className="space-y-6 text-slate-300">
              <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-red-400">🚫</span>
                  Core Problems with Unverified Contracts
                </h3>
                
                <div className="space-y-4">
                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                    <h4 className="text-lg font-semibold text-white mb-2">1. Lack of Source Code Transparency</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>The contract source is not published or verified on-chain (e.g., Etherscan), leaving only the compiled bytecode available.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>Users cannot read or audit the logic in Solidity.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>There is no way to verify that the bytecode matches what the deployer claims the contract does.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                    <h4 className="text-lg font-semibold text-white mb-2">2. Obscured Logic and Hidden Behavior</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>Complex or malicious behaviors may be hidden in internal fallback or delegatecall mechanisms</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>Proxies pointing to different implementations over time</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>Time-based or access-controlled logic</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>The absence of named variables and function identifiers prevents understanding what actions a call will trigger.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                    <h4 className="text-lg font-semibold text-white mb-2">3. Potential for Rug Pulls and Theft</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>Without verified logic, functions may contain hardcoded drain mechanisms or stealth ownership modifiers.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>Mint, transfer, or withdraw functions may be intentionally mislabeled or misrepresented in the ABI.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>Ownership can be obscured or reassigned through misleading proxy delegation or self-destruct logic.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                    <h4 className="text-lg font-semibold text-white mb-2">4. Deceptive ABI and UI Integration</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>Frontend apps (DApps, web wallets) may show fake method names by using a mismatched ABI.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>Signing a transaction may trigger logic completely unrelated to what the user sees.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-400 mt-1">•</span>
                        <span>Function selectors can be reused or spoofed for unrelated/malicious actions.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-orange-400">🧨</span>
                  Why Decompiling Bytecode is Not Reliable
                </h3>
                
                <div className="space-y-4">
                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                    <h4 className="text-lg font-semibold text-white mb-2">1. Loss of Semantics in Compilation</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-orange-400 mt-1">•</span>
                        <span>Solidity compiles into EVM bytecode, which discards all high-level constructs: variable names, function names, comments or logical groupings</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-400 mt-1">•</span>
                        <span>Reconstructed code becomes unreadable and generic, often filled with <code className="bg-slate-600 px-1 rounded">func_xxxxxx()</code> or meaningless labels.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                    <h4 className="text-lg font-semibold text-white mb-2">2. Control Flow Obfuscation</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-orange-400 mt-1">•</span>
                        <span>Malicious contracts can deliberately obfuscate their logic during compilation using unused branching, reentrant loops, assembly-based detours and opaque predicates</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-400 mt-1">•</span>
                        <span>This renders decompilation output misleading or impossible to trace properly.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                    <h4 className="text-lg font-semibold text-white mb-2">3. No Guarantee of Accuracy</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-orange-400 mt-1">•</span>
                        <span>Decompilers infer logic and patterns based on opcode heuristics.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-400 mt-1">•</span>
                        <span>Recovered functions may be merged, skipped, or misrepresented.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-400 mt-1">•</span>
                        <span>Edge-case instructions (e.g., <code className="bg-slate-600 px-1 rounded">create2</code>, <code className="bg-slate-600 px-1 rounded">delegatecall</code>) often cannot be interpreted without real runtime analysis.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-purple-400">🧪</span>
                  Malicious Example: Decompiler Exploitation
                </h3>
                
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                  <h4 className="text-lg font-semibold text-white mb-3">Scenario: Backdoor in an Unverified Contract</h4>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1 font-bold">1.</span>
                      <span>A malicious developer writes a Solidity contract with hidden logic: standard <code className="bg-slate-600 px-1 rounded">transfer()</code> function appears to send tokens, but an inline assembly block checks <code className="bg-slate-600 px-1 rounded">msg.sender == 0xDeployerAddress</code> and transfers all funds if true.</span>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1 font-bold">2.</span>
                      <span>Contract is compiled with high optimization and inline assembly, obfuscating branching logic and storing key opcodes in memory for indirect execution.</span>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1 font-bold">3.</span>
                      <span>Contract is deployed but not verified. User inspects bytecode and runs a decompiler, but decompiled output shows opaque low-level operations that appear harmless.</span>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1 font-bold">4.</span>
                      <span>User approves contract to move tokens. Malicious <code className="bg-slate-600 px-1 rounded">withdraw()</code> drains all assets when triggered by the attacker, with no warning visible in the ABI or frontend.</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Summary */}
              <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-6">
                <h3 className="text-xl font-bold text-red-200 mb-3 flex items-center gap-2">
                  <span>⚠️</span>
                  Summary
                </h3>
                <ul className="space-y-2 text-red-100">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">•</span>
                    <span>Interacting with unverified contracts is inherently unsafe due to opaque logic, high obfuscation potential, and unverifiable claims.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">•</span>
                    <span>Decompiling bytecode does not solve the problem due to semantic loss, obfuscation, and lack of reliability.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-1">•</span>
                    <span>Any decision made based solely on decompiled output is guesswork, not audit.</span>
                  </li>
                </ul>
                
                <div className="mt-4 p-4 bg-red-800/30 rounded-lg border border-red-600/30">
                  <p className="text-red-200 font-semibold text-center">
                    In critical systems like DeFi, governance, staking, or asset custody, <strong>"unverified" means "untrusted by default."</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700/50 bg-slate-800/50">
          <div className="flex justify-between items-center">
            <p className="text-slate-400 text-sm">
              This information is provided for educational purposes only.
            </p>
            <button
              onClick={onClose}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
            >
              I Understand the Risks
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UnverifiedContractRisksModal; 