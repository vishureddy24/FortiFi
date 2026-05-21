# FortiFi — Presentation Slide Content

---

## SLIDE 1 — INTRODUCTION

1. FortiFi is a decentralized finance (DeFi) lending and borrowing platform built on Ethereum blockchain technology, designed to provide users with a secure, transparent, and autonomous financial ecosystem without the need for traditional banking intermediaries.

2. The platform enables users to supply crypto assets as collateral and borrow stablecoins (DAI) against that collateral, with all transactions executed through audited Solidity smart contracts deployed on the Ethereum-compatible Ganache local blockchain.

3. FortiFi integrates an AI-powered real-time risk intelligence layer that continuously monitors wallet behavior, calculates health factors, detects threats such as flash loan attacks and sybil exploitation, and pushes instant alerts to users without any manual refresh.

4. The system is built using a modern full-stack architecture combining Next.js for the frontend, Node.js with Express and Socket.IO for the backend, MongoDB Atlas for persistent data storage, and Truffle with Ganache for smart contract development and deployment.

5. FortiFi introduces a dynamic credit scoring system where each wallet earns a Trust Identity Score based on its repayment history, collateral supplied, and behavioral patterns — allowing the protocol to offer adaptive borrow limits that grow with responsible usage.

6. The project targets both individual DeFi users and institutional clients through a dedicated Enterprise Cockpit that provides protocol-wide telemetry, solvency monitoring, asset risk heatmaps, and a SaaS API layer with API key authentication for third-party integrations.

---

## SLIDE 2 — PROBLEM STATEMENT

1. Traditional financial systems are centralized, opaque, and exclusionary — millions of people worldwide lack access to credit facilities due to the absence of formal credit history, geographic restrictions, or institutional bias, creating a massive gap in global financial inclusion.

2. Existing DeFi lending protocols such as Aave and Compound, while functional, lack real-time intelligent risk monitoring — users have no immediate awareness when their collateral health deteriorates, often discovering liquidation events only after significant financial loss has already occurred.

3. The DeFi ecosystem is highly vulnerable to sophisticated attacks including flash loan exploits, oracle price manipulation, sybil account farming, and velocity-based transaction abuse — most protocols have no built-in detection or prevention mechanisms for these threats at the application layer.

4. Smart contract interactions in DeFi are irreversible — once a transaction is confirmed on-chain, there is no undo mechanism, making it critical to provide users with pre-transaction risk assessments, health factor warnings, and real-time post-transaction feedback to prevent costly mistakes.

5. Current DeFi dashboards are largely static and require manual page refreshes to reflect updated balances, transaction histories, and risk scores — this creates a dangerous lag between on-chain state changes and what the user actually sees on their screen, especially during volatile market conditions.

6. Institutional adoption of DeFi is hindered by the absence of enterprise-grade monitoring tools, audit trails, compliance-ready reporting, and programmable API access — without these features, financial institutions cannot integrate DeFi protocols into their existing risk management frameworks.

---

## SLIDE 3 — SOLUTION / JUSTIFICATION FOR PROBLEM STATEMENT

1. FortiFi solves financial exclusion by replacing traditional credit checks with an on-chain Trust Identity Score — any wallet can participate regardless of geography or banking history, and creditworthiness is determined purely by transparent, verifiable blockchain behavior over time.

2. The platform addresses the lack of real-time risk awareness by implementing a continuous contract event listener that polls the blockchain every 1.5 seconds, detects Supply, Borrow, Repay, and Withdraw events, recalculates all health metrics instantly, and pushes updates to the user's screen via Socket.IO without requiring any page reload.

3. FortiFi's built-in analytics engine includes six specialized threat detectors — behavioral anomaly, flash loan, velocity abuse, sybil attack, whale movement, and oracle deviation — each running independently and feeding into a composite risk scorer that generates a 0–10 risk score and triggers security alerts in real time.

4. The dynamic credit system directly addresses the static borrow limit problem — as users repay loans, their repayment count increases, their Trust Identity Score grows by 5 points per repayment, and their available credit limit expands automatically, creating a positive incentive loop for responsible borrowing behavior.

