const Transaction = require('../../database/models/Transaction');
const User = require('../../database/models/User');
const WalletProfile = require('../../database/models/WalletProfile');
const WalletCreditState = require('../../database/models/WalletCreditState');
const { Web3 } = require('web3');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:7545';
const CONTRACT_ADDRESS = process.env.LENDING_PROTOCOL_ADDRESS;

// Threat Detection Modules
const { detectFlashLoan } = require('../../analytics/detection/flashLoanDetector');
const { detectOracleDeviation } = require('../../analytics/detection/oracleDetector');
const { detectVelocity } = require('../../analytics/detection/velocityDetector');
const { detectLiquidityAnomaly } = require('../../analytics/detection/liquidityDetector');
const { detectSuspiciousBehavior } = require('../../analytics/detection/behaviorDetector');
const { detectSybil } = require('../../analytics/detection/sybilDetector');
const { detectWhaleManipulation } = require('../../analytics/detection/whaleDetector');

// Scoring & Alerting
const { updateRiskScore } = require('../../analytics/scoring/riskScorer');
const { triggerAlert } = require('../../backend/alerting/alertManager');

const rebuildPortfolio = require('../services/rebuildPortfolio');

const updateRealTimeWalletProfile = async (userAddress, type = null, transactionHash = null) => {
  try {
    const result = await rebuildPortfolio(userAddress, type, transactionHash);
    
    if (result && global.io) {
      const room = `wallet:${userAddress.toLowerCase()}`;
      
      // Emit risk:update event
      global.io.to(room).emit('risk:update', {
        wallet: userAddress.toLowerCase(),
        debt: result.outstandingDebt,
        collateral: result.collateral,
        utilization: result.utilization,
        score: result.riskScore,
        updatedAt: new Date()
      });
      global.io.emit('risk:update', {
        wallet: userAddress.toLowerCase(),
        debt: result.outstandingDebt,
        collateral: result.collateral,
        utilization: result.utilization,
        score: result.riskScore,
        updatedAt: new Date()
      });

      // Fetch profile and snapshot
      const WalletProfile = require('../../database/models/WalletProfile');
      const PortfolioSnapshot = require('../../database/models/PortfolioSnapshot');
      const profile = await WalletProfile.findOne({ address: userAddress.toLowerCase() });
      const snapshot = await PortfolioSnapshot.findOne({ walletAddress: userAddress.toLowerCase() }).sort({ timestamp: -1 });

      // Emit portfolio:update event
      global.io.to(room).emit('portfolio:update', {
        walletAddress: userAddress.toLowerCase(),
        profile,
        snapshot
      });
      global.io.emit('portfolio:update', {
        walletAddress: userAddress.toLowerCase(),
        profile,
        snapshot
      });

      // Backward compatibility event
      global.io.to(`wallet_${userAddress.toLowerCase()}`).emit('portfolioUpdate', {
        walletAddress: userAddress.toLowerCase(),
        profile,
        snapshot
      });
      global.io.emit('portfolioUpdate', {
        walletAddress: userAddress.toLowerCase(),
        profile,
        snapshot
      });
    }
  } catch (err) {
    console.error('[Real-Time Engine] Error updating real-time wallet profile:', err.message);
  }
};

