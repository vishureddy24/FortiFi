const WalletProfile = require('../../database/models/WalletProfile');
const ProtocolSnapshot = require('../../database/models/ProtocolSnapshot');
const WalletSnapshot = require('../../database/models/WalletSnapshot');
const SecurityLog = require('../../database/models/SecurityLog');
const TransactionHistory = require('../../database/models/TransactionHistory');
const Alert = require('../../database/models/Alert');

const getGlobalTelemetry = async () => {
  try {
    const profiles = await WalletProfile.find();
    
    let tvl = 0;
    let totalBorrowed = 0;
    let activeLoans = 0;
    
    profiles.forEach(p => {
      tvl += p.totalCollateral || 0;
      totalBorrowed += p.totalDebt || 0;
      if ((p.totalDebt || 0) > 0) {
        activeLoans++;
      }
    });
    
    const liveWalletCount = profiles.length;
    const solvencyScore = tvl > 0 ? Math.round(Math.max(0, Math.min(100, ((tvl - totalBorrowed) * 100) / tvl))) : 100;
    
    const metrics = {
      tvl,
      totalBorrowed,
      activeLoans,
      solvencyScore,
      liveWalletCount,
      timestamp: new Date()
    };
    
    // Save snapshot in database
    const snapshot = new ProtocolSnapshot(metrics);
    await snapshot.save();
    
    // Broadcast via global Socket.io channels
    if (global.io) {
      global.io.emit('globalTelemetryUpdate', metrics);
    }
    
    return metrics;
  } catch (err) {
    console.error('[Telemetry Service] Failed to calculate global telemetry:', err.message);
    return null;
  }
};

const getWalletTelemetry = async (walletAddress) => {
  try {
    const address = walletAddress.toLowerCase();
    const profile = await WalletProfile.findOne({ address });
    if (!profile) return null;
    
    const metrics = {
      walletAddress: address,
      collateral: profile.totalCollateral || 0,
      debt: profile.totalDebt || 0,
      healthFactor: profile.healthFactor || 100,
      riskScore: profile.riskScore || 0,
      utilization: profile.borrowUtilization || 0,
      creditLimit: profile.totalBorrowLimit || 200,
      availableBorrow: profile.availableBorrowLimit || 200,
      trustScore: profile.trustScore || 100,
      accountTier: profile.accountTier || 'Tier 1',
      borrowEligibility: profile.borrowEligibility,
      timestamp: new Date()
    };
    
    // Save snapshot
    const walletSnapshot = new WalletSnapshot({
      walletAddress: address,
      collateral: metrics.collateral,
      debt: metrics.debt,
      healthFactor: metrics.healthFactor,
      riskScore: metrics.riskScore,
      utilization: metrics.utilization
    });
    await walletSnapshot.save();
    
    // Broadcast over WebSocket specifically to the wallet's room
    if (global.io) {
      const room = `wallet_${address}`;
      global.io.to(room).emit('walletTelemetryUpdate', metrics);
    }
    
    return metrics;
  } catch (err) {
    console.error(`[Telemetry Service] Failed to calculate wallet telemetry for ${walletAddress}:`, err.message);
    return null;
  }
};

module.exports = {
  getGlobalTelemetry,
  getWalletTelemetry
};