5. The real-time portfolio page solves the stale UI problem by maintaining a persistent Socket.IO connection per wallet, where every on-chain event immediately updates the Transaction Explorer, Health Factor chart, Asset Allocation panel, and Security Timeline simultaneously — all driven by a single event pipeline from blockchain to React state.

6. The Enterprise Cockpit and SaaS API layer solve the institutional adoption barrier by providing rate-limited API key authentication, protocol-wide solvency metrics, downloadable CSV and JSON audit reports, and a programmable REST interface that allows third-party systems to query risk scores, transaction histories, and security logs programmatically.

---

## SLIDE 4 — SYSTEM DESIGN

1. The system follows a five-layer architecture: the User Layer (browser and MetaMask wallet), the Frontend Layer (Next.js React application), the Backend Layer (Express API server with Socket.IO), the Database Layer (MongoDB Atlas), and the Blockchain Layer (Ganache with Solidity smart contracts) — each layer communicating with the adjacent layers through well-defined interfaces.

2. The frontend is organized into eight distinct pages — Lending Workspace, Dashboard, Portfolio, Security, Governance, Simulator, Enterprise, and Admin — each served by dedicated React hooks that manage their own state, API calls, and socket subscriptions, ensuring clean separation of concerns and independent component lifecycles.

3. The backend uses a service-oriented design where the contract event listener, portfolio service, rebuild engine, analytics detectors, and alert manager are all independent modules — the event listener detects on-chain activity and delegates to the appropriate service, which then writes to MongoDB and emits socket events without any tight coupling between components.

4. Data consistency is maintained through the `rebuildPortfolio` function, which serves as the single source of truth for all metric calculations — it reads live state directly from the smart contract (outstanding debt, credit limit, collateral value), computes health factor, utilization, risk score, and identity score, then atomically saves a new WalletScore snapshot and updates the WalletProfile document.

5. The Socket.IO room architecture uses per-wallet private rooms named `wallet:<address>` — this ensures complete data isolation between users, prevents any wallet's data from leaking to another user's session, and allows the backend to target specific users with precision when emitting portfolio updates, transaction events, and security alerts.

6. The database schema is designed for both real-time performance and historical analytics — WalletScore documents are append-only (never overwritten) to preserve a complete audit trail, while WalletProfile is always updated to reflect the latest state, giving the system both a current snapshot for fast reads and a full history for chart rendering and compliance reporting.

---

## SLIDE 5 — SYSTEM ARCHITECTURE

1. The Frontend (Next.js on port 3000) communicates with the Backend (Express on port 5001) through two parallel channels — synchronous REST API calls for initial page loads and historical data fetching, and asynchronous Socket.IO connections for all real-time updates — ensuring the UI is always populated immediately on load and stays live thereafter.

2. The Backend's primary event detection mechanism is `realtime/portfolioListener.js`, which uses Ethers.js to poll the Ganache blockchain at `http://127.0.0.1:7545` every 1.5 seconds, fetching raw logs from the LendingAndBorrowing contract, parsing them using the contract ABI interface, and routing each detected event through the full processing pipeline.

3. The Smart Contract layer consists of nine Solidity contracts — LendingAndBorrowing (core protocol), LAR Token (ERC20 collateral and governance), RiskController (health factor and liquidation), FortiFiGovernor (DAO voting), FortiFiTimelock (72-hour execution delay), GovernanceController, ADE Token, LendingHelper, and MockDAIToken — all deployed via Truffle migrations with addresses stored in the ABI JSON artifacts.

4. MongoDB Atlas stores 20+ collections organized into five logical groups — Wallet State (WalletProfile, WalletScore, WalletSnapshot), Transactions (PortfolioTransaction, TransactionHistory), Security (SecurityLog, Alert, PortfolioAlert), Protocol State (ProtocolState, RiskScore, RiskHistory), and Enterprise (EnterpriseTransaction, ApiKey, GovernanceLog) — with compound indexes on wallet address and timestamp for fast sorted queries.

