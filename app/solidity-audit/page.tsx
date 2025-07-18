"use client";
import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { MultiStepLoader } from "@/components/ui/multi-step-loader";
import { useGemini } from "@/lib/hooks/useGemini";
import { 
  IconShieldCheck, 
  IconSend, 
  IconCode, 
  IconAlertTriangle,
  IconX,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconSearch
} from "@tabler/icons-react";

// Collapsible Section Component
function CollapsibleSection({ 
  title, 
  children, 
  isExpanded, 
  onToggle 
}: { 
  title: string; 
  children: React.ReactNode; 
  isExpanded: boolean; 
  onToggle: () => void; 
}) {
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-3 bg-gray-800 hover:bg-gray-700 flex items-center justify-between text-left transition-colors"
      >
        <span className="font-semibold text-white">{title}</span>
        {isExpanded ? (
          <IconChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <IconChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="p-4 bg-gray-800/50"
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}

// Audit Report Display Component
function AuditReportDisplay({ data }: { data: AuditData }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));
  const [searchTerm, setSearchTerm] = useState("");

  // Validate data structure
  if (!data || typeof data !== 'object') {
    return (
      <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
        <p className="text-red-300 text-sm">Invalid audit data structure</p>
      </div>
    );
  }

  // Ensure required fields exist
  const safeData = {
    contract_overview: data.contract_overview || { contract_name: 'Unknown', description: '', compiler_version: '', is_upgradeable: false, implements: [], total_functions: 0 },
    issue_summary: data.issue_summary || [],
    function_breakdown: data.function_breakdown || [],
    security_checklist: data.security_checklist || {
      access_control_enforced: false,
      reentrancy_protected: false,
      math_safe: false,
      oracle_data_validated: false,
      fallback_or_receive_handled: false,
      pause_mechanism_present: false,
      upgradeable_safe: false
    },
    deep_risk_analysis: data.deep_risk_analysis || {
      assumptions: [],
      grief_vectors: [],
      economic_attacks: [],
      critical_invariants: [],
      intent_vs_implementation_issues: []
    },
    final_verdict: data.final_verdict || {
      summary: 'Analysis completed',
      recommendations: []
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Calculate security score
  const securityScore = (() => {
    const issues = safeData.issue_summary || [];
    const criticalCount = issues.filter(i => i.severity === 'Critical').length;
    const highCount = issues.filter(i => i.severity === 'High').length;
    const mediumCount = issues.filter(i => i.severity === 'Medium').length;
    const lowCount = issues.filter(i => i.severity === 'Low').length;
    const gasCount = issues.filter(i => i.severity === 'Gas').length;
    return Math.max(0, 100 - (criticalCount * 25) - (highCount * 15) - (mediumCount * 10) - (lowCount * 5) - (gasCount * 3));
  })();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-500 text-white';
      case 'High': return 'bg-orange-500 text-white';
      case 'Medium': return 'bg-yellow-500 text-black';
      case 'Low': return 'bg-green-500 text-white';
      case 'Gas': return 'bg-blue-500 text-white';
      case 'Informational': return 'bg-purple-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'Critical': return '🔴';
      case 'High': return '🟠';
      case 'Medium': return '🟡';
      case 'Low': return '🟢';
      case 'Gas': return '⛽';
      case 'Informational': return 'ℹ️';
      default: return '⚪';
    }
  };

  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">📊 Audit Summary</h3>
          <div className="text-right">
            <div className="text-2xl font-bold">{securityScore}/100</div>
            <div className="text-sm opacity-90">Security Score</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="text-center">
            <div className="font-bold">{safeData.contract_overview.contract_name}</div>
            <div className="opacity-80">Contract</div>
          </div>
          <div className="text-center">
            <div className="font-bold">{safeData.issue_summary.length}</div>
            <div className="opacity-80">Total Issues</div>
          </div>
          <div className="text-center">
            <div className="font-bold">{safeData.issue_summary.filter(i => i.severity === 'Critical').length}</div>
            <div className="opacity-80">Critical</div>
          </div>
          <div className="text-center">
            <div className="font-bold">{safeData.issue_summary.filter(i => i.severity === 'High').length}</div>
            <div className="opacity-80">High</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search findings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Security Findings */}
      <CollapsibleSection
        title={`🚨 Security Findings (${safeData.issue_summary.length})`}
        isExpanded={expandedSections.has('findings')}
        onToggle={() => toggleSection('findings')}
      >
        <div className="space-y-3">
          {(() => {
            console.log('Rendering issue_summary map, data:', safeData.issue_summary);
            return safeData.issue_summary
              .filter(issue => 
                searchTerm === '' || 
                issue.issue.toLowerCase().includes(searchTerm.toLowerCase()) ||
                issue.location.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((issue, index) => {
                console.log('Rendering issue item:', issue, 'at index:', index);
                return (
              <div key={index} className="bg-gray-700 rounded-lg p-3 border-l-4" style={{ borderLeftColor: getSeverityColor(issue.severity).includes('red') ? '#ef4444' : getSeverityColor(issue.severity).includes('orange') ? '#f97316' : getSeverityColor(issue.severity).includes('yellow') ? '#eab308' : '#22c55e' }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getSeverityIcon(issue.severity)}</span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getSeverityColor(issue.severity)}`}>
                      {issue.severity}
                    </span>
                    <span className="text-gray-400 text-sm">{issue.location}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(issue.recommendation)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <IconCopy className="w-4 h-4" />
                  </button>
                </div>
                <h4 className="font-semibold text-white mb-1">{issue.issue}</h4>
                <p className="text-gray-300 text-sm mb-2">{issue.impact}</p>
                <p className="text-blue-300 text-sm">{issue.recommendation}</p>
              </div>
            );
              });
          })()}
        </div>
      </CollapsibleSection>

      {/* Function Analysis */}
      <CollapsibleSection
        title={`🔧 Function Analysis (${safeData.function_breakdown.length})`}
        isExpanded={expandedSections.has('functions')}
        onToggle={() => toggleSection('functions')}
      >
        <div className="space-y-4">
          {(() => {
            console.log('Rendering function_breakdown map, data:', safeData.function_breakdown);
            return safeData.function_breakdown.map((func, index) => {
              console.log('Rendering function item:,func, at index:', index);
              return (
            <div key={index} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-bold text-white">{func.function_name}</h4>
                <span className="px-3 py-1 bg-blue-500 text-blue-300 rounded-full text-sm font-medium">{func.visibility}</span>
              </div>
              
              {/* Function Signature */}
              <div className="mb-4 bg-gray-800 rounded-lg border border-gray-600">
                <div className="text-gray-400 text-sm mb-1">Function Signature:</div>
                <code className="text-green-300 text-sm font-mono break-all">{func.signature}</code>
              </div>
              
              {/* What This Function Does */}
              <div className="mb-4">
                <h5 className="text-blue-300 font-semibold mb-2">📝 What This Function Does:</h5>
                <p className="text-gray-200 leading-relaxed">{func.description}</p>
              </div>
              
              {/* Function Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h5 className="text-blue-300 font-semibold mb-2">🔍 Reads:</h5>
                  {func.reads.length > 0 ? (
                    <ul className="space-y-1">
                      {func.reads.map((read, rIndex) => (
                        <li key={rIndex} className="text-gray-300 text-sm">• {read}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 text-sm">No state variables read</p>
                  )}
                </div>
                
                <div>
                  <h5 className="text-blue-300 font-semibold mb-2">✏️ Writes:</h5>
                  {func.writes.length > 0 ? (
                    <ul className="space-y-1">
                      {func.writes.map((write, wIndex) => (
                        <li key={wIndex} className="text-gray-300 text-sm">• {write}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 text-sm">No state variables modified</p>
                  )}
                </div>
              </div>
              
              {/* Events and External Calls */}
              {(func.events_emitted.length > 0 || func.external_calls.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {func.events_emitted.length > 0 && (
                    <div>
                      <h5 className="text-blue-300 font-semibold mb-2">📢 Events Emitted:</h5>
                      <ul className="space-y-1">
                        {func.events_emitted.map((event, eIndex) => (
                          <li key={eIndex} className="text-gray-300 text-sm">• {event}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {func.external_calls.length > 0 && (
                    <div>
                      <h5 className="text-blue-300 font-semibold mb-2">🔗 External Calls:</h5>
                      <ul className="space-y-1">
                        {func.external_calls.map((call, cIndex) => (
                          <li key={cIndex} className="text-gray-300 text-sm">• {call}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              {/* Access Control */}
              {func.access_control && (
                <div className="mb-4 p-3 bg-blue-500 rounded-lg border border-blue-500/30">
                  <h5 className="text-blue-300 font-semibold mb-1">🔐 Access Control:</h5>
                  <p className="text-gray-200 text-sm">{func.access_control}</p>
                </div>
              )}
              
              {/* Modifiers */}
              {func.modifiers.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-blue-300 font-semibold mb-2">⚡ Modifiers Applied:</h5>
                  <div className="flex flex-wrap gap-2">
                    {func.modifiers.map((modifier, mIndex) => (
                      <span key={mIndex} className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-sm">
                        {modifier}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
            });
          })()}
        </div>
      </CollapsibleSection>

      {/* Security Checklist */}
      <CollapsibleSection
        title="✅ Security Checklist"
        isExpanded={expandedSections.has('checklist')}
        onToggle={() => toggleSection('checklist')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(() => {
            console.log('Rendering security_checklist map, data:', safeData.security_checklist);
            return Object.entries(safeData.security_checklist).map(([key, value]) => {
              console.log('Rendering security checklist item:', key, value);
              return (
            <div key={key} className={`flex items-center gap-3 p-3 rounded-lg ${value ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
              <span className="text-xl">{value ? '✅' : '❌'}</span>
              <div>
                <div className="font-semibold text-white">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                <div className="text-sm text-gray-300">{value ? 'Passed' : 'Failed'}</div>
              </div>
            </div>
          );
            });
          })()}
        </div>
      </CollapsibleSection>

      {/* Risk Analysis */}
      <CollapsibleSection
        title="🧐 Risk Analysis"
        isExpanded={expandedSections.has('risks')}
        onToggle={() => toggleSection('risks')}
      >
        <div className="space-y-4">
          {(() => {
            console.log('Rendering deep_risk_analysis map, data:', safeData.deep_risk_analysis);
            return Object.entries(safeData.deep_risk_analysis).map(([category, items]) => {
              console.log('Rendering risk analysis category:', category, items);
              return (
            <div key={category} className="bg-gray-700 rounded-lg p-3">
              <h4 className="font-semibold text-white mb-2 capitalize">{category.replace(/_/g, ' ')}</h4>
              {items.length > 0 ? (
                <div className="space-y-1">
                  {(() => {
                    console.log('Rendering risk analysis items map, data:', items);
                    return items.map((item, index) => {
                      console.log('Rendering risk analysis item:', item, 'at index:', index);
                      // Handle both string and object cases
                      const itemText = typeof item === 'string' ? item : 
                        item.explanation || item.location || JSON.stringify(item);
                      return <div key={index} className="text-gray-300 text-sm">• {itemText}</div>;
                    });
                  })()}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">No items identified</div>
              )}
            </div>
          );
            });
          })()}
        </div>
      </CollapsibleSection>

      {/* Recommendations */}
      <CollapsibleSection
        title={`📋 Recommendations (${safeData.final_verdict.recommendations.length})`}
        isExpanded={expandedSections.has('recommendations')}
        onToggle={() => toggleSection('recommendations')}
      >
        <div className="space-y-3">
          {(() => {
            console.log('Rendering recommendations map, data:', safeData.final_verdict.recommendations);
            return safeData.final_verdict.recommendations.map((rec, index) => {
              console.log('Rendering recommendation item:', rec, 'at index:', index);
              return (
            <div key={index} className="flex items-start gap-3 p-3 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <span className="text-blue-400 font-bold">{index + 1}.</span>
              <div className="flex-1">
                <p className="text-white">{rec}</p>
                <button
                  onClick={() => copyToClipboard(rec)}
                  className="text-blue-400 hover:text-blue-300 text-sm mt-1 flex items-center gap-1"
                >
                  <IconCopy className="w-3 h-3" />
                  Copy
                </button>
              </div>
            </div>
          );
            });
          })()}
        </div>
      </CollapsibleSection>
    </div>
  );
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  type?: 'info' | 'warning' | 'error' | 'success';
  contractCode?: string;
  contractName?: string;
  thoughts?: string;
  parsedData?: AuditData;
}

