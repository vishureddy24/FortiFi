# FortiFi — System Architecture

## DIAGRAM 1 — Big Picture (How Everything Connects)

```mermaid
graph TD
    USER["🧑 USER\nBrowser + MetaMask"]

    FRONTEND["⚛️ FRONTEND\nNext.js · localhost:3000"]

    BACKEND["🖥️ BACKEND\nExpress + Socket.IO · localhost:5001"]

    DB["🗄️ MONGODB\nAtlas Cloud Database"]

    CHAIN["⛓️ BLOCKCHAIN\nGanache · localhost:7545"]

    USER -->|"visits website"| FRONTEND
    USER -->|"signs transactions"| CHAIN
    FRONTEND -->|"REST API calls"| BACKEND
    FRONTEND -->|"Socket.IO real-time"| BACKEND
    BACKEND -->|"reads & writes"| DB
    BACKEND -->|"polls for events"| CHAIN
    CHAIN -->|"emits events"| BACKEND
    BACKEND -->|"pushes live updates"| FRONTEND
```

---

## DIAGRAM 2 — Frontend Pages & What Each Does

```mermaid
graph LR
    NAV["🧭 Navigation"]

    NAV --> P1["🏦 /\nLending Workspace\n─────────────\nSupply collateral\nBorrow DAI\nRepay debt\nWithdraw collateral"]

    NAV --> P2["📊 /dashboard\nUser Dashboard\n─────────────\nPortfolio overview\nSecurity feed\nActive positions"]

    NAV --> P3["📈 /portfolio\nInstitutional Portfolio\n─────────────\nHealth Factor chart\nTransaction Explorer\nSecurity Timeline\nAsset Allocation"]

    NAV --> P4["🔒 /security\nSecurity Monitor\n─────────────\nThreat alerts\nRisk logs\nAnomaly timeline"]

    NAV --> P5["🗳️ /governance\nDAO Governance\n─────────────\nActive proposals\nVote FOR / AGAINST\nTimelock status"]

    NAV --> P6["⚡ /simulator\nThreat Simulator\n─────────────\nFlash Loan attack\nOracle manipulation\nSybil exploitation\nVelocity abuse"]

    NAV --> P7["🏢 /enterprise\nEnterprise Cockpit\n─────────────\nTVL · Solvency score\nRisk heatmap\nSaaS analytics"]

    NAV --> P8["⚙️ /admin\nAdmin Console\n─────────────\nCircuit breaker\nWallet blacklist\nAPI key management"]
```

---

## DIAGRAM 3 — Transaction Flow (Supply Example, Step by Step)

```mermaid
sequenceDiagram
    actor User
    participant MM as 🦊 MetaMask
    participant FE as ⚛️ Frontend
    participant GAN as ⛓️ Ganache
    participant SC as 📄 LendingAndBorrowing.sol
    participant BK as 🖥️ Backend
    participant DB as 🗄️ MongoDB
    participant UI as 🖥️ Portfolio UI

    User->>FE: Clicks "Supply LAR"
    FE->>FE: Opens ModalSupply
    User->>FE: Enters amount, clicks Confirm
    FE->>MM: Request approve() transaction
    MM->>User: Popup — "Approve LAR spending?"
    User->>MM: Confirms
    MM->>GAN: Sends approve tx
    FE->>MM: Request lend() transaction
    MM->>User: Popup — "Supply LAR to FortiFi?"
    User->>MM: Confirms
    MM->>GAN: Sends supply tx
    GAN->>SC: Executes lend()
    SC->>GAN: Emits Supply event

    Note over BK: polls every 1.5 seconds
    BK->>GAN: getLogs() — detects Supply event
    BK->>BK: rebuildPortfolio()
    BK->>GAN: reads getOutstandingDebt()
    BK->>GAN: reads getCreditLimit()
    BK->>GAN: reads getTotalAmountLentInDollars()
    BK->>DB: saves WalletScore + WalletProfile
    BK->>DB: saves PortfolioTransaction
    BK->>UI: socket.emit portfolio:update
    BK->>UI: socket.emit tx:new
    BK->>UI: socket.emit risk:update
    UI->>User: Updates instantly — no page reload
```

---

## DIAGRAM 4 — Backend Internal Architecture