5. The Analytics Engine runs six parallel threat detectors (behavior, flash loan, velocity, sybil, whale, oracle) that each analyze incoming transaction events against historical patterns stored in MongoDB — their outputs feed into `riskScorer.js` which computes a composite 0–10 risk score, saves it to the SecurityLog collection, and triggers a `security:update` socket event to the affected wallet's room.

6. The Governance subsystem uses OpenZeppelin's Governor pattern — LAR token holders delegate their voting power, create proposals via `FortiFiGovernor.sol`, vote during the active period, and approved proposals are queued in `FortiFiTimelock.sol` for a mandatory 72-hour delay before execution, ensuring no protocol parameter can be changed without community consensus and a security buffer period.

---

## SLIDE 6 — SOFTWARE TOOLS

1. **Solidity (^0.8.6) + Truffle (^5.11.0)** — Solidity is used to write all nine smart contracts with OpenZeppelin's audited libraries for ERC20, Governor, Timelock, and ReentrancyGuard patterns; Truffle provides the compilation, migration, and testing framework that deploys contracts to Ganache and writes updated addresses into the ABI JSON artifacts automatically.

2. **Next.js (12.2.5) + React (18.2.0) + Tailwind CSS (^3.1.8)** — Next.js provides server-side rendering, file-based routing, and optimized builds for the frontend; React 18 manages component state and lifecycle; Tailwind CSS provides the utility-first dark-themed institutional UI with responsive layouts, glassmorphism effects, and animated status indicators throughout all eight pages.

3. **Node.js + Express (^5.2.1) + Socket.IO (^4.8.3)** — Express handles all REST API routing with middleware for CORS, JSON parsing, rate limiting, and API key validation; Socket.IO manages persistent WebSocket connections with per-wallet room isolation, enabling sub-second real-time data delivery from the backend to any connected frontend client.

4. **Ethers.js (^6.16.0) + Web3.js (^4.16.0)** — Ethers.js is used in the backend listeners to connect to Ganache via HTTP JSON-RPC, poll for contract event logs, parse them using the ABI interface, and read live contract state for metric calculations; Web3.js is used in the frontend to interact with MetaMask, send transactions, and read token balances and allowances.

5. **MongoDB Atlas + Mongoose (^9.6.1)** — MongoDB Atlas provides a cloud-hosted NoSQL database with automatic scaling and global replication; Mongoose defines 20+ schemas with type validation, default values, and compound indexes; the append-only WalletScore design and upsert-based WalletProfile updates ensure data integrity without transactions while maintaining query performance.

6. **Ganache (local blockchain) + MetaMask + Chainlink MockV3Aggregator** — Ganache provides a deterministic local Ethereum blockchain on port 7545 with pre-funded test accounts and instant block confirmation; MetaMask serves as the browser wallet for signing transactions and managing accounts; MockV3Aggregator simulates Chainlink price feeds for DAI/USD, ETH/USD, and LAR/USD in the development environment.

---

## SLIDE 7 — LENDING WORKSPACE MODULE (Supply / Borrow / Repay / Withdraw)

1. The Lending Workspace (`/` route) is the core DeFi interaction page where users connect their MetaMask wallet and see four functional panels — Your Supplies, Your Borrows, Available Assets to Supply, and Available Assets to Borrow — all populated in real time by reading on-chain state through Web3.js hooks that query the LendingAndBorrowing contract directly.

2. The Supply flow begins when a user selects an asset (LAR, DAI, WETH) and clicks Supply — the `ModalSupply` component opens, the user enters an amount, and the system first checks the current ERC20 allowance; if insufficient, it sends an `approve()` transaction to the token contract before sending the `lend()` transaction to the LendingAndBorrowing contract, with MetaMask prompting the user for each signature.

3. The Borrow flow is governed by the Dynamic Credit Line system — before the `ModalBorrow` opens, the backend is queried for the wallet's current credit profile showing available limit, outstanding debt, minimum and maximum borrow amounts, and eligibility status; the contract's `borrow()` function then transfers DAI directly to the user's wallet after verifying the requested amount is within the credit limit enforced by RiskController.

