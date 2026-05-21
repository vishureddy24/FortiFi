# FortiFi — Complete User Workflow Guide

This document describes every step a user takes when interacting with the FortiFi platform, from first visit to advanced institutional use. Each section maps the user action to the exact code that runs, the data that changes, and what the user sees on screen.

---

## OVERVIEW — Platform Pages

| Route | Page Name | Purpose |
|---|---|---|
| `/` | Lending Workspace | Supply and borrow assets — main DeFi interface |
| `/dashboard` | User Dashboard | Portfolio overview and security feed |
| `/portfolio` | Institutional Portfolio | Real-time position monitoring and analytics |
| `/security` | Security Monitor | Threat detection and alert timeline |
| `/governance` | Governance | DAO voting on protocol proposals |
| `/simulator` | Threat Simulator | Sandboxed attack scenario testing |
| `/enterprise` | Enterprise Cockpit | Institutional telemetry and SaaS analytics |
| `/admin` | Admin Console | Protocol administration and circuit breaker |

---

## WORKFLOW 1 — First Visit and Wallet Connection

### Step 1 — User opens the app

- Browser navigates to `http://localhost:3000`
- Next.js loads `pages/index.js` (Lending Workspace)
- `useWeb3()` provider initialises and checks for MetaMask
- If MetaMask is not installed → banner shows "Install MetaMask"
- If MetaMask is installed but not connected → banner shows "Connect Wallet" button
- If Ganache is offline → red banner shows "Local Blockchain Offline — Analytics Mode Active"

**What user sees:**
- Dark institutional UI with "Lending Workspace" heading
- Connection status banner at the top
- Supply Assets table and Borrow Assets table (empty or read-only)
- Net Worth shows $0.00

---

### Step 2 — User clicks "Connect Wallet"

- `connect()` from `useWeb3()` is called
- MetaMask popup opens asking for permission
- User approves → MetaMask returns wallet address (e.g. `0xAbC...123`)
- `account.data` is set to the wallet address
- `useEffect` in `index.js` fires → calls `GET /api/wallet-profile/:address`
- Backend returns or creates a `WalletProfile` document in MongoDB
- `walletCreditProfile` state is populated

**What user sees:**
- Connection banner disappears
- "Decentralized Credit Profile" card appears showing:
  - Credit Limit: 200 DAI
  - Available Credit: 200 DAI
  - Active Debt: 0 DAI
  - Trust Score: 100 pts
- Supply Assets and Borrow Assets tables populate with available tokens (LAR, DAI, WETH)

---

### Step 3 — Wallet switch or network change

- `window.ethereum.on('accountsChanged')` fires
- `useWalletPortfolio` hook updates `activeAddress` to new wallet
- Socket leaves old room `wallet:<old_address>`, joins `wallet:<new_address>`
- All portfolio data reloads for the new wallet

---

## WORKFLOW 2 — Supplying Collateral (LAR Token)

This is the first transaction a user must do before borrowing.

### Step 1 — User finds LAR in the Supply Assets table

- `useSupplyAssets()` hook reads available tokens from the contract
- LAR token row shows: balance, APY rate, collateral status
- User clicks the **Supply** button on the LAR row

**What code runs:**
```
RowSupplyAsset → onClick → setSelectedTokenToSupply(token)
```

---

### Step 2 — Supply Modal opens

- `ModalSupply` component renders with the selected LAR token
- User sees: token name, current balance, APY, input field for amount
- User types an amount (e.g. `100`)

---

### Step 3 — User clicks Confirm in the modal

**Code path:**
```
ModalSupply → onSupply(token, amount) → supplyToken() in index.js
```

**Step 3a — Approval transaction (if needed)**
```
tokenInst.methods.allowance(account, contract).call()
  → if allowance < amount:
    tokenInst.methods.approve(contract, amount).send()
    → MetaMask popup: "Approve LAR spending"
    → User confirms → tx sent to Ganache
    → transactionStep = "Approving LAR..."
```