```mermaid
graph TD
    subgraph ENTRY["Entry Point"]
        IDX["backend/index.js\nExpress server\nSocket.IO setup\nAll routes registered"]
    end

    subgraph ROUTES["REST API Routes"]
        R1["GET /api/portfolio/:wallet\nProfile + metrics"]
        R2["GET /api/portfolio/history/:wallet\nHealth factor chart data"]
        R3["GET /api/portfolio/transactions/:wallet\nTransaction explorer"]
        R4["POST /api/simulations/run\nAttack simulation"]
        R5["GET /api/security-logs\nThreat alerts"]
        R6["GET /api/telemetry/global\nProtocol-wide stats"]
        R7["GET /api/v1/saas/*\nEnterprise API — key auth"]
    end

    subgraph LISTENERS["Contract Event Listeners"]
        L1["realtime/portfolioListener.js\n⭐ PRIMARY\nPolls Ganache every 1.5s\nDetects Supply·Borrow·Repay·Withdraw\nTriggers all downstream processing"]
        L2["portfolio/listener.js\nEthers.js subscriptions\nBackup listener"]
        L3["enterprise/listener.js\nEnterprise event tracking"]
    end

    subgraph SERVICES["Core Services"]
        S1["portfolioService.js\nrecordTransaction()\ncreateSnapshot()\ncreateAlert()"]
        S2["rebuildPortfolio.js\n⭐ CORE ENGINE\nReads live contract state\nCalculates ALL metrics\nSaves to MongoDB"]
        S3["eventProcessor.js\nRoutes events to\nanalytics detectors"]
    end

    subgraph ANALYTICS["Analytics & Detection"]
        A1["behaviorDetector.js"]
        A2["flashLoanDetector.js"]
        A3["velocityDetector.js"]
        A4["sybilDetector.js"]
        A5["whaleDetector.js"]
        A6["oracleDetector.js"]
        A7["riskScorer.js\nFinal score 0–10"]
        A8["attackSimulator.js\nSandboxed exploits"]
    end

    subgraph SOCKETS["Socket.IO Real-Time"]
        SK["Room: wallet:0xABC...\nOne private room per wallet\n─────────────────\nOUT: portfolio:update\nOUT: tx:new\nOUT: security:update\nOUT: risk:update"]
    end

    IDX --> ROUTES
    IDX --> LISTENERS
    L1 -->|"event detected"| S3
    L1 -->|"calls"| S1
    S1 -->|"calls"| S2
    S3 --> A1 & A2 & A3 & A4 & A5 & A6
    A1 & A2 & A3 & A4 & A5 & A6 --> A7
    S2 -->|"emits"| SK
    S1 -->|"emits"| SK
    A7 -->|"emits security:update"| SK
```

---

## DIAGRAM 5 — Smart Contracts on Blockchain

```mermaid
graph TD
    subgraph CORE["Core Protocol"]
        LAB["LendingAndBorrowing.sol\n⭐ MAIN CONTRACT\n─────────────────────\nlend() — supply collateral\nborrow() — take DAI loan\npayDebt() — repay loan\nwithdraw() — get collateral back\nliquidate() — liquidate unhealthy position\n─────────────────────\nEvents: Supply · Borrow · Repay · Withdraw"]

        RC["RiskController.sol\n─────────────────────\nCalculates health factor\nTriggers liquidations\nEmergency pause\nWallet blacklist"]

        LAR["LAR.sol\n─────────────────────\nERC20 token\nCollateral asset\nGovernance voting power\nmint() · burn() · delegate()"]
    end

    subgraph GOVERNANCE["DAO Governance"]
        GOV["FortiFiGovernor.sol\n─────────────────────\npropose() — create proposal\ncastVote() — vote FOR/AGAINST\nexecute() — run passed proposal\nQuorum required to pass"]

        TL["FortiFiTimelock.sol\n─────────────────────\n72-hour delay\nbefore execution\nSecurity buffer"]

        GC["GovernanceController.sol\nOrchestrates governor\n+ timelock together"]
    end

    subgraph TOKENS["Tokens & Oracles"]
        ADE["ADE.sol\nUtility / rewards token"]
        DAI["MockDAIToken.sol\nTest stablecoin\nfaucet() for dev accounts"]
        ORACLE["MockV3Aggregator.sol\nFake Chainlink price feed\nETH·DAI·LAR prices"]
        HELPER["LendingHelper.sol\nUtility functions"]
    end

    LAB -->|"checks health factor"| RC
    LAB -->|"accepts as collateral"| LAR
    LAB -->|"reads price"| ORACLE
    GOV -->|"queues in"| TL
    TL -->|"executes via"| GC
    LAR -->|"voting power for"| GOV
```

---

## DIAGRAM 6 — Database Collections (MongoDB)

