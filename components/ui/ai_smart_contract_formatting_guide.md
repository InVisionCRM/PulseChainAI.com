
# 🧠 AI Smart Contract Response Formatting Guide (`.md`)

This Markdown guide defines how an AI should format its **responses to any question** related to smart contracts, tokenomics, function analysis, contract interactions, audits, or token behavior.

---

## ✅ Universal Formatting Rules for AI Responses

### 1. **Use Section Headings**
- `##` for major response sections  
- `###` for subsections  
- Always use descriptive headers  
**Example**:
```markdown
## 🔍 External Contracts
### 🏦 ERC20 Token Interactions
```

---

### 2. **Use Bullet Points for Lists**
- Use `-` for unordered lists
- Group related items by purpose or category
- Always explain **what** and **why**  
**Example**:
```markdown
- `IERC20`: Standard token interface used for transfers and approvals
- `TokenDividendTracker`: Internal reward logic for dividends
```

---

### 3. **Use Numbered Lists for Steps or Ordered Logic**
- Use `1.`, `2.`, etc.
- Ideal for initialization, call sequence, setup flows  
**Example**:
```markdown
1. Initialize the router
2. Create LP pair
3. Add liquidity
```

---

### 4. **Use Bold for Key Names**
- For contract names, function names, variables, and interfaces  
**Example**:
```markdown
- **TokenDividendTracker** handles dividend distribution
- **_transfer** is the core ERC20 logic function
```

---

### 5. **Use Italics for Descriptions**
- Used to describe **purpose**, context, or extra notes  
**Example**:
```markdown
- *Used to swap tokens for rewardToken via Uniswap*
```

---

### 6. **Use Tables for Compact Overviews**
- Especially useful for summarizing dependencies or role mappings  
**Example**:
```markdown
| Contract         | Role                 | Source      |
|------------------|----------------------|-------------|
| IERC20           | Token interaction    | OpenZeppelin|
| SuperStakeImpl   | Staking logic        | Internal    |
```

---

### 7. **Use Code Blocks for Code Snippets**
- Use backticks (```) to enclose code  
- Preferred for function signatures, events, or examples  
**Example**:
```solidity
function openTrading(address nativeWrapped) public onlyOwner { ... }
```

---

### 8. **Use Emojis for Visual Anchoring (Optional)**
- Helps organize sections at a glance
- Suggested: `✅`, `🔧`, `🔍`, `⚠️`, `📊`, `📜`
- Keep them **minimal** and **relevant**

---

### 9. **Use Horizontal Rules (`---`) to Separate Major Sections**
- Improves visual hierarchy in longer responses

---

## 📌 Optional Prompts for AI Code Tools

> “Use this formatting style in all smart contract answers. Only change headings/content depending on the question. Do not hardcode example data unless requested.”
