# FortiFi: Autonomous DeFi Security & Lending Protocol

FortiFi is an enterprise-grade, security-first decentralized lending ecosystem. It combines a traditional lending MVP with an autonomous threat detection engine and adaptive smart contracts to protect users from modern DeFi exploits.

## 🏗️ Production Architecture

The platform is organized into a modular full-stack architecture designed for scalability and production readiness:

- `/frontend`: A Next.js dashboard featuring real-time security alerts, risk scoring, and a premium UI.
- `/backend`: A Node.js server orchestrating event listeners and providing REST APIs.
- `/contracts`: Solidity smart contracts integrated with OpenZeppelin security primitives.
- `/analytics`: Detection modules for Flash Loans, Oracle manipulation, and velocity spikes.
- `/database`: MongoDB models and connection logic.
- `/abis`: Compiled smart contract artifacts.

## 🛡️ Autonomous Security Features

1. Real-Time Threat Detection
2. Adaptive Risk Scoring
3. On-Chain Enforcement
4. Attack Simulation Framework

## 🚀 Getting Started

### Prerequisites
- Node.js v16+
- Truffle / Ganache
- MongoDB

### Installation
```bash
npm install