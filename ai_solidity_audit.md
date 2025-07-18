# 🔍 Solidity Smart Contract AI Audit Prompt

## 🔹 Input Contract

Paste the full contract code below:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Paste full Solidity contract(s) here
```

---

## 🔹 Audit Tasks for AI

You are a Solidity auditing agent. Perform a **deep, layered audit** using the tasks and formats below.

---

## 1. 📋 Function-by-Function Breakdown

Analyze each function individually with this format:

```json
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
```

---

## 2. 🚨 Security Findings

List all security issues categorized by severity.

### ✅ Severity Levels

- `Critical` – Immediate loss or exploit
- `High` – Exploitable logic or access flaw
- `Medium` – Risky pattern or misused feature
- `Low` – Mild bug, uncommon scenario
- `Gas` – Inefficient operations
- `Informational` – Commenting, formatting, naming, etc.

```json
{
  "issue": "Unprotected withdraw function",
  "location": "withdraw()",
  "severity": "High",
  "impact": "Attacker can drain contract",
  "recommendation": "Add onlyOwner modifier or access control"
}
```

---

## 3. 🔒 Security Checklist

Mark each of these `true` or `false`:

```json
{
  "access_control_enforced": true,
  "reentrancy_protected": true,
  "math_safe": true,
  "oracle_data_validated": false,
  "fallback_or_receive_handled": false,
  "pause_mechanism_present": false,
  "upgradeable_safe": true
}
```

---

## 4. 🧐 Deep Risk Analysis

Answer the following in clear, structured language:

- What assumptions does this contract make about its environment?
- Can any funds be permanently locked due to logic or access control?
- Can users grief others (e.g. block usage, spam gas)?
- Can roles like `owner` or `admin` act maliciously or too broadly?
- Are there any economic attack vectors (MEV, oracle, sandwich)?
- What invariants must always hold true?
- Are there misleading function/variable names vs behavior?
- Is there any **intent vs. implementation drift** (function name or comment does not match logic)?

---

## 5. 🧪 Optional: Test Review

If test data is available, summarize with this format:

```json
{
  "unit_tests_present": true,
  "coverage_percent": 88.3,
  "missing_cases": ["zero-value transfer", "reentrancy path", "paused state"],
  "fuzz_testing_used": true,
  "tool": "Foundry",
  "suggested_invariants": [
    "balances[addr] >= 0",
    "totalSupply never exceeds cap",
    "contract state cannot change after paused"
  ]
}
```

---

## 6. 📦 Final Output Format

The final Markdown report must include these sections:

### 📝 Final Report Structure

1. Contract Overview
2. Function-by-Function Breakdown
3. Intent vs. Implementation Drift Summary
4. Issue Summary (by severity)
5. Security Checklist
6. Deep Risk Analysis
7. Test Coverage Summary (if applicable)
8. Final Recommendations

---

## ✅ Final Instructions for the AI

Be precise and skeptical. Your job is to:

- Question **all assumptions**
- Identify **intent vs. implementation drift**
- Flag **access control** flaws
- Prevent **economic and logical exploits**
- Recommend **clear, testable improvements**
 Provide code suggestions and test case recommendations wherever applicable.