interface AuditData {
  contract_overview: {
    contract_name: string;
    description: string;
    compiler_version: string;
    is_upgradeable: boolean;
    implements: string[];
    total_functions: number;
  };
  function_breakdown: Array<{
    function_name: string;
    signature: string;
    description: string;
    visibility: string;
    modifiers: string[];
    state_mutability: string;
    reads: string[];
    writes: string[];
    events_emitted: string[];
    external_calls: string[];
    access_control: string;
    attack_surface: {
      reentrancy: boolean;
      front_running: boolean;
      oracle_dependency: boolean;
      griefing: boolean;
    };
    intent_vs_implementation: {
      drift_detected: boolean;
      explanation: string;
    };
    vulnerabilities: (string | { issue: string; location?: string; severity?: string; impact?: string; recommendation?: string })[];
    gas_optimizations: string[];
  }>;
  issue_summary: Array<{
    issue: string;
    location: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Gas' | 'Informational';
    impact: string;
    recommendation: string;
  }>;
  security_checklist: {
    access_control_enforced: boolean;
    reentrancy_protected: boolean;
    math_safe: boolean;
    oracle_data_validated: boolean;
    fallback_or_receive_handled: boolean;
    pause_mechanism_present: boolean;
    upgradeable_safe: boolean;
  };
  deep_risk_analysis: {
    assumptions: (string | { location?: string; drift_detected?: boolean; explanation?: string })[];
    grief_vectors: (string | { location?: string; drift_detected?: boolean; explanation?: string })[];
    economic_attacks: (string | { location?: string; drift_detected?: boolean; explanation?: string })[];
    critical_invariants: (string | { location?: string; drift_detected?: boolean; explanation?: string })[];
    intent_vs_implementation_issues: (string | { location?: string; drift_detected?: boolean; explanation?: string })[];
  };
  final_verdict: {
    summary: string;
    recommendations: string[];
  };
}