**Step 3b — Supply transaction**
```
contract.methods.lend(tokenAddress, amountWei, requestId).send()
  → MetaMask popup: "Supply LAR to FortiFi"
  → User confirms → tx sent to Ganache
  → transactionStep = "Supplying LAR..."
```

---

### Step 4 — Transaction confirmed on-chain

**On-chain:**
```
LendingAndBorrowing.sol → lend() executes
  → transfers LAR from user to contract
  → emits Supply(from, asset, amount) event
```

**Backend (within 1.5 seconds):**
```
portfolioListener.js polls Ganache for new logs
  → detects Supply event
  → handleEvent() fires
    → eventProcessor.processEvent() → updates risk scores, security logs
    → portfolioService.recordTransaction(wallet, txHash, 'LAR', 'Supply', amount, gas)
      → rebuildPortfolio(wallet, 'Supply', txHash)
        → reads contract: getTotalAmountLentInDollars(), getOutstandingDebt(), getCreditLimit()
        → calculates: collateral, debt, utilization, healthFactor, riskScore, identityScore
        → saves WalletScore document to MongoDB
        → updates WalletProfile: totalCollateral, healthFactor, borrowUtilization, riskScore
      → saves PortfolioTransaction to MongoDB
    → emits socket events to room wallet:<address>:
        portfolio:update  { profile, snapshot }
        tx:new            { txHash, type, asset, amount, riskScore }
        risk:update       { score, debt, collateral, utilization }
```

**Frontend (instant):**
```
usePortfolioRealtime.js receives portfolio:update
  → setProfile(normalisedProfile)
  → setSnapshots([...prev, newSnapshot])

usePortfolioRealtime.js receives tx:new
  → setTransactions(prev => [newTx, ...prev].slice(0, 100))

usePortfolioRealtime.js receives risk:update
  → setProfile(prev => { ...prev, riskScore, totalDebt, totalCollateral, borrowUtilization })
```

**What user sees (no page refresh):**
- Modal shows green success message with tx hash
- If user is on `/portfolio`:
  - Transaction Explorer: new Supply row appears at the top instantly
  - Health Factor card updates
  - Borrow Utilization bar updates
  - Asset Allocation: LAR collateral value increases
  - Health Factor chart gets a new data point
  - Footer: Live Collateral value increases

---

### Step 5 — User closes the modal

```
handleCloseModal() → clears all modal state
  → setSelectedTokenToSupply(null)
  → setSupplyResult(null)
  → setTransactionStep(null)
```

---

## WORKFLOW 3 — Borrowing DAI

User must have supplied collateral first. Credit limit is 200 DAI by default.

### Step 1 — User finds DAI in the Borrow Assets table

- `useBorrowAssets()` hook reads borrowable tokens
- DAI row shows: available liquidity, borrow APY, user's borrow limit
- User clicks **Borrow** on the DAI row

---

### Step 2 — Borrow Modal opens

- `ModalBorrow` renders with DAI token and `walletCreditProfile`
- Shows: available borrow limit, current outstanding debt, min/max borrow amounts
- User enters amount (e.g. `50`)
- Modal validates: amount must be within credit limit

---

### Step 3 — User clicks Confirm

**Code path:**
```
ModalBorrow → onBorrow(token, amount) → borrowToken() in index.js
```

```
contract.methods.borrow(amountWei, tokenAddress, requestId).send()
  → MetaMask popup: "Borrow DAI from FortiFi"
  → User confirms → tx sent to Ganache
  → transactionStep = "Borrowing DAI..."
```

---

### Step 4 — Transaction confirmed on-chain

**On-chain:**
```
LendingAndBorrowing.sol → borrow() executes
  → checks credit limit via RiskController
  → transfers DAI to user wallet
  → emits Borrow(borrower, lenderPool, asset, amount) event
```

