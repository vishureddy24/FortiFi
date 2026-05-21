const { ethers } = require('ethers');
const portfolioService = require('./portfolioService');
const LendingAndBorrowingABI = require('../../abis/LendingAndBorrowing.json');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:7545';
const CONTRACT_ADDRESS = process.env.LENDING_PROTOCOL_ADDRESS;

class PortfolioListener {
  constructor() {
    this.reconnectInterval = 5000;
  }

  start() {
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x...') {
      console.warn('[PortfolioListener] No valid contract address configured. Ethers.js listener skipped.');
      return;
    }

    try {
      console.log(`[PortfolioListener] Connecting to RPC: ${RPC_URL}`);
      // Fallback: Ethers WebSocket provider works best with ws/wss. If http is configured, use JsonRpcProvider
      this.provider = RPC_URL.startsWith('ws')
        ? new ethers.WebSocketProvider(RPC_URL)
        : new ethers.JsonRpcProvider(RPC_URL);

      this.contract = new ethers.Contract(CONTRACT_ADDRESS, LendingAndBorrowingABI.abi, this.provider);
      this.subscribeToEvents();
    } catch (err) {
      console.error('[PortfolioListener] Initialization failed:', err.message);
      this.handleRetry();
    }
  }

  async subscribeToEvents() {
    console.log('[PortfolioListener] Subscribing to contract events (Ethers.js)...');

    const eventHandlers = {
      Supply: async (from, to, asset, amount, timestamp, event) => {
        try {
          console.log(`[PortfolioListener] Supply event: ${amount} from ${from}`);
          const gas = await this.getGasUsed(event.log.transactionHash);
          await portfolioService.recordTransaction(
            from,
            event.log.transactionHash,
            'LAR',
            'Supply',
            Number(amount) / 1e18,
            gas
          );
        } catch (err) {
          console.error('[PortfolioListener] Error processing Supply event:', err.message);
        }
      },
      Borrow: async (borrower, lenderPool, asset, amount, timestamp, event) => {
        try {
          console.log(`[PortfolioListener] Borrow event: ${amount} for ${borrower}`);
          const gas = await this.getGasUsed(event.log.transactionHash);
          await portfolioService.recordTransaction(
            borrower,
            event.log.transactionHash,
            'DAI',
            'Borrow',
            Number(amount) / 1e18,
            gas
          );
        } catch (err) {
          console.error('[PortfolioListener] Error processing Borrow event:', err.message);
        }
      },
      Repay: async (payer, protocol, asset, amount, timestamp, event) => {
        try {
          console.log(`[PortfolioListener] Repay event: ${amount} by ${payer}`);
          const gas = await this.getGasUsed(event.log.transactionHash);
          await portfolioService.recordTransaction(
            payer,
            event.log.transactionHash,
            'DAI',
            'Repay',
            Number(amount) / 1e18,
            gas
          );
        } catch (err) {
          console.error('[PortfolioListener] Error processing Repay event:', err.message);
        }
      },
      Withdraw: async (protocol, user, asset, amount, timestamp, event) => {
        try {
          console.log(`[PortfolioListener] Withdraw event: ${amount} by ${user}`);
          const gas = await this.getGasUsed(event.log.transactionHash);
          await portfolioService.recordTransaction(
            user,
            event.log.transactionHash,
            'LAR',
            'Withdraw',
            Number(amount) / 1e18,
            gas
          );
        } catch (err) {
          console.error('[PortfolioListener] Error processing Withdraw event:', err.message);
        }
      }
    };

    for (const [eventName, handler] of Object.entries(eventHandlers)) {
      try {
        await this.contract.on(eventName, handler);
        console.log(`[PortfolioListener] Registered listener for: ${eventName}`);
      } catch (err) {
        console.warn(`[PortfolioListener] Event ${eventName} subscription error:`, err.message);
      }
    }
  }

  async getGasUsed(txHash) {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt ? Number(receipt.gasUsed) : 0;
    } catch (err) {
      console.warn(`[PortfolioListener] Could not fetch gasUsed: ${err.message}`);
      return 0;
    }
  }

  handleRetry() {
    setTimeout(() => this.start(), this.reconnectInterval);
  }
}

module.exports = new PortfolioListener();
