const { Web3 } = require('web3');
const LendingAndBorrowingABI = require('../../abis/LendingAndBorrowing.json');
const { processEvent } = require('../utils/eventProcessor');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:7545';
const CONTRACT_ADDRESS = process.env.LENDING_PROTOCOL_ADDRESS;

class ContractListener {
  constructor() {
    this.web3 = new Web3(RPC_URL);
    const isValidAddress = (addr) => addr && addr.startsWith('0x') && addr.length === 42 && addr !== '0x...';

    if (isValidAddress(CONTRACT_ADDRESS)) {
      this.contract = new this.web3.eth.Contract(LendingAndBorrowingABI.abi, CONTRACT_ADDRESS);
    } else {
      console.warn('[Listener] Valid Lending Protocol address not found in .env. Event monitoring disabled.');
    }
    this.reconnectInterval = 5000;
  }

  async start() {
    if (!this.contract) {
      console.warn('[Listener] No valid contract address — skipping legacy listener.');
      return;
    }

    // web3.js event subscriptions require a WebSocket provider.
    // When running on HTTP (Ganache default), subscriptions are not supported.
    // The realtime/portfolioListener.js (ethers.js polling) covers all the same
    // events on HTTP, so we skip the legacy subscription silently.
    if (!RPC_URL.startsWith('ws')) {
      console.log('[Listener] HTTP provider detected — legacy subscription listener disabled. portfolioListener.js handles events via polling.');
      return;
    }

    console.log(`[Listener] Connecting to ${RPC_URL}...`);
    this.subscribeToEvents();
  }

  subscribeToEvents() {
    console.log('[Listener] Monitoring contract events...');

    const events = [
      { name: 'Supply', type: 'Deposit' },
      { name: 'Borrow', type: 'Borrow' },
      { name: 'PayDebt', type: 'Repay' },
      { name: 'Withdraw', type: 'Withdraw' }
    ];

    events.forEach(eventConfig => {
      const eventFunc = this.contract.events[eventConfig.name];
      if (typeof eventFunc === 'function') {
        const subscription = eventFunc();
        subscription.on('data', (event) => processEvent(event, eventConfig.type));
        subscription.on('error', (err) => {
          console.error(`[Listener Error] ${eventConfig.name}: ${err.message}`);
          // Do not retry — avoid infinite reconnect loop on HTTP
        });
      } else {
        console.warn(`[Listener] Event ${eventConfig.name} not found in ABI.`);
      }
    });
  }
}

module.exports = new ContractListener();