**Backend:**
```
portfolioListener.js detects Borrow event
  → rebuildPortfolio(wallet, 'Borrow', txHash)
    → outstandingDebt increases
    → borrowUtilization = (debt / creditLimit) * 100
    → riskScore = min(10, utilization / 10)
    → healthFactor = collateral / max(debt, 1)
    → WalletProfile updated in MongoDB
  → socket emits: portfolio:update, tx:new, risk:update
```

**What user sees (no page refresh):**
- Transaction Explorer: new Borrow row at top
- Health Factor: decreases (more debt = lower health)
- Borrow Utilization bar: fills up (e.g. 25%)
- Asset Allocation: DAI debt value appears
- Footer: Live Debt increases, Risk Score updates

---

## WORKFLOW 4 — Repaying Debt

### Step 1 — User finds DAI in "Your Borrows" table

- `useYourBorrows()` hook shows active borrow positions
- DAI row shows: borrowed amount, APY, accrued interest
- User clicks **Repay**

---

### Step 2 — Repay Modal opens

- `ModalRepay` renders with outstanding debt amount
- Interest is calculated: `borrowAPYRate * amount`
- Total to repay = principal + interest

---

### Step 3 — User confirms repayment

```
ModalRepay → onRepay(token, amount) → repayToken() in index.js
```

**Step 3a — Approval (if needed)**
```
tokenToRepay.methods.approve(contract, amountToPayBack).send()
  → MetaMask: "Approve DAI spending"
```

**Step 3b — Repay transaction**
```
contract.methods.payDebt(tokenAddress, amountWei, requestId).send()
  → MetaMask: "Repay DAI debt"
  → LendingAndBorrowing.sol → payDebt() executes
  → emits Repay(payer, protocol, asset, amount) event
```

---

### Step 4 — Backend processes Repay event

```
rebuildPortfolio(wallet, 'Repay', txHash)
  → outstandingDebt decreases
  → borrowUtilization decreases
  → healthFactor improves
  → profile.repaymentCount++ (increases trust score)
  → trustIdentityScore = 100 + (repaymentCount * 5)
  → WalletProfile saved
```

**What user sees:**
- Debt amount decreases in "Your Borrows"
- Health Factor improves (green)
- Trust Identity Score increases
- Borrow Utilization bar shrinks
- Credit limit may expand with more repayments

---

## WORKFLOW 5 — Withdrawing Collateral

### Step 1 — User finds LAR in "Your Supplies" table

- `useYourSupplies()` shows active supply positions
- User clicks **Withdraw**

---

### Step 2 — Withdraw Modal opens

- `ModalWithdraw` renders with supplied amount
- Warning shown if withdrawal would drop health factor below 1.0

---

### Step 3 — User confirms withdrawal

```
contract.methods.withdraw(tokenAddress, amountWei, requestId).send()
  → MetaMask: "Withdraw LAR from FortiFi"
  → LendingAndBorrowing.sol → withdraw() executes
  → emits Withdraw(protocol, user, asset, amount) event
```

---

### Step 4 — Backend processes Withdraw event

```
rebuildPortfolio(wallet, 'Withdraw', txHash)
  → suppliedCollateral decreases
  → healthFactor recalculated
  → liquidationBuffer = collateral - debt
  → if healthFactor < 1.0 → liquidation risk alert generated
```

**What user sees:**
- LAR collateral value decreases
- Health Factor may drop (red if < 1.0)
- Security Timeline may show a liquidation risk alert

---

## WORKFLOW 6 — Viewing the Portfolio Page

Navigate to `/portfolio` after connecting wallet.

### What loads on page open

```
useWalletPortfolio()
  → reads MetaMask account → sets activeAddress
  → calls usePortfolioRealtime(activeAddress)
    → fetchInitialData():
        GET /api/portfolio/:wallet        → profile (healthFactor, debt, collateral, riskScore)
        GET /api/portfolio/history/:wallet → snapshots for Health Factor chart
        GET /api/portfolio/transactions/:wallet → transaction history for explorer
        GET /api/alerts/live/:wallet      → security alerts for timeline
    → connects Socket.IO to localhost:5001
    → joins room wallet:<address>
    → subscribes to: portfolio:update, tx:new, security:update, risk:update,
                     portfolioUpdate, transactionUpdate, alertUpdate
```

