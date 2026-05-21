const { ethers } = require('ethers');
const EnterpriseWalletMetric = require('../../database/models/EnterpriseWalletMetric');
const EnterpriseSecurityLog = require('../../database/models/EnterpriseSecurityLog');
const EnterpriseTransaction = require('../../database/models/EnterpriseTransaction');
const WalletProfile = require('../../database/models/WalletProfile');
const RiskScore = require('../../database/models/RiskScore');
const LendingAndBorrowingABI = require('../../abis/LendingAndBorrowing.json');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:7545';
const CONTRACT_ADDRESS = process.env.LENDING_PROTOCOL_ADDRESS;

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
 * Recalculate enterprise wallet metrics and save to enterprise_wallet_metrics
 */
const updateEnterpriseMetrics = async (walletAddress) => {
  try {
    const wallet = walletAddress.toLowerCase();
    const provider = getProvider();
    const contract = getContract(provider);

    let tvl = 0;
    let borrowed = 0;

    if (contract) {
      try {
        const totalCollateralRaw = await contract.getTotalAmountLentInDollars(wallet);
        const totalDebtRaw = await contract.getTotalAmountBorrowedInDollars(wallet);
        tvl = Number(totalCollateralRaw) / 1e18;
        borrowed = Number(totalDebtRaw) / 1e18;
      } catch (cErr) {
        console.warn(`[EnterpriseService] Failed to fetch contract values: ${cErr.message}`);
      }
    }

    // Calculations
    const solvency = borrowed > 0 ? (tvl / borrowed) * 100 : 100;
    const activeLoans = borrowed > 0 ? 1 : 0;

    const metricSnapshot = new EnterpriseWalletMetric({
      wallet,
      tvl,
      borrowed,
      activeLoans,
      solvency,
      timestamp: new Date()
    });

    await metricSnapshot.save();
    console.log(`[EnterpriseService] Saved enterprise metric: TVL=$${tvl}, Solvency=${solvency.toFixed(1)}%`);

    // Check solvency limits for security warnings
    if (solvency < 120 && borrowed > 0) {
      await createSecurityLog(wallet, 'HIGH', `Liquidation Risk Alert: Solvency ratio dropped to ${solvency.toFixed(1)}%`);
    } else if (solvency < 150 && borrowed > 0) {
      await createSecurityLog(wallet, 'WARNING', `Solvency warning: Ratio is at ${solvency.toFixed(1)}%`);
    }

    // Emit live update
    emitSocketUpdate(wallet, 'enterprise:update', metricSnapshot);

    return metricSnapshot;
  } catch (err) {
    console.error(`[EnterpriseService] Error updating metrics:`, err.message);
  }
};

/**
 * Record a transaction log in enterprise_transactions
 */
const recordEnterpriseTransaction = async (walletAddress, txHash, type, amount, gasUsed) => {
  try {
    const wallet = walletAddress.toLowerCase();

    // Avoid duplication
    const duplicate = await EnterpriseTransaction.findOne({ txHash, type });
    if (duplicate) return duplicate;

    const tx = new EnterpriseTransaction({
      wallet,
      txHash,
      type,
      amount,
      timestamp: new Date()
    });

    await tx.save();
    console.log(`[EnterpriseService] Recorded enterprise transaction: ${type} of ${amount} for ${wallet}`);

    // Emit live update
    emitSocketUpdate(wallet, `tx:${wallet}`, tx);

    // Run autonomous anomaly detection
    await runAnomalyDetection(wallet, type, amount, gasUsed);

    // Trigger metrics recalculation
    await updateEnterpriseMetrics(wallet);

    return tx;
  } catch (err) {
    console.error(`[EnterpriseService] Error recording transaction:`, err.message);
  }
};

/**
 * Save an autonomous security anomaly log to enterprise_security_logs
 */
const createSecurityLog = async (walletAddress, severity, event) => {
  try {
    const wallet = walletAddress.toLowerCase();

    // Prevent duplicate alert spam
    const recent = await EnterpriseSecurityLog.findOne({
      wallet,
      event,
      timestamp: { $gte: new Date(Date.now() - 30 * 1000) }
    });
    if (recent) return recent;

    const log = new EnterpriseSecurityLog({
      wallet,
      severity,
      event,
      timestamp: new Date()
    });

    await log.save();
    console.log(`[EnterpriseService] [${severity}] Security Log for ${wallet}: ${event}`);

    // Emit live updates
    emitSocketUpdate(wallet, `security:${wallet}`, log);

    // Emit risk update
    const riskRecord = await RiskScore.findOne({ address: wallet });
    const currentRisk = riskRecord ? riskRecord.score : 0;
    emitSocketUpdate(wallet, `risk:${wallet}`, { wallet, riskScore: currentRisk });

    return log;
  } catch (err) {
    console.error(`[EnterpriseService] Error creating security log:`, err.message);
  }
};

/**
 * Anomaly Detection Rules Engine
 */
const runAnomalyDetection = async (wallet, type, amount, gasUsed) => {
  // 1. Abnormal borrowing size
  if (type === 'Borrow' && amount > 150) {
    await createSecurityLog(wallet, 'HIGH', `Abnormal borrowing action: Single loan borrow of ${amount} DAI exceeding safety thresholds.`);
  }

  // 2. High Transaction Gas Limits (Possible exploit layout footprint)
  if (gasUsed && gasUsed > 200000) {
    await createSecurityLog(wallet, 'HIGH', `Suspicious gas execution pattern: Gas usage of ${gasUsed.toLocaleString()} suggests high execution depth.`);
  }

  // 3. Oracle manipulation threat heuristic
  if (type === 'Supply' && amount > 500) {
    await createSecurityLog(wallet, 'WARNING', `Large supply influx: Collateral supply of ${amount} LAR could shift reserve parameters.`);
  }

  // 4. Repeated operations (Suspicious velocity/Flash loans)
  const recentCount = await EnterpriseTransaction.countDocuments({
    wallet,
    timestamp: { $gte: new Date(Date.now() - 15 * 1000) }
  });
  if (recentCount > 3) {
    await createSecurityLog(wallet, 'HIGH', `Suspicious high-velocity transactions: Potential flash loan or recursive loop executed.`);
  }
};

/**
 * Helper to emit WebSocket events across all requested room configurations and channels
 */
const emitSocketUpdate = (wallet, event, data) => {
  if (global.io) {
    const w = wallet.toLowerCase();
    
    // Send to specific room wallet:<address>
    global.io.to(`wallet:${w}`).emit(event, data);

    // Broadcast globally to match event name listeners
    global.io.emit(event, data);
    global.io.emit(`wallet:${w}`, data);
  }
};

module.exports = {
  updateEnterpriseMetrics,
  recordEnterpriseTransaction,
  createSecurityLog,
  getLatestMetrics: async (wallet) => {
    return await EnterpriseWalletMetric.findOne({ wallet: wallet.toLowerCase() }).sort({ timestamp: -1 });
  },
  getMetricsHistory: async (wallet) => {
    return await EnterpriseWalletMetric.find({ wallet: wallet.toLowerCase() })
      .sort({ timestamp: -1 })
      .limit(100);
  },
  getSecurityLogs: async (wallet) => {
    return await EnterpriseSecurityLog.find({ wallet: wallet.toLowerCase() })
      .sort({ timestamp: -1 })
      .limit(50);
  },
  getTransactions: async (wallet) => {
    return await EnterpriseTransaction.find({ wallet: wallet.toLowerCase() })
      .sort({ timestamp: -1 })
      .limit(100);
  }
};