4. The Repay flow calculates the total repayment amount as principal plus accrued interest (computed as `borrowAPYRate × amount`) — the `ModalRepay` component displays the exact amount due, the system approves the DAI token spending if needed, and calls `payDebt()` on the contract; each successful repayment increments the wallet's `repaymentCount` in MongoDB, which directly increases the Trust Identity Score by 5 points.

5. The Withdraw flow allows users to reclaim their supplied collateral — the `ModalWithdraw` component warns if the withdrawal would drop the health factor below the liquidation threshold of 1.0, and the contract's `withdraw()` function transfers the collateral back to the user's wallet while the backend immediately recalculates the new health factor and pushes the updated metrics to the portfolio page via socket.

6. The Decentralized Credit Profile card displayed on the Lending Workspace shows the wallet's real-time credit metrics — Credit Limit (default 200 DAI, grows with repayments), Available Credit, Active Debt, Trust Score, Account Tier, Risk Index, and Repayment Count — all fetched from `GET /api/wallet-profile/:address` on page load and updated live via the `creditProfileUpdate` socket event.

---

## SLIDE 8 — PORTFOLIO MONITORING MODULE

1. The Portfolio page (`/portfolio`) is the real-time financial monitoring hub of FortiFi — it uses the `useWalletPortfolio` hook to detect the connected MetaMask account, then passes the address to `usePortfolioRealtime` which simultaneously fetches initial data from four REST endpoints and establishes a Socket.IO connection to the wallet's private room for all subsequent live updates.

2. The Health Factor Trajectory chart is an area chart built with Recharts that plots the wallet's health factor over time — each supply, borrow, repay, or withdraw event creates a new WalletScore snapshot in MongoDB with the updated health factor, and the socket's `portfolio:update` event appends this new data point to the chart in real time, giving users a visual history of their position's safety margin.

3. The Live Transaction Explorer is a filterable, searchable table showing all wallet transactions with columns for Timestamp, Event Type, Asset, Amount, Gas Used, Risk Score, and Transaction Hash — it merges data from both the `PortfolioTransaction` collection (written by the realtime listener) and the `TransactionHistory` collection (written by the legacy listener) to ensure no transaction is ever missing from the display.

4. The Security Auditing Timeline displays all threat alerts generated by the analytics engine for the connected wallet — each entry shows the threat type, severity level (HIGH/WARNING/INFO), descriptive message, and timestamp; new alerts are prepended to the top of the list instantly via the `security:update` socket event without any polling or manual refresh required.

5. The Financial Capacity panel shows six key metrics in real time — Supplied Collateral (USD), Total Outstanding Debt (USD), Dynamic Credit Limit, Borrow Capacity, Liquidation Buffer (collateral minus debt), and Borrow Utilization percentage with a visual progress bar — all derived from the normalised profile object that both the REST API and socket events deliver in an identical shape.

6. The connection status indicator in the top-right corner provides live feedback on the system state — a gray dot means no wallet connected, a yellow pulsing dot means the wallet is connected but the socket is still establishing, and a green pulsing dot with "Live" label confirms the full real-time pipeline is active and all updates are flowing; the page also supports CSV and JSON report downloads for audit purposes.

---

## SLIDE 9 — SECURITY MONITORING MODULE

1. The Security Monitor page (`/security`) and the Security Auditing Timeline on the Portfolio page are both powered by FortiFi's six-detector analytics engine — each detector runs independently on every incoming transaction event, analyzing it against historical patterns to identify specific threat signatures before saving a SecurityLog document and emitting a `security:update` socket event.

2. The **Behavior Detector** (`behaviorDetector.js`) establishes a baseline behavioral profile for each wallet by analyzing its historical transaction patterns — frequency, amounts, asset types, and timing — and flags deviations that exceed statistical thresholds, such as a wallet that suddenly starts transacting at 10x its normal volume or switches from small regular borrows to a single large withdrawal.