### What user sees

**Top metrics row:**
- Health Factor (green/amber/red based on value)
- Borrow Utilization % with progress bar
- Wallet Risk Score / 10.0
- Trust Identity Score with account tier badge

**Health Factor Trajectory chart:**
- Area chart of health factor over time
- Each supply/borrow/repay adds a new data point in real-time

**Financial Capacity panel:**
- Supplied Collateral in USD
- Total Outstanding Debt in USD
- Dynamic Credit Limit
- Borrow Capacity
- Liquidation Buffer

**Asset Allocation:**
- LAR Token: shows current collateral value
- DAI Stablecoin: shows current debt value

**Security Auditing Timeline:**
- List of security alerts (sybil, flash loan, velocity, oracle threats)
- Each alert shows: title, message, severity, timestamp
- New alerts appear at the top instantly via socket

**Live Transaction Explorer:**
- Table of all transactions: Supply, Borrow, Repay, Withdraw
- Columns: Timestamp, Event Type, Asset, Amount, Gas Used, Risk Score, Tx Hash
- Newest transaction always appears at the top
- Filters: All Time / Today / 1 Hour, All Types / Supplies / Borrows, High Risk only
- Search by tx hash or asset name
- Export to CSV button

**Status indicator (top right):**
- Gray dot = Disconnected (no wallet)
- Yellow pulsing = Syncing (wallet connected, socket connecting)
- Green pulsing = Live (fully connected and receiving real-time updates)

---

## WORKFLOW 7 — Real-Time Update Flow (After Any Transaction)

This is the complete path from blockchain event to UI update:

```
User confirms tx in MetaMask
        ↓
Ganache executes transaction
        ↓
Contract emits event (Supply / Borrow / Repay / Withdraw)
        ↓
portfolioListener.js polls Ganache every 1.5 seconds
        ↓
Event detected → handleEvent() fires
        ↓
eventProcessor.processEvent() → risk scoring, security checks
        ↓
portfolioService.recordTransaction()
        ↓
rebuildPortfolio(wallet, eventType, txHash)
  → reads live contract state
  → calculates all metrics
  → saves WalletScore to MongoDB
  → updates WalletProfile in MongoDB
        ↓
PortfolioTransaction saved to MongoDB
        ↓
Socket.IO emits to room wallet:<address>:
  portfolio:update  → profile + snapshot
  tx:new            → transaction row data
  risk:update       → risk score + debt + collateral
  security:update   → if threat detected
        ↓
usePortfolioRealtime.js receives events
        ↓
React state updates (no page reload):
  setProfile()       → metrics cards update
  setTransactions()  → explorer table updates
  setSnapshots()     → chart gets new point
  setAlerts()        → security timeline updates
        ↓
User sees changes instantly on screen
```

---

## WORKFLOW 8 — Security Page

Navigate to `/security`.

### What user sees

- Security alert timeline with threat type, severity, message, timestamp
- Threat categories detected by the analytics layer:
  - **Flash Loan** — large instant borrow/repay in same block
  - **Oracle Manipulation** — abnormal price feed deviation
  - **Sybil Attack** — multiple wallets with coordinated behaviour
  - **Velocity Abuse** — abnormally high transaction frequency
  - **Whale Movement** — large position changes affecting liquidity
  - **Behavior Anomaly** — unusual pattern vs wallet history

### How alerts are generated

```
portfolioListener.js → eventProcessor.processEvent()
  → analytics/detection/behaviorDetector.js
  → analytics/detection/flashLoanDetector.js
  → analytics/detection/velocityDetector.js
  → analytics/detection/sybilDetector.js
  → analytics/detection/whaleDetector.js
  → analytics/detection/oracleDetector.js
  → analytics/scoring/riskScorer.js
    → if threat detected → SecurityLog saved to MongoDB
    → socket emits security:update to wallet room
    → frontend appends alert to Security Timeline instantly
```

