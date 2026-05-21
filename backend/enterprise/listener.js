const { ethers } = require('ethers');
const enterpriseService = require('./enterpriseService');
const LendingAndBorrowingABI = require('../../abis/LendingAndBorrowing.json');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:7545';
const CONTRACT_ADDRESS = process.env.LENDING_PROTOCOL_ADDRESS;

class EnterpriseListener {
  constructor() {
    this.reconnectInterval = 5000;
  }

  start() {
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x...') {
      console.warn('[EnterpriseListener] No contract address configured. Ethers.js listener skipped.');
      return;
    }

    try {
      console.log(`[EnterpriseListener] Connecting to RPC: ${RPC_URL}`);
      this.provider = RPC_URL.startsWith('ws')
        ? new ethers.WebSocketProvider(RPC_URL)
        : new ethers.JsonRpcProvider(RPC_URL);

      this.contract = new ethers.Contract(CONTRACT_ADDRESS, LendingAndBorrowingABI.abi, this.provider);
      this.subscribeToEvents();
    } catch (err) {
      console.error('[EnterpriseListener] Initialization failed:', err.message);
      this.handleRetry();
    }
  }

  async subscribeToEvents() {
    console.log('[EnterpriseListener] Subscribing to contract events...');

    const eventHandlers = {
      Supply: async (from, to, asset, amount, timestamp, event) => {
        try {
          console.log(`[EnterpriseListener] Supply event: ${amount} from ${from}`);
          const gas = await this.getGasUsed(event.log.transactionHash);
          await enterpriseService.recordEnterpriseTransaction(
            from,
            event.log.transactionHash,
            'Supply',
            Number(amount) / 1e18,
            gas
          );
        } catch (err) {
          console.error('[EnterpriseListener] Error processing Supply event:', err.message);
        }
      },
      Borrow: async (borrower, lenderPool, asset, amount, timestamp, event) => {
        try {
          console.log(`[EnterpriseListener] Borrow event: ${amount} for ${borrower}`);
          const gas = await this.getGasUsed(event.log.transactionHash);
          await enterpriseService.recordEnterpriseTransaction(
            borrower,
            event.log.transactionHash,
            'Borrow',
            Number(amount) / 1e18,
            gas
          );
        } catch (err) {
          console.error('[EnterpriseListener] Error processing Borrow event:', err.message);
        }
      },
      Repay: async (payer, protocol, asset, amount, timestamp, event) => {
        try {
          console.log(`[EnterpriseListener] Repay event: ${amount} by ${payer}`);
          const gas = await this.getGasUsed(event.log.transactionHash);
          await enterpriseService.recordEnterpriseTransaction(
            payer,
            event.log.transactionHash,
            'Repay',
            Number(amount) / 1e18,
            gas
          );
        } catch (err) {
          console.error('[EnterpriseListener] Error processing Repay event:', err.message);
        }
      },
      Withdraw: async (protocol, user, asset, amount, timestamp, event) => {
        try {
          console.log(`[EnterpriseListener] Withdraw event: ${amount} by ${user}`);
          const gas = await this.getGasUsed(event.log.transactionHash);
          await enterpriseService.recordEnterpriseTransaction(
            user,
            event.log.transactionHash,
            'Withdraw',
            Number(amount) / 1e18,
            gas
          );
        } catch (err) {
          console.error('[EnterpriseListener] Error processing Withdraw event:', err.message);
        }
      }
    };

    for (const [eventName, handler] of Object.entries(eventHandlers)) {
      try {
        await this.contract.on(eventName, handler);
        console.log(`[EnterpriseListener] Registered listener for: ${eventName}`);
      } catch (err) {
        console.warn(`[EnterpriseListener] Event ${eventName} subscription error:`, err.message);
      }
    }
  }

  async getGasUsed(txHash) {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt ? Number(receipt.gasUsed) : 0;
    } catch (err) {
      console.warn(`[EnterpriseListener] Could not fetch gasUsed: ${err.message}`);
      return 0;
    }
  }

  handleRetry() {
    setTimeout(() => this.start(), this.reconnectInterval);
  }
}

module.exports = new EnterpriseListener();
