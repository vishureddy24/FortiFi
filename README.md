# FortiFi: Autonomous DeFi Security & Lending Protocol

FortiFi is an enterprise-grade, security-first decentralized lending ecosystem. It combines a traditional lending MVP with an autonomous threat detection engine and adaptive smart contracts to protect users from modern DeFi exploits.

## 🏗️ Production Architecture

The platform is organized into a modular full-stack architecture designed for scalability and production readiness:

- **`/frontend`**: A Next.js dashboard featuring real-time security alerts, risk scoring, and a premium "glassmorphism" UI.
- **`/backend`**: A Node.js server orchestrating event listeners and providing REST APIs for the dashboard.
- **`/contracts`**: Solidity smart contracts integrated with **OpenZeppelin** security primitives (`Pausable`, `ReentrancyGuard`).
- **`/analytics`**: The "brain" of the platform. Contains detection modules for Flash Loans, Oracle manipulation, and velocity spikes.
- **`/database`**: Centralized MongoDB models and connection logic.
- **`/abis`**: Compiled smart contract artifacts for frontend and backend consumption.

## 🛡️ Autonomous Security Features

1.  **Real-Time Threat Detection**: Monitors every block for suspicious patterns (Flash Loans, Price Drifts).
2.  **Adaptive Risk Scoring**: Dynamically calculates user and protocol-wide risk scores (0-10) based on on-chain behavior.
3.  **On-Chain Enforcement**: The security engine pushes high-risk scores on-chain, automatically restricting a user's borrowing power or pausing the protocol during an active exploit.
4.  **Attack Simulation Framework**: Built-in tools to stress-test the protocol against synthetic threats.

## 🚀 Getting Started

### Prerequisites
- Node.js v16+
- Truffle / Ganache
- MongoDB (Local or Atlas)

### Installation
```bash
npm install
```

### Development
To start both the frontend and backend in development mode:
```bash
npm run dev
```

### Smart Contract Deployment
```bash
truffle migrate --network development
```

## 📜 Deployment Targets
- **Local**: Ganache (Network ID 1337)
- **Testnet**: Ethereum Sepolia
- **Production**: Optimized for Layer 2s (Arbitrum/Optimism) for low-latency security synchronization.

---
*Created for Final Year Project / Startup MVP / Portfolio Demonstration.*