3. The **Flash Loan Detector** (`flashLoanDetector.js`) identifies flash loan attack patterns by checking whether a large borrow and repay occur within the same block or within a very short time window — flash loans are a common DeFi exploit where attackers borrow massive amounts, manipulate prices, and repay within a single atomic transaction to drain protocol liquidity.

4. The **Velocity Detector** (`velocityDetector.js`) and **Sybil Detector** (`sybilDetector.js`) work together to identify coordinated abuse — velocity detection flags wallets performing an abnormally high number of transactions per minute, while sybil detection identifies clusters of wallets with similar behavioral fingerprints that appear to be controlled by the same entity to circumvent per-wallet credit limits.

5. The **Whale Detector** (`whaleDetector.js`) monitors for large position changes that could destabilize protocol liquidity — a single wallet supplying or withdrawing a disproportionately large amount of collateral relative to the total protocol TVL triggers a whale alert, giving the protocol and other users advance warning of potential liquidity stress events.

6. The **Oracle Detector** (`oracleDetector.js`) monitors Chainlink price feed data for abnormal deviations — sudden price spikes or drops that exceed normal volatility thresholds are flagged as potential oracle manipulation attempts, which are a common attack vector where malicious actors manipulate price feeds to trigger artificial liquidations and profit from the resulting collateral seizure.

---

## SLIDE 10 — METAMASK AUTHENTICATION

1. MetaMask serves as the sole authentication mechanism in FortiFi — there are no usernames, passwords, or email addresses; instead, a user's cryptographic wallet address (a 42-character hexadecimal string derived from their private key) acts as their unique identity across the entire platform, ensuring that only the holder of the private key can authorize transactions on their behalf.

2. The wallet connection flow is handled by the `useWeb3` provider hook — on page load, it calls `window.ethereum.request({ method: 'eth_accounts' })` to check for an already-connected account; if none exists, the user clicks "Connect Wallet" which triggers `eth_requestAccounts`, causing MetaMask to display a permission popup where the user explicitly approves the site's access to their wallet address.

3. Every transaction (supply, borrow, repay, withdraw, vote) requires an explicit MetaMask signature — the frontend constructs the transaction parameters and calls `.send({ from: account })` via Web3.js, which passes the transaction to MetaMask for the user to review the gas cost, recipient contract, and function being called before signing with their private key; the private key never leaves the MetaMask extension.

4. FortiFi generates a unique `requestId` for every transaction using `web3.utils.soliditySha3` with the wallet address, current timestamp, and a random number — this idempotency key is passed to the smart contract and stored in MongoDB, preventing duplicate transaction processing if the same transaction is accidentally submitted twice or if the event listener detects the same event multiple times.

5. The system handles wallet switching and disconnection gracefully — `window.ethereum.on('accountsChanged')` fires whenever the user changes accounts in MetaMask; the `useWalletPortfolio` hook responds by updating `activeAddress`, the Socket.IO client leaves the old wallet's room and joins the new wallet's room, and all portfolio data is reloaded for the new address without any page refresh.

6. Network validation is enforced through the `useNetwork` hook — the application checks that MetaMask is connected to the correct network (Ganache, network ID 5777) and displays a warning banner if the user is on the wrong network; this prevents transactions from being sent to the wrong blockchain where the contracts do not exist, protecting users from losing funds to failed transactions.

---

## SLIDE 11 — ADMIN DASHBOARD MODULE

1. The Admin Console (`/admin`) provides protocol administrators with privileged controls over the FortiFi ecosystem — it is accessible only to authorized wallet addresses and exposes three primary management capabilities: Global Circuit Breaker for emergency protocol pause, Wallet Isolation for blacklisting malicious addresses, and SaaS Usage Analytics for monitoring API consumption and enterprise client activity.

2. The **Global Circuit Breaker** is a critical safety mechanism that calls `RiskController.sol`'s `setEmergencyMode(true)` function — when activated, the RiskController contract blocks all supply, borrow, repay, and withdraw operations across the entire protocol, effectively freezing all user interactions until the administrator calls `setEmergencyMode(false)` to resume normal operations after the threat has been resolved.