---

## WORKFLOW 9 — Governance Page

Navigate to `/governance`.

### What user sees

- List of active and past governance proposals
- Each proposal shows: title, status (Active / Passed / Failed), votes for, votes against, time remaining
- Vote progress bar (blue = for, red = against)
- Voting Power panel: shows vLAR token balance (LAR tokens delegated to self)
- Timelock Status: shows proposals queued for execution (72-hour delay)

### How voting works

**Step 1 — User clicks "VOTE FOR" or "VOTE AGAINST"**
```
FortiFiGovernor.sol → castVote(proposalId, support)
  → MetaMask popup: "Cast vote"
  → User confirms
  → Vote weight = LAR token balance (ERC20Votes)
  → GovernanceLog saved to MongoDB via POST /api/governance/log
```

**Step 2 — Proposal passes quorum**
```
FortiFiGovernor.sol → quorum reached
  → Proposal moves to "Succeeded" state
  → Can be queued in FortiFiTimelock.sol
  → After 72-hour delay → execute() can be called
  → Protocol parameter changes on-chain
```

**Step 3 — Create a new proposal**
```
User clicks "Create Proposal"
  → FortiFiGovernor.sol → propose(targets, values, calldatas, description)
  → MetaMask: "Create governance proposal"
  → Proposal appears in list with "Active" status
  → Voting period begins
```

---

## WORKFLOW 10 — Threat Simulator Page

Navigate to `/simulator`.

### What user sees

- 4 simulation cards: Flash Loan Attack, Oracle Manipulation, Sybil Exploitation, Velocity Abuse
- Each card shows: severity level (CRITICAL / HIGH / MEDIUM), description
- Terminal console on the right showing execution logs
- Stress telemetry chart showing CPU load and threat velocity

### How a simulation runs

**Step 1 — User clicks "LAUNCH SIMULATION" on a card**
```
runSimulation('FLASH_LOAN')
  → setRunning(true), setActiveSim('FLASH_LOAN')
  → Terminal logs start appearing with timestamps
```

**Step 2 — API call fires**
```
POST /api/simulations/run
  { type: 'FLASH_LOAN', userAddress: '0x...' }
  → backend/index.js → attackSimulator.runSimulation(type, userAddress)
  → analytics/simulations/attackSimulator.js executes
  → Simulation result saved to MongoDB (Simulation model)
  → Returns: { message, scoreChange, mitigationState }
```

**Step 3 — Results display**
```
Terminal shows: "Threat blocked. Simulation logs published."
Report panel shows:
  → Risk delta: +2.5
  → Mitigation state: PAUSED / ISOLATED
Stress chart spikes during simulation, returns to baseline
```

---

## WORKFLOW 11 — Enterprise Cockpit Page

Navigate to `/enterprise`.

### What user sees (requires wallet connection)

**Top metrics:**
- Total Value Locked (TVL) — live collateral in protocol
- Total Borrowed — outstanding debt across protocol
- Active Loans — count of open credit positions
- Protocol Solvency Score — collateral / debt ratio as percentage

**System Solvency History chart:**
- Area chart of solvency over time
- Updates in real-time via `useWalletEnterprise` hook

**Asset Risk Heatmap:**
- Horizontal bar chart showing risk level per asset
- LAR (collateral) shown in green, DAI (debt) in amber

**Live Autonomous Security Logs:**
- Filterable by severity: ALL / HIGH / WARNING / INFO
- Each log shows: severity badge, event description, timestamp
- New logs appear instantly via socket

**Live Transaction Explorer:**
- Same as portfolio page but with enterprise columns (From, To, Asset, Status)
- Searchable by hash or action type
- Export to CSV