export default function SolidityAuditPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your Solidity Contract Audit AI. I can analyze smart contracts for security vulnerabilities, gas optimization, and best practices. Please paste your contract code or describe what you'd like me to audit.",
      sender: 'ai',
      timestamp: new Date(),
      type: 'info'
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [contractName, setContractName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [currentThoughts, setCurrentThoughts] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [loaderStep, setLoaderStep] = useState(0);
  
  const loadingStates = [
    { text: "Initializing AI Auditor...", type: "step" as const },
    { text: "Analyzing contract structure...", type: "step" as const },
    { text: currentThoughts ? "AI is thinking..." : "Thinking through security implications...", type: "thought" as const },
    { text: currentAnswer ? "Generating response..." : "Generating comprehensive analysis...", type: "answer" as const },
    { text: "Finalizing audit report...", type: "step" as const }
  ];

  const { generate, isLoading, error } = useGemini({
    includeThoughts: true,
    onThoughtUpdate: (thoughts) => {
      setCurrentThoughts(thoughts);
      if (loaderStep === 2 && thoughts.length > 0) {
        // Keep on step 2 until thoughts are complete
      }
    },
    onAnswerUpdate: (answer) => {
      setCurrentAnswer(answer);
      if (loaderStep === 2 && answer.length > 0) {
        setTimeout(() => {
          setLoaderStep(3);
        }, 1000);
      }
      if (loaderStep === 3 && answer.length > 0) {
        setTimeout(() => {
          setLoaderStep(4);
        }, 2000);
      }
    },
    onComplete: (finalThoughts, finalAnswer) => {
      // Try to parse the JSON response
      let parsedData: AuditData | undefined;
      try {
        const jsonMatch = finalAnswer.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Validate the parsed data has required fields
          if (parsed && typeof parsed === 'object' && 
              parsed.contract_overview && 
              parsed.issue_summary && 
              parsed.function_breakdown && 
              parsed.security_checklist && 
              parsed.deep_risk_analysis && 
              parsed.final_verdict) {
            parsedData = parsed as AuditData;
          } else {
            console.warn('Parsed JSON missing required fields:', parsed);
          }
        }
      } catch (error) {
        console.warn('Failed to parse AI response as JSON:', error);
      }

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: finalAnswer,
        thoughts: finalThoughts,
        sender: 'ai',
        timestamp: new Date(),
        type: parsedData ? 'success' : 'info',
        parsedData
      };
      setMessages(prev => [...prev, aiResponse]);
      setCurrentThoughts("");
      setCurrentAnswer("");
      setIsStreaming(false);
      setLoaderStep(0);
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date(),
      contractCode: inputMessage.includes('contract') || inputMessage.includes('function') ? inputMessage : undefined,
      contractName: contractName || 'Smart Contract'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");

    try {
      const prompt = `# 🔍 Solidity Smart Contract AI Audit

You are a Solidity auditing agent. Perform a **deep, layered audit** using the following comprehensive analysis framework.

## 🔹 Input Contract

${inputMessage}

---

## 🔹 Audit Tasks

### 1. 📋 Function-by-Function Breakdown

Analyze each function individually with this format:

\`\`\`json
{
  "function_name": "transfer",
  "signature": "function transfer(address to, uint256 amount) external returns (bool)",
  "description": "Transfers tokens to a recipient",
  "visibility": "external",
  "modifiers": ["onlyOwner"],
  "state_mutability": "nonpayable",
  "reads": ["balances[msg.sender]"],
  "writes": ["balances[msg.sender]", "balances[to]"],
  "events_emitted": ["Transfer(address,address,uint256)"],
  "external_calls": [],
  "access_control": "onlyOwner",
  "attack_surface": {
    "reentrancy": false,
    "front_running": false,
    "oracle_dependency": false,
    "griefing": false
  },
  "intent_vs_implementation": {
    "drift_detected": false,
    "explanation": "Function performs as described and named."
  },
  "vulnerabilities": [],
  "gas_optimizations": []
}
\`\`\`

### 2. 🚨 Security Findings

List all security issues categorized by severity:

- \`Critical\` – Immediate loss or exploit
- \`High\` – Exploitable logic or access flaw
- \`Medium\` – Risky pattern or misused feature
- \`Low\` – Mild bug, uncommon scenario
- \`Gas\` – Inefficient operations
- \`Informational\` – Commenting, formatting, naming, etc.

### 3. 🔒 Security Checklist

Mark each of these \`true\` or \`false\`:

\`\`\`json
{
  "access_control_enforced": true,
  "reentrancy_protected": true,
  "math_safe": true,
  "oracle_data_validated": false,
  "fallback_or_receive_handled": false,
  "pause_mechanism_present": false,
  "upgradeable_safe": true
}
\`\`\`

### 4. 🧐 Deep Risk Analysis

Answer the following in clear, structured language:

- What assumptions does this contract make about its environment?
- Can any funds be permanently locked due to logic or access control?
- Can users grief others (e.g. block usage, spam gas)?
- Can roles like \`owner\` or \`admin\` act maliciously or too broadly?
- Are there any economic attack vectors (MEV, oracle, sandwich)?
- What invariants must always hold true?
- Are there misleading function/variable names vs behavior?
- Is there any **intent vs. implementation drift** (function name or comment does not match logic)?

### 5. 📦 Final Output Format

Provide a comprehensive report with these sections:

1. **Contract Overview**
2. **Function-by-Function Breakdown**
3. **Intent vs. Implementation Drift Summary**
4. **Issue Summary (by severity)**
5. **Security Checklist**
6. **Deep Risk Analysis**
7. **Final Recommendations**

## ✅ Final Instructions

Be precise and skeptical. Your job is to:

- Question **all assumptions**
- Identify **intent vs. implementation drift**
- Flag **access control** flaws
- Prevent **economic and logical exploits**
- Recommend **clear, testable improvements**
 Provide code suggestions and test case recommendations wherever applicable.

---

## 🔹 JSON Output Format Instructions

You are to output the results of your Solidity audit **strictly in JSON format** according to the structure outlined below. This ensures machine-readable results that can be consumed programmatically by other tools or services.

### Required JSON Structure:

\`\`\`json
{
  "contract_overview": {
    "contract_name": "MyToken",
    "description": "ERC20-compatible token with custom mint and burn logic.",
    "compiler_version": "0.8.19",
    "is_upgradeable": false,
    "implements": ["IERC20"],
    "total_functions": 14
  },
  "function_breakdown": [
    {
      "function_name": "transfer",
      "signature": "function transfer(address to, uint256 amount) external returns (bool)",
      "description": "Transfers tokens to a recipient",
      "visibility": "external",
      "modifiers": ["onlyOwner"],
      "state_mutability": "nonpayable",
      "reads": ["balances[msg.sender]"],
      "writes": ["balances[msg.sender]", "balances[to]"],
      "events_emitted": ["Transfer(address,address,uint256)"],
      "external_calls": [],
      "access_control": "onlyOwner",
      "attack_surface": {
        "reentrancy": false,
        "front_running": false,
        "oracle_dependency": false,
        "griefing": false
      },
      "intent_vs_implementation": {
        "drift_detected": false,
        "explanation": "Function performs as described and named."
      },
      "vulnerabilities": [],
      "gas_optimizations": []
    }
  ],
  "issue_summary": [
    {
      "issue": "Unprotected withdraw function",
      "location": "withdraw()",
      "severity": "High",
      "impact": "Attacker can drain contract",
      "recommendation": "Add onlyOwner modifier or access control"
    }
  ],
  "security_checklist": {
    "access_control_enforced": true,
    "reentrancy_protected": true,
    "math_safe": true,
    "oracle_data_validated": false,
    "fallback_or_receive_handled": false,
    "pause_mechanism_present": false,
    "upgradeable_safe": true
  },
  "deep_risk_analysis": {
    "assumptions": [
      "Owner will not act maliciously",
      "ERC20 functions are trusted via inheritance"
    ],
    "grief_vectors": [
      "Gas griefing possible on repeated low-value transfers"
    ],
    "economic_attacks": [
      "None detected"
    ],
    "critical_invariants": [
      "totalSupply must never exceed cap",
      "balances[msg.sender] must be >= transfer amount"
    ],
    "intent_vs_implementation_issues": []
  },
  "final_verdict": {
    "summary": "Contract contains high-severity issues that must be addressed before deployment.",
    "recommendations": [
      "Fix unprotected withdraw",
      "Add event emission for state changes",
      "Harden fallback function"
    ]
  }
}
\`\`\`

### Behavior Enforcement:

- Format every result as **pure JSON**, no markdown or text commentary
- Reject formatting like code blocks or narrative explanation
- Use camelCase keys
- Output MUST be JSON-valid and well-formed
- Ensure all arrays and objects are properly structured
- Include all required fields even if empty arrays/objects

Please perform a comprehensive audit of the provided contract and output the results in the exact JSON format specified above.`;
      
      setIsStreaming(true);
      setCurrentThoughts("");
      setCurrentAnswer("");
      setLoaderStep(0);
      
      setTimeout(() => setLoaderStep(1), 1500);
      setTimeout(() => setLoaderStep(2), 3000);
      
      await generate(prompt);
    } catch (error) {
      console.error("Error generating response:", error);
      
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: "I apologize, but I encountered an error while analyzing your contract. Please try again or check your connection.",
        sender: 'ai',
        timestamp: new Date(),
        type: 'error'
      };
      
      setMessages(prev => [...prev, errorResponse]);
      setIsStreaming(false);
    }
  };

  const getMessageIcon = (type?: string) => {
    switch (type) {
      case 'warning':
        return <IconAlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <IconX className="w-5 h-5 text-red-500" />;
      case 'success':
        return <IconCheck className="w-5 h-5 text-green-500" />;
      default:
        return <IconShieldCheck className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* MultiStepLoader with Thought Streaming */}
      <MultiStepLoader
        loadingStates={loadingStates}
        loading={isStreaming}
        duration={1500}
        loop={false}
        currentThoughts={currentThoughts}
        currentAnswer={currentAnswer}
        currentStep={loaderStep}
      />
      {/* Header */}
      <motion.div 
        className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800 p-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500">
            <IconShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Solidity Contract Audit</h1>
            <p className="text-gray-400">AI-powered smart contract security analysis</p>
          </div>
        </div>
      </motion.div>

      {/* Error Display */}
      {error && (
        <motion.div 
          className="max-w-6xl mx-auto px-6 mb-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-4 border-2 border-red-500/30">
            <h3 className="text-lg font-bold text-red-200 mb-2">Connection Error</h3>
            <p className="text-red-100 text-sm">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Chat Container */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="relative h-[calc(100vh-200px)] bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 overflow-hidden">
          <GlowingEffect 
            className="rounded-2xl"
            disabled={false}
            glow={true}
            spread={30}
            blur={20}
          />
          
          {/* Messages Area */}
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {(() => {
                console.log('Rendering messages map, data:', messages);
                return messages.map((message) => {
                  console.log('Rendering message item:', message);
                  return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${message.sender === 'user' ? 'order-2' : 'order-1'}`}>
                    <div className={`flex items-start gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      {message.sender === 'ai' && (
                        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex-shrink-0">
                          {getMessageIcon(message.type)}
                        </div>
                      )}
                      <div className={`rounded-2xl p-4 ${
                        message.sender === 'user' 
                          ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white' 
                          : 'bg-gray-800/50 text-gray-100 border border-gray-700'
                      }`}>
                        {message.parsedData ? (
                          <div className="w-full">
                            <AuditReportDisplay data={message.parsedData} />
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                        )}
                        
                        {/* Thought Summary */}
                        {message.thoughts && (
                          <div className="mt-4 p-3 bg-blue-900/30 rounded-lg border border-blue-500/30">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-blue-400 text-xs font-semibold">🧠 AI Thinking Process</span>
                            </div>
                            <p className="text-xs text-blue-200 leading-relaxed whitespace-pre-wrap">
                              {message.thoughts}
                            </p>
                          </div>
                        )}
                        
                        <p className={`text-xs mt-2 ${
                          message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
                );
                });
              })()}
              
              {isLoading && !isStreaming && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                      <IconShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <span className="text-gray-400 text-sm ml-2">Preparing analysis...</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-800 p-6">
              <div className="mb-4">
                <input
                  type="text"
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  placeholder="Contract Name (optional)"
                  className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              <form onSubmit={handleSendMessage} className="flex gap-4">
                <div className="flex-1 relative">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Paste your Solidity contract code or describe what you'd like me to audit..."
                    className="w-full p-4 pr-12 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-400 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    rows={3}
                    disabled={isLoading}
                  />
                  <IconCode className="absolute top-4 right-4 w-5 h-5 text-gray-500" />
                </div>
                <motion.button
                  type="submit"
                  disabled={isLoading || !inputMessage.trim()}
                  className="px-6 py-4 bg-gradient-to-br from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <IconSend className="w-5 h-5" />
                  Send
                </motion.button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 