```mermaid
graph TD
    subgraph WALLET["Wallet State"]
        WP["WalletProfile\n─────────────\naddress\ntotalCollateral\ntotalDebt\nhealthFactor\nriskScore\ntrustScore\naccountTier\nborrowEligibility"]

        WS["WalletScore\n─────────────\nwalletAddress\nmetrics.healthFactor\nmetrics.borrowUtilization\nmetrics.riskScore\nmetrics.suppliedCollateral\nmetrics.outstandingDebt\nmetrics.dynamicCreditLimit\ntimestamp · txHash"]
    end

    subgraph TRANSACTIONS["Transactions"]
        PT["PortfolioTransaction\n─────────────\nwallet · txHash\nasset · type · amount\ngasUsed · debtAfter\nutilization · riskScore"]

        TH["TransactionHistory\n─────────────\nwalletAddress · txHash\neventType · token\namount · gasUsed\nriskScoreSnapshot"]
    end

    subgraph SECURITY["Security & Alerts"]
        SL["SecurityLog\n─────────────\nwalletAddress\nthreatType · severity\nmessage · txHash\ntimestamp"]

        AL["Alert · PortfolioAlert\n─────────────\ntitle · severity\nmessage · timestamp"]
    end

    subgraph PROTOCOL["Protocol State"]
        PS["ProtocolState\n─────────────\nglobalRiskScore\nisPaused · tvl\ntotalBorrowed"]

        RS["RiskScore · RiskHistory\n─────────────\naddress · score\ncomponents · timestamp"]
    end

    subgraph ENTERPRISE["Enterprise & SaaS"]
        AK["ApiKey\n─────────────\nkey · owner · tier\nisActive · requestsCount"]

        ET["EnterpriseTransaction\nEnterpriseSecurityLog\nEnterpriseWalletMetric"]
    end

    subgraph OTHER["Other"]
        US["User\nGovernanceLog\nSimulation\nWalletCreditState"]
    end

    WP -->|"1 wallet → many"| PT
    WP -->|"1 wallet → many"| WS
    WP -->|"1 wallet → many"| SL
    WS -->|"latest score used by"| PT
```

---

## DIAGRAM 7 — Real-Time Socket Flow

```mermaid
graph LR
    subgraph BACKEND["Backend"]
        EV["Contract Event\nDetected"]
        RB["rebuildPortfolio\nCalculates metrics"]
        EM["Socket.IO\nEmitter"]
    end

    subgraph ROOM["Socket Room\nwallet:0xABC..."]
        E1["portfolio:update\nfull profile + snapshot"]
        E2["tx:new\ntransaction row data"]
        E3["risk:update\nscore + debt + collateral"]
        E4["security:update\nthreat alert"]
    end

    subgraph FRONTEND["Frontend Hook\nusePortfolioRealtime.js"]
        F1["setProfile()\nUpdates metrics cards\nHealth Factor\nBorrow Utilization\nRisk Score\nTrust Score"]
        F2["setTransactions()\nAdds row to top\nof TX Explorer"]
        F3["setSnapshots()\nAdds point to\nHealth Factor chart"]
        F4["setAlerts()\nAdds entry to\nSecurity Timeline"]
    end

    EV --> RB --> EM
    EM --> E1 & E2 & E3 & E4
    E1 --> F1
    E1 --> F3
    E2 --> F2
    E3 --> F1
    E4 --> F4
```

---

## DIAGRAM 8 — MetaMask & Wallet Connection Flow

```mermaid
flowchart TD
    START["User opens localhost:3000"]

    CHECK{"MetaMask\ninstalled?"}
    START --> CHECK

    CHECK -->|"No"| BANNER["Show: Install MetaMask banner\nRead-only mode"]

    CHECK -->|"Yes"| GANACHE{"Ganache\nrunning?"}

    GANACHE -->|"No"| OFFLINE["Show: Blockchain Offline banner\nAnalytics mode only"]

    GANACHE -->|"Yes"| CONNECT["User clicks Connect Wallet"]

    CONNECT --> MM["MetaMask popup\nRequest account access"]

    MM -->|"User rejects"| READONLY["Read-only mode\nNo transactions possible"]

    MM -->|"User approves"| ACCOUNT["account.data = 0xABC...\nwallet address stored"]

    ACCOUNT --> PROFILE["GET /api/wallet-profile/0xABC\nLoad or create WalletProfile\nCredit limit: 200 DAI\nTrust score: 100"]

    PROFILE --> SOCKET["Socket.IO connects\nJoins room: wallet:0xabc...\nSubscribes to live events"]

    SOCKET --> READY["✅ App fully loaded\nAll tables populated\nReal-time active"]

    READY --> SWITCH{"User switches\nwallet in MetaMask?"}

    SWITCH -->|"Yes"| REJOIN["Leave old room\nJoin new room\nReload all data"]
    REJOIN --> READY
```

---

## SUMMARY TABLE

| Layer | Technology | Port | Responsibility |
|---|---|---|---|
| 👤 User | Browser + MetaMask | — | Interacts with UI, signs transactions |
| ⚛️ Frontend | Next.js + React | 3000 | 8 pages, hooks, real-time state |
| 🖥️ Backend | Express + Socket.IO | 5001 | API, event listeners, analytics |
| 🗄️ Database | MongoDB Atlas | cloud | Stores all wallet + protocol data |
| ⛓️ Blockchain | Ganache + Solidity | 7545 | Executes transactions, emits events |

| Key Flow | Path |
|---|---|
| User does transaction | MetaMask → Ganache → Contract → Event |
| Event reaches backend | portfolioListener polls every 1.5s |
| Metrics calculated | rebuildPortfolio reads live contract state |
| Data saved | WalletScore + WalletProfile → MongoDB |
| UI updates | Socket.IO → usePortfolioRealtime → React state |
| No page reload needed | Everything via socket events |