**Fixed footer bar:**
- Live Collateral, Live Debt, Current Risk, Identity Score, Risk Assessment
- Updates in real-time after every transaction

### How enterprise data flows

```
useWalletEnterprise hook
  → GET /api/enterprise/metrics/:wallet  → TVL, borrowed, activeLoans, solvency
  → GET /api/enterprise/history/:wallet  → solvency history for chart
  → GET /api/enterprise/security/:wallet → security logs
  → GET /api/enterprise/transactions/:wallet → transaction list
  → Socket.IO joins wallet:<address> room
  → Receives same portfolio:update, tx:new, security:update events
```

---

## WORKFLOW 12 — Admin Console Page

Navigate to `/admin`.

### What user sees

- Global Circuit Breaker panel with two buttons
- Wallet Isolation (Blacklist) input
- SaaS Usage Analytics (API keys, requests, clients, revenue)

### Admin actions

**Activate Emergency Pause:**
```
toggleEmergency(true)
  → RiskController.sol → setEmergencyMode(true)
  → All protocol interactions paused
  → Users cannot supply, borrow, repay, or withdraw
```

**Disable Emergency Pause:**
```
toggleEmergency(false)
  → RiskController.sol → setEmergencyMode(false)
  → Protocol resumes normal operation
```

**Blacklist a wallet:**
```
User enters 0x... address → clicks BLACKLIST
  → RiskController.sol → blacklistWallet(address)
  → Wallet cannot interact with any protocol function
```

---

## WORKFLOW 13 — Wallet Disconnect / Switch

### User switches wallet in MetaMask

```
window.ethereum.on('accountsChanged', accounts)
  → useWalletPortfolio: setActiveAddress(accounts[0])
  → usePortfolioRealtime useEffect re-runs with new address
    → old socket: emit('leave', 'wallet:<old_address>')
    → old socket: disconnect()
    → new socket: connect()
    → new socket: emit('join', 'wallet:<new_address>')
    → fetchInitialData() runs for new wallet
    → all state resets: profile, transactions, snapshots, alerts
```

### User disconnects wallet

```
accounts = []
  → setActiveAddress(null)
  → usePortfolioRealtime: walletAddress is null
    → all state cleared
    → socket disconnected
  → Portfolio page shows "Portfolio Authentication Required" screen
```

---

## COMPLETE USER JOURNEY MAP

```
FIRST VISIT
    ↓
Open http://localhost:3000  (Lending Workspace / index.js)
    ↓
Click "Connect Wallet"  →  MetaMask approves
    ↓
Wallet Profile loaded from MongoDB  (GET /api/wallet-profile/:address)
    ↓
Credit Profile card appears  (200 DAI limit, 100 trust score)
    ↓
─────────────────────────────────────────────────────
SUPPLY FLOW
    ↓
Click Supply on LAR row  →  ModalSupply opens
    ↓
Enter amount  →  Click Confirm
    ↓
MetaMask: Approve LAR  →  MetaMask: Supply LAR
    ↓
Ganache executes  →  Supply event emitted
    ↓
portfolioListener detects  →  rebuildPortfolio runs
    ↓
MongoDB updated  →  Socket emits portfolio:update + tx:new
    ↓
Portfolio page updates instantly (no refresh)
    ↓
─────────────────────────────────────────────────────
BORROW FLOW
    ↓
Click Borrow on DAI row  →  ModalBorrow opens
    ↓
Enter amount  →  Click Confirm
    ↓
MetaMask: Borrow DAI
    ↓
Ganache executes  →  Borrow event emitted
    ↓
portfolioListener detects  →  rebuildPortfolio runs
    ↓
Debt increases  →  Health Factor decreases  →  Risk Score increases
    ↓
Socket emits  →  Portfolio page updates instantly
    ↓
─────────────────────────────────────────────────────
MONITOR FLOW
    ↓
Navigate to /portfolio
    ↓
Health Factor chart  →  Transaction Explorer  →  Security Timeline
    ↓
All update in real-time after every transaction
    ↓
─────────────────────────────────────────────────────
REPAY FLOW
    ↓
Click Repay on DAI in Your Borrows  →  ModalRepay opens
    ↓
Confirm repayment  →  MetaMask: Approve + Repay
    ↓
Debt decreases  →  Health Factor improves  →  Trust Score increases
    ↓
─────────────────────────────────────────────────────
ADVANCED FLOWS
    ↓
/governance  →  Vote on proposals with LAR tokens
/simulator   →  Run sandboxed attack simulations
/enterprise  →  View institutional telemetry cockpit
/admin       →  Emergency pause, blacklist wallets
    ↓
END (continuous loop while user is active)
```

