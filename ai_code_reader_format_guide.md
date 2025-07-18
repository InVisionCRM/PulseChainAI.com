
# 🧠 AI Code Reader Format Guide for Smart Contract Analysis

Use this formatting template for **all smart contract code parsing, interaction analysis, and dependency inspection.** The format is structured for clarity, rapid scanning, and high relevance.

---

## ✅ **Standard Response Structure**

### 1. 📌 **High-Level Purpose or Summary**
Begin with a brief 1-2 sentence summary of what the contract does.

---

### 2. 🔍 **External Contract Interactions**

#### 📦 Categorize by Function and Intent:

Use bullet-point grouping to show **purpose-based interaction**.

### ✅ External Contracts (Direct or Interface-Based Interactions)

1. ### 🔁 Uniswap V2 & V3
   - **`IUniswapV2Router02`**
     - *Used for*: Liquidity provisioning, token swaps
     - *Function calls*: `addLiquidityETH`, `swapExactTokensForTokensSupportingFeeOnTransferTokens`
   - **`IUniswapV2Factory`**
     - *Creates* the V2 LP pair
   - **`IUniswapV2Pair`**
     - *Queried* for `getReserves()` to verify V2 pools
   - **`IUniswapV3PoolImmutables`**
     - *Used to detect and block* V3 LPs via `fee()`

2. ### 🏦 ERC20 Interactions
   - **`IERC20`**
     - *Purpose*: Interacting with reward tokens, LP tokens
     - *Token example*: `rewardToken = 0x2b59...` (Hex)
     - *Functions used*: `transfer`, `approve`, `balanceOf`

3. ### 📊 Internal System Contracts
   - **`TokenDividendTracker`**
     - *Role*: Handles reward distribution logic
     - *Functions called*: `setBalance`, `process`, `excludeFromDividends`, etc.
   - **`SuperStakeImpl`**
     - *Role*: Staking backend logic
     - *Functions called*: `afterReceivedHex`, `withdrawTokens`, etc.

4. ### 📦 Interface Contracts
   - **`IMultisend`**
     - *Implements*: `multisend`, `multisendFrom`

5. ### 🛑 Not Used but Imported
   - **`GnosisSafe`**
     - *Status*: Imported but not instantiated or used

---

### 3. 📜 **Function-Specific Contract Calls**

### 🔧 Function: `openTrading()`

- **Calls:**
  - `IUniswapV2Factory.createPair(...)`
  - `IUniswapV2Router02.addLiquidityETH(...)`
  - `TokenDividendTracker.excludeFromDividends(...)`

---

### 4. 🗃️ **Contract Dependency Table (Summary Format)**

| Contract                         | Purpose                     | Interaction Type      |
|----------------------------------|------------------------------|------------------------|
| `IUniswapV2Router02`             | LP and Swap engine           | External direct call   |
| `TokenDividendTracker`          | Reward distributor           | Internal custom logic  |
| `SuperStakeImpl`                | Staking backend              | Internal custom logic  |
| `IERC20`                        | Token standard interaction   | External token logic   |
| `IUniswapV3PoolImmutables`      | LP detection (v3)            | Interface only         |
| `GnosisSafe`                    | Multisig (unused)            | Imported only          |

---

### 5. 📚 **Prompt for AI Use**

> “List all functions that interact with `TokenDividendTracker`, and explain which require owner permissions.”

> “Generate a test harness for `doTaxes()` with mocks for `IERC20`, `SuperStakeImpl`, and `TokenDividendTracker`.”

---

## ⚙️ Styling Instructions for AI Formatting Engines

| Style Element | Purpose                         | Markdown Example |
|---------------|----------------------------------|------------------|
| `**bold**`    | Contract or file names           | `**SuperStakeImpl**` |
| `*italic*`    | Descriptive usage or note        | `*Used to swap tokens*` |
| Bullet lists  | Group similar components         | `- Item` |
| Tables        | High-level summary               | See examples above |
| Numbered lists | Step-by-step process explanation | `1. Initialize...` |
| Emojis        | Aid scannability for humans      | `✅`, `🔁`, `📊` |