const processEvent = async (event, type) => {
  try {
    const { transactionHash, blockNumber, logIndex, returnValues } = event;
    const eventId = `${transactionHash}_${logIndex}`;

    // Extract new returnValues
    let fromAddress, toAddress;
    const tokenAddress = returnValues.asset;
    const amount = returnValues.amount || '0';
    const timestamp = returnValues.timestamp ? new Date(returnValues.timestamp * 1000) : new Date();

    if (type === 'Deposit' || type === 'Supply') {
      fromAddress = returnValues.from;
      toAddress = returnValues.to;
    } else if (type === 'Borrow') {
      fromAddress = returnValues.lenderPool;
      toAddress = returnValues.borrower;
    } else if (type === 'Repay') {
      fromAddress = returnValues.payer;
      toAddress = returnValues.protocol;
    } else if (type === 'Withdraw') {
      fromAddress = returnValues.protocol;
      toAddress = returnValues.user;
    }

    const userAddress = type === 'Withdraw' || type === 'Borrow' ? toAddress : fromAddress;

    // 1. Deduplication: Check if transaction or event already exists
    const existingTx = await Transaction.findOne({ 
      $or: [
        { txHash: transactionHash },
        { eventId: eventId }
      ]
    });

    if (existingTx) {
      console.log(`[Skip] Duplicate event detected: ${eventId}`);
      return;
    }

    // 2. Update User activity
    if (userAddress) {
      await User.findOneAndUpdate(
        { walletAddress: userAddress },
        { $set: { lastActive: new Date() } },
        { upsert: true }
      );
    }

    // Fetch transaction receipt for exact gasUsed in background
    let gasUsed = 0;
    try {
      const web3Instance = new Web3(RPC_URL);
      const receipt = await web3Instance.eth.getTransactionReceipt(transactionHash);
      if (receipt) {
        gasUsed = Number(receipt.gasUsed);
      }
    } catch (gErr) {
      console.warn('[Real-Time Engine] Failed to fetch transaction receipt:', gErr.message);
    }

    // 3. Save Transaction
    const tx = new Transaction({
      txHash: transactionHash,
      eventId: eventId,
      fromAddress: fromAddress || 'Unknown',
      toAddress: toAddress || 'Unknown',
      tokenAddress: tokenAddress || 'Unknown',
      tokenSymbol: 'TBD',
      amount: Number(amount) / 1e18, // Save as ether format or native number
      actionType: type,
      blockNumber: blockNumber,
      timestamp: timestamp,
      status: 'Confirmed'
    });

    await tx.save();

    // 3b. Update Wallet Profile Credit-Line metrics
    if (userAddress) {
      const amountNum = Number(amount) / 1e18;
      try {
        // Find or create profile
        let profile = await WalletProfile.findOne({ address: userAddress.toLowerCase() });
        if (!profile) {
          profile = new WalletProfile({
            address: userAddress.toLowerCase(),
            trustScore: 100,
            repaymentCount: 0,
            accountTier: 'Tier 1'
          });
        }

        if (type === 'Borrow') {
          const prevVol = parseFloat(profile.historicalBorrowVolume) || 0;
          profile.historicalBorrowVolume = (prevVol + amountNum).toString();
        } else if (type === 'Repay') {
          profile.repaymentCount += 1;
          
          // Trust score reward: Good repayment behavior increases trust score by 10 points!
          profile.trustScore = (profile.trustScore || 100) + 10;
          
          let previousTier = profile.accountTier;
          if (profile.repaymentCount >= 5 && profile.trustScore >= 130) {
            profile.accountTier = 'Tier 3';
          } else if (profile.repaymentCount >= 2 && profile.trustScore >= 110) {
            profile.accountTier = 'Tier 2';
          } else {
            profile.accountTier = 'Tier 1';
          }
          
          if (profile.accountTier !== previousTier) {
            if (!profile.tags) profile.tags = [];
            const tierTag = `unlocked-${profile.accountTier.toLowerCase().replace(' ', '')}`;
            if (!profile.tags.includes(tierTag)) {
              profile.tags.push(tierTag);
            }
          }
        } else if (type === 'Deposit' || type === 'Supply') {
          const prevLend = parseFloat(profile.historicalLendVolume) || 0;
          profile.historicalLendVolume = (prevLend + amountNum).toString();
        }

        await profile.save();
        console.log(`[Behavior Engine] WalletProfile updated for ${userAddress}. Tier: ${profile.accountTier}`);
        
        // Push full real-time portfolio portfolio metrics and snapshot update
        await updateRealTimeWalletProfile(userAddress, type, transactionHash);

        // Save Transaction post-txn stats and TransactionHistory with computed risk score
        try {
          const WalletProfile = require('../../database/models/WalletProfile');
          const updatedProfile = await WalletProfile.findOne({ address: userAddress.toLowerCase() });
          const finalRiskScore = updatedProfile ? updatedProfile.riskScore : 0;
          const finalDebt = updatedProfile ? updatedProfile.totalDebt : 0;
          const finalUtilization = updatedProfile ? updatedProfile.borrowUtilization : 0;

          // Update Transaction record
          tx.debtAfter = finalDebt;
          tx.utilization = finalUtilization;
          tx.riskScore = finalRiskScore;
          tx.walletRiskScore = finalRiskScore;
          await tx.save();

          // Create TransactionHistory record
          const TransactionHistory = require('../../database/models/TransactionHistory');
          const idempotencyKey = `${transactionHash}_${logIndex}`;
          const dup = await TransactionHistory.findOne({ idempotencyKey });
          if (!dup) {
            let tokenName = 'DAI';
            if (tokenAddress) {
              if (tokenAddress.toLowerCase() === CONTRACT_ADDRESS?.toLowerCase()) {
                tokenName = 'LAR';
              }
            }
            const txHistory = new TransactionHistory({
              walletAddress: userAddress.toLowerCase(),
              txHash: transactionHash,
              idempotencyKey: idempotencyKey,
              eventType: type === 'Deposit' ? 'Supply' : type,
              token: tokenName,
              amount: Number(amount) / 1e18,
              fromAddress: fromAddress,
              toAddress: toAddress,
              protocolAddress: CONTRACT_ADDRESS,
              timestamp: timestamp,
              blockNumber: blockNumber,
              gasUsed: gasUsed,
              status: 'Confirmed',
              riskScoreSnapshot: finalRiskScore
            });
            await txHistory.save();

            if (global.io) {
              const room = `wallet:${userAddress.toLowerCase()}`;
              global.io.to(room).emit('tx:new', {
                walletAddress: userAddress.toLowerCase(),
                transaction: txHistory
              });
              global.io.emit('tx:new', {
                walletAddress: userAddress.toLowerCase(),
                transaction: txHistory
              });
              // Backward compatibility
              global.io.to(`wallet_${userAddress.toLowerCase()}`).emit('transactionHistoryUpdate', {
                walletAddress: userAddress.toLowerCase(),
                transaction: txHistory
              });
              global.io.emit('transactionHistoryUpdate', {
                walletAddress: userAddress.toLowerCase(),
                transaction: txHistory
              });
            }
          }
        } catch (postTxErr) {
          console.warn('[Real-Time Engine] Failed to complete post-txn updates:', postTxErr.message);
        }
        
      } catch (wpErr) {
        console.warn(`[Credit Engine] Failed to update profile for ${userAddress}:`, wpErr.message);
      }
    }

    // 4. RUN THREAT DETECTION
    const detections = {
      flashLoan: await detectFlashLoan(event, type),
      oracle: await detectOracleDeviation(event, type),
      velocity: await detectVelocity(event, type),
      liquidity: await detectLiquidityAnomaly(event, type),
      behavior: await detectSuspiciousBehavior(event, type),
      sybil: await detectSybil(event, type),
      whale: await detectWhaleManipulation(event, type)
    };

    // 5. PROCESS RESULTS
    const scoreChanges = {};
    for (const [key, result] of Object.entries(detections)) {
      if (result.detected) {
        scoreChanges[key] = result.scoreWeight;
        await triggerAlert(userAddress, result);

        // Capture autonomous SecurityLog in MongoDB immediately
        try {
          const SecurityLog = require('../../database/models/SecurityLog');
          const severity = result.scoreWeight >= 7 ? 'HIGH' : (result.scoreWeight >= 4 ? 'WARNING' : 'INFO');
          
          const log = new SecurityLog({
            walletAddress: userAddress.toLowerCase(),
            severity: severity,
            threatType: key,
            message: result.details || `Autonomous risk engine flagged suspicious ${key} threat pattern.`,
            txHash: transactionHash,
            blockNumber: blockNumber || 0,
            mitigationAction: severity === 'HIGH' ? 'Suspended borrowEligibility' : 'Triggered alarm & reduced trustScore',
            confidenceScore: 0.95
          });
          await log.save();
          console.log(`[Security Threat Engine] Captured security log on MongoDB: ${key} (${severity})`);

          // Broadcast live security log over Socket.io
          if (global.io) {
            const room = `wallet_${userAddress.toLowerCase()}`;
            global.io.to(room).emit('securityLogUpdate', log);
            global.io.emit('securityLogUpdate', log);
          }
        } catch (logErr) {
          console.warn('[Security Threat Engine] Failed to record SecurityLog:', logErr.message);
        }
      }
    }

    // 6. UPDATE RISK SCORES
    if (Object.keys(scoreChanges).length > 0) {
      await updateRiskScore(userAddress, scoreChanges);
    }

    // Recalculate global and wallet-specific telemetry streams instantly!
    try {
      const telemetryService = require('../services/telemetryService');
      await telemetryService.getWalletTelemetry(userAddress);
      await telemetryService.getGlobalTelemetry();
      console.log(`[Real-Time Telemetry] Dispatched updated global and user telemetry streams for ${userAddress}`);
    } catch (telErr) {
      console.warn('[Real-Time Telemetry] Failed to compute live telemetries:', telErr.message);
    }

    console.log(`[Success] Processed ${type} event from ${userAddress}`);
  } catch (err) {
    console.error(`[Error] Failed to process ${type} event:`, err.message);
  }
};

module.exports = { processEvent };