3. The **Wallet Isolation (Blacklist)** feature allows administrators to permanently restrict specific wallet addresses from interacting with the protocol — the admin enters a `0x...` address and clicks BLACKLIST, which calls `RiskController.sol`'s `blacklistWallet(address)` function; blacklisted wallets receive a rejection error on any attempted transaction, and their status is stored on-chain making it transparent and auditable by anyone.

4. The **SaaS Usage Analytics** panel displays four key business metrics — Active API Keys (total issued keys currently enabled), Total API Requests (cumulative requests across all keys), Enterprise Clients (number of organizations using the platform), and Monthly Revenue — giving administrators a real-time view of the platform's commercial performance and API consumption patterns.

5. The backend enforces API key authentication for all enterprise endpoints through the `validateApiKey` middleware — every request to `/api/v1/saas/*` must include an `x-api-key` header; the middleware queries the `ApiKey` MongoDB collection to verify the key exists and is active, increments the `requestsCount` field, updates `lastUsed` timestamp, and attaches the key record to the request object for downstream tier-based access control.

6. Rate limiting is applied to all SaaS routes using `express-rate-limit` — each IP address is limited to 100 requests per 15-minute window, with standardized rate limit headers returned in every response; this prevents API abuse, protects the backend from denial-of-service attacks, and ensures fair resource allocation across all enterprise clients sharing the same infrastructure.

---

## SLIDE 12 — RESULTS

1. The real-time update pipeline achieves sub-2-second latency from transaction confirmation to UI update — the contract event listener polls every 1.5 seconds, `rebuildPortfolio` reads and calculates metrics in under 200ms, MongoDB writes complete in under 100ms, and Socket.IO delivers the event to the frontend in under 50ms, resulting in a total end-to-end latency well within the 2-second threshold for a responsive user experience.

2. The dynamic credit system successfully demonstrates adaptive borrow limits — a fresh wallet starts with a 200 DAI credit limit and 100 Trust Identity Score; after 10 successful repayments, the trust score reaches 150 points and the available credit expands proportionally, validating the core hypothesis that on-chain behavioral history can serve as a reliable proxy for creditworthiness in a permissionless system.

3. The threat detection engine successfully identifies all four simulated attack types in the Threat Simulator — Flash Loan attacks are detected within the same polling cycle they occur, Oracle Manipulation triggers alerts within 1.5 seconds of the price deviation, Sybil patterns are flagged after analyzing wallet clustering behavior, and Velocity abuse is caught when transaction frequency exceeds the configured threshold, with all results saved to MongoDB and displayed on the Security Timeline.

4. The Transaction Explorer correctly merges data from both the `PortfolioTransaction` and `TransactionHistory` collections, deduplicates by transaction hash, and renders up to 100 transactions sorted newest-first — the in-memory filtering system handles search by hash or asset name, time range filtering (All Time, Today, 1 Hour), event type filtering, and high-risk-only filtering with zero additional API calls after the initial page load.

5. The governance module successfully demonstrates the full proposal lifecycle — a LAR token holder creates a proposal, the voting period opens, votes are cast with weight proportional to token balance, quorum is reached, the proposal is queued in the Timelock contract with a 72-hour delay, and after the delay expires the proposal is executed on-chain, with every step logged to the `GovernanceLog` MongoDB collection and visible in the governance page.

6. The Enterprise Cockpit successfully aggregates protocol-wide metrics in real time — TVL (Total Value Locked) reflects the sum of all supplied collateral, Total Borrowed reflects all outstanding debt, the Solvency Score (collateral/debt ratio) updates after every transaction, the Asset Risk Heatmap correctly shows LAR in green (low risk) and DAI in amber (moderate risk), and the fixed footer bar maintains live values for all five key metrics throughout the user session.

---

## SLIDE 13 — CONCLUSION

