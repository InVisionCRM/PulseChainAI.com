# ✅ AI Prompt for JSON Audit Output Formatting

## 🔹 Instructions for AI:

You are to output the results of your Solidity audit **strictly in JSON format** according to the structure outlined below. This ensures machine-readable results that can be consumed programmatically by other tools or services.

---

## 🔹 Output Format Specification

### 1. Contract Overview

```json
{
  "contract_name": "MyToken",
  "description": "ERC20-compatible token with custom mint and burn logic.",
  "compiler_version": "0.8.19",
  "is_upgradeable": false,
  "implements": ["IERC20"],
  "total_functions": 14
}
```

---

### 2. Function-by-Function Breakdown

Output an array of objects like:

```json
[
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
]
```

---

### 3. Issue Summary

```json
[
  {
    "issue": "Unprotected withdraw function",
    "location": "withdraw()",
    "severity": "High",
    "impact": "Attacker can drain contract",
    "recommendation": "Add onlyOwner modifier or access control"
  },
  {
    "issue": "Missing event on state change",
    "location": "mint()",
    "severity": "Informational",
    "impact": "Lack of traceability",
    "recommendation": "Emit event after mint"
  }
]
```

---

### 4. Security Checklist

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

### 5. Deep Risk Analysis

```json
{
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
}
```

---

### 6. Test Summary

```json
{
  "unit_tests_present": true,
  "coverage_percent": 92.7,
  "tools_used": ["Foundry", "Hardhat"],
  "missing_edge_cases": [
    "zero address input",
    "transfer to self"
  ],
  "recommended_fuzz_invariants": [
    "balance sum consistency",
    "non-zero supply only if token is active"
  ]
}
```

---

### 7. Final Verdict

```json
{
  "summary": "Contract contains high-severity issues that must be addressed before deployment.",
  "recommendations": [
    "Fix unprotected withdraw",
    "Add event emission for state changes",
    "Harden fallback function"
  ]
}
```

---

## 🔹 Behavior Enforcement

- Format every result as **pure JSON**, no markdown or text commentary
- Reject formatting like code blocks or narrative explanation
- Use camelCase keys
- Output MUST be JSON-valid and well-formed

---

Use this formatting standard to ensure results can be piped into analytics, UIs, dashboards, or automated review workflows.