---

## KEY DATA FIELDS — What Each Page Reads

| Field | Source | Used On |
|---|---|---|
| `totalCollateral` / `suppliedCollateral` | WalletProfile, WalletScore.metrics | Portfolio, Enterprise, Footer |
| `totalDebt` / `outstandingDebt` | WalletProfile, WalletScore.metrics | Portfolio, Enterprise, Footer |
| `healthFactor` | WalletScore.metrics | Portfolio chart, metrics card |
| `borrowUtilization` | WalletScore.metrics | Portfolio progress bar |
| `riskScore` | WalletProfile, WalletScore.metrics | Portfolio, Enterprise, Footer |
| `trustScore` / `trustIdentityScore` | WalletProfile, WalletScore.metrics | Portfolio, Lending Workspace |
| `dynamicCreditLimit` / `totalBorrowLimit` | WalletProfile | Lending Workspace, Portfolio |
| `borrowCapacity` / `availableBorrow` | WalletProfile | Lending Workspace, Portfolio |
| `liquidationBuffer` | Calculated: collateral - debt | Portfolio |
| `accountTier` | WalletProfile | Portfolio badge |
| `repaymentCount` | WalletProfile | Trust score calculation |

---

## SOCKET EVENTS REFERENCE

| Event | Direction | Payload | Consumed By |
|---|---|---|---|
| `join` | Client → Server | `wallet:<address>` | backend/index.js |
| `leave` | Client → Server | `wallet:<address>` | backend/index.js |
| `portfolio:update` | Server → Client | `{ walletAddress, profile, snapshot }` | usePortfolioRealtime |
| `tx:new` | Server → Client | `{ txHash, type, asset, amount, riskScore, ... }` | usePortfolioRealtime |
| `security:update` | Server → Client | `{ title, message, severity, timestamp, txHash }` | usePortfolioRealtime |
| `risk:update` | Server → Client | `{ wallet, score, debt, collateral, utilization }` | usePortfolioRealtime |
| `portfolioUpdate` | Server → Client | `{ wallet, profile, snapshot }` | usePortfolioRealtime (legacy) |
| `transactionUpdate` | Server → Client | transaction object | usePortfolioRealtime (legacy) |
| `alertUpdate` | Server → Client | alert object | usePortfolioRealtime (legacy) |
| `creditProfileUpdate` | Server → Client | `{ address, profile }` | index.js (Lending Workspace) |

---

## ERROR STATES AND WHAT USER SEES

| Situation | What User Sees |
|---|---|
| MetaMask not installed | "Install MetaMask" banner |
| Wallet not connected | "Connect Wallet" button, read-only tables |
| Ganache offline | Red banner "Local Blockchain Offline" |
| Wrong network | Network warning in Navbar |
| Transaction rejected in MetaMask | Modal shows error message |
| Insufficient balance | Modal shows "Insufficient balance" error |
| Borrow limit exceeded | Modal shows "Borrow limit reached. Repay existing debt." |
| Socket disconnected | Status dot turns yellow "Syncing", auto-reconnects |
| No transactions yet | Explorer shows "No historical transactions match selected filters" |
| No security alerts | Timeline shows "Identity Sandbox Secure" with shield icon |
| Portfolio not loaded | Shows "Portfolio Authentication Required" with lock icon |