1. FortiFi successfully demonstrates that a fully functional, real-time DeFi lending and borrowing protocol can be built with open-source tools — Solidity, Truffle, Next.js, Node.js, MongoDB, and Socket.IO — without relying on any proprietary infrastructure, proving that institutional-grade financial applications are achievable on public blockchain networks.

2. The integration of a real-time analytics engine directly into the DeFi application layer represents a significant advancement over existing protocols — by detecting threats at the application level rather than relying solely on on-chain mechanisms, FortiFi provides an additional security layer that can respond to behavioral anomalies before they escalate into protocol-level exploits.

3. The dynamic credit scoring system based on on-chain behavioral history successfully addresses the financial inclusion problem — by replacing traditional credit checks with transparent, verifiable blockchain metrics, FortiFi creates a pathway for unbanked populations to access credit facilities based purely on their demonstrated financial behavior, regardless of their geographic location or institutional relationships.

4. The Socket.IO-based real-time architecture eliminates the dangerous information lag that exists in current DeFi interfaces — users no longer need to manually refresh pages to see updated balances, health factors, or security alerts; the system proactively pushes all relevant information to the user's screen within seconds of any on-chain state change, significantly reducing the risk of uninformed decision-making.

5. The project validates the technical feasibility of combining blockchain immutability with traditional database flexibility — smart contracts handle the trustless execution of financial logic and event emission, while MongoDB handles the complex querying, historical analytics, and real-time state management that would be prohibitively expensive to perform entirely on-chain.

6. FortiFi establishes a comprehensive blueprint for building production-ready DeFi applications — the architecture patterns demonstrated (per-wallet socket rooms, append-only snapshot design, normalised profile shapes, route ordering, idempotency keys, and dual-source transaction merging) are directly applicable to any DeFi protocol and represent a set of best practices for the next generation of decentralized financial applications.

---

## SLIDE 14 — FUTURE SCOPE

1. **Multi-Chain Deployment** — FortiFi is currently deployed on a local Ganache network; the next phase involves deploying the smart contracts to Ethereum Sepolia testnet and subsequently to Ethereum mainnet and Layer 2 networks such as Polygon and Arbitrum, which would reduce gas costs by 90%+ and make the protocol accessible to a global user base with real economic value at stake.

2. **Chainlink Integration for Live Price Feeds** — The current development environment uses MockV3Aggregator for price data; replacing this with live Chainlink decentralized oracle networks on testnet/mainnet would provide tamper-resistant, real-world asset prices for DAI, ETH, WETH, and LAR tokens, enabling accurate collateral valuation and liquidation triggers based on actual market conditions rather than simulated data.

3. **Machine Learning Risk Models** — The current risk scoring uses rule-based thresholds; integrating machine learning models trained on historical DeFi transaction data would enable more sophisticated anomaly detection, predictive liquidation warnings (alerting users before their health factor reaches the critical threshold), and personalized risk profiles that adapt to each wallet's unique behavioral patterns over time.

4. **Mobile Application with Push Notifications** — Building a React Native mobile application connected to the same backend would allow users to monitor their DeFi positions on the go; push notifications triggered by Socket.IO events would alert users immediately when their health factor drops below a safe threshold, when a security threat is detected, or when a governance proposal they voted on reaches execution — preventing liquidations even when users are away from their desktop.

5. **Cross-Protocol Aggregation** — Expanding FortiFi beyond its own lending protocol to aggregate positions from Aave, Compound, MakerDAO, and other DeFi protocols would create a unified portfolio dashboard where users can monitor all their DeFi exposure in one place; the risk engine would then calculate a holistic cross-protocol health factor and detect correlated risks that span multiple protocols simultaneously.

6. **Decentralized Identity and Verifiable Credentials** — Integrating W3C Decentralized Identifiers (DIDs) and Verifiable Credentials would allow users to optionally attach verified real-world identity attributes (KYC status, institutional accreditation) to their wallet without revealing personal data on-chain; this would unlock higher credit tiers for verified institutional users while maintaining full privacy for retail users who prefer to interact pseudonymously.
