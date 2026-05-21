const { ethers } = require('ethers');
const WalletSnapshotNew = require('../../database/models/WalletSnapshotNew');
const PortfolioTransaction = require('../../database/models/PortfolioTransaction');
const PortfolioAlert = require('../../database/models/PortfolioAlert');
const WalletProfile = require('../../database/models/WalletProfile');
const RiskScore = require('../../database/models/RiskScore');
const LendingAndBorrowingABI = require('../../abis/LendingAndBorrowing.json');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:7545';
const CONTRACT_ADDRESS = process.env.LENDING_PROTOCOL_ADDRESS;

// Get ethers provider
const getProvider = () => {
  if (RPC_URL.startsWith('ws')) {
    return new ethers.WebSocketProvider(RPC_URL);
  }
  return new ethers.JsonRpcProvider(RPC_URL);
};

const getContract = (provider) => {
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x...') return null;
  return new ethers.Contract(CONTRACT_ADDRESS, LendingAndBorrowingABI.abi, provider);
};

/**
 * Recalculate portfolio metrics and save a snapshot
 */
const createSnapshot = async (walletAddress, eventType = null, txHash = null) => {
  try {
    const wallet = walletAddress.toLowerCase();
    const rebuildPortfolio = require('../services/rebuildPortfolio');
    
    // Delegate calculation and persistence to the unified scoring engine
    const result = await rebuildPortfolio(wallet, eventType, txHash);
    
    if (result && result.snapshot) {
      // Emit risk:update event
      emitSocketUpdate(wallet, 'risk:update', {
        wallet: wallet.toLowerCase(),
        debt: result.outstandingDebt,
        collateral: result.suppliedCollateral,
        utilization: result.borrowUtilization,
        score: result.riskScore,
        updatedAt: new Date()
      });
  
      // Emit portfolio:update event
      emitSocketUpdate(wallet, 'portfolio:update', {
        walletAddress: wallet.toLowerCase(),
        profile: result,
        snapshot: result.snapshot
      });
  
      // Emit legacy portfolioUpdate event
      emitSocketUpdate(wallet, 'portfolioUpdate', {
        wallet,
        snapshot: result.snapshot,
        profile: result
      });
  
      return result.snapshot;
    }
  } catch (err) {
    console.error(`[PortfolioService] Error creating snapshot:`, err.message);
  }
};

/**
 * Record a transaction to portfolio_transactions
 */
const recordTransaction = async (walletAddress, txHash, asset, type, amount, gasUsed) => {
  try {
    const wallet = walletAddress.toLowerCase();
    
    // Check duplication
    const dup = await PortfolioTransaction.findOne({ txHash, type });
    if (dup) return dup;

    // Trigger snapshot update — pass eventType and txHash so rebuildPortfolio
    // applies the correct field-update rules and records the txHash on the snapshot.
    const rebuildPortfolio = require('../services/rebuildPortfolio');
    await rebuildPortfolio(wallet, type, txHash);

    // Retrieve the newly updated profile fields
    const profile = await WalletProfile.findOne({ address: wallet });
    const finalRiskScore = profile ? profile.riskScore : 0;
    const finalDebt = profile ? profile.totalDebt : 0;
    const finalUtilization = profile ? profile.borrowUtilization : 0;

    const tx = new PortfolioTransaction({
      wallet,
      txHash,
      asset: asset || 'DAI',
      type,
      amount,
      gasUsed,
      debtAfter: finalDebt,
      utilization: finalUtilization,
      riskScore: finalRiskScore,
      timestamp: new Date()
    });

    await tx.save();
    console.log(`[PortfolioService] Recorded transaction ${type} for ${wallet}. Risk: ${finalRiskScore}`);

    // Emit live update via socket
    emitSocketUpdate(wallet, 'transactionUpdate', tx);

    return tx;
  } catch (err) {
    console.error(`[PortfolioService] Error recording transaction:`, err.message);
  }
};

/**
 * Create a portfolio alert
 */
const createAlert = async (walletAddress, title, severity) => {
  try {
    const wallet = walletAddress.toLowerCase();

    // Prevent duplicate alert storm (e.g. within last 1 minute)
    const recentAlert = await PortfolioAlert.findOne({
      wallet,
      title,
      timestamp: { $gte: new Date(Date.now() - 60 * 1000) }
    });

    if (recentAlert) return recentAlert;

    const alert = new PortfolioAlert({
      wallet,
      title,
      severity,
      timestamp: new Date()
    });

    await alert.save();
    console.log(`[PortfolioService] Saved alert [${severity}] for ${wallet}: ${title}`);

    // Emit live update via socket
    emitSocketUpdate(wallet, 'alertUpdate', alert);

    return alert;
  } catch (err) {
    console.error(`[PortfolioService] Error creating alert:`, err.message);
  }
};

/**
 * Helper to emit WebSocket events
 * Room format: wallet:<address> — must match frontend join event
 */
const emitSocketUpdate = (wallet, event, data) => {
  if (global.io) {
    const room = `wallet:${wallet.toLowerCase()}`;
    console.log(`[PortfolioService] SOCKET_EMITTED: ${event} to ${room}`);
    global.io.to(room).emit(event, data);
  }
};

module.exports = {
  createSnapshot,
  recordTransaction,
  createAlert,
  getLatestSnapshot: async (wallet) => {
    const WalletScore = require('../../database/models/WalletScore');
    return await WalletScore.findOne({ walletAddress: wallet.toLowerCase() }).sort({ timestamp: -1 });
  },
  getHistory: async (wallet) => {
    const WalletScore = require('../../database/models/WalletScore');
    return await WalletScore.find({ walletAddress: wallet.toLowerCase() })
      .sort({ timestamp: -1 })
      .limit(100);
  },
  getTransactions: async (wallet) => {
    return await PortfolioTransaction.find({ wallet: wallet.toLowerCase() })
      .sort({ timestamp: -1 })
      .limit(100);
  }
};
