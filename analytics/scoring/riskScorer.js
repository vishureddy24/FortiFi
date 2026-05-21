const RiskScore = require('../../database/models/RiskScore');
const blockchainService = require('../../backend/services/blockchainService');

/**
 * Risk Scoring Engine
 * Calculates user and protocol-wide risk scores (0-10).
 */
const updateRiskScore = async (userAddress, results) => {
  try {
    let riskEntry = await RiskScore.findOne({ address: userAddress });
    if (!riskEntry) {
      riskEntry = new RiskScore({ address: userAddress });
    }

    // Weighting Factors (Total weight = 1.0)
    const weights = {
      flashLoan: 0.35,      // High severity
      oracle: 0.30,         // Critical impact
      velocity: 0.15,       // Activity patterns
      liquidity: 0.10,      // Market impact
      behavior: 0.10        // General suspiciousness
    };

    // Calculate weighted raw score
    let weightedTotal = 0;
    if (results.flashLoan) {
      riskEntry.factors.flashLoan += results.flashLoan;
      weightedTotal += results.flashLoan * weights.flashLoan;
    }
    if (results.oracle) {
      riskEntry.factors.oracleManipulation += results.oracle;
      weightedTotal += results.oracle * weights.oracle;
    }
    if (results.velocity) {
      riskEntry.factors.velocity += results.velocity;
      weightedTotal += results.velocity * weights.velocity;
    }
    if (results.liquidity) {
      riskEntry.factors.liquidityAnomaly += results.liquidity;
      weightedTotal += results.liquidity * weights.liquidity;
    }
    if (results.behavior) {
      riskEntry.factors.suspiciousBehavior += results.behavior;
      weightedTotal += results.behavior * weights.behavior;
    }

    // Normalize to 0-10 scale
    const previousRisk = riskEntry.score || 0;
    riskEntry.score = Math.min(10, weightedTotal);
    riskEntry.lastUpdated = new Date();

    await riskEntry.save();

    // Log to permanent RiskHistory
    try {
      const RiskHistory = require('../../database/models/RiskHistory');
      const triggers = Object.keys(results).filter(k => results[k] > 0).join(', ');
      
      const riskHistory = new RiskHistory({
        walletAddress: userAddress.toLowerCase(),
        previousRisk: previousRisk,
        updatedRisk: riskEntry.score,
        triggerType: triggers || 'Risk evaluation',
        threatDetected: riskEntry.score >= 5,
        protocolActionTaken: riskEntry.score >= 7 ? 'Suspended borrowEligibility' : (riskEntry.score >= 5 ? 'Reduced trustScore' : 'None')
      });
      await riskHistory.save();
      console.log(`[Risk Engine] RiskHistory stored for ${userAddress}. Score: ${previousRisk} -> ${riskEntry.score}`);
      
      if (global.io) {
        const room = `wallet_${userAddress.toLowerCase()}`;
        global.io.to(room).emit('riskHistoryUpdate', {
          walletAddress: userAddress.toLowerCase(),
          riskHistory
        });
      }
    } catch (rhErr) {
      console.warn('[Risk Engine] Failed to save RiskHistory:', rhErr.message);
    }

    // Sync to Blockchain
    await blockchainService.syncRiskScore(userAddress, riskEntry.score);

    // Update WalletProfile based on risk score (Security Preservation)
    try {
      const WalletProfile = require('../../database/models/WalletProfile');
      let profile = await WalletProfile.findOne({ address: userAddress.toLowerCase() });
      if (profile) {
        profile.riskScore = Math.round(riskEntry.score * 10); // scale 0-10 to 0-100
        
        // If risk score is high, lower trust score
        if (riskEntry.score > 4) {
          profile.trustScore = Math.max(0, (profile.trustScore || 100) - Math.round(riskEntry.score * 5));
          
          // Downgrade account tier if trust score falls
          if (profile.trustScore < 90) {
            profile.accountTier = 'Tier 1';
            profile.totalBorrowLimit = 200;
            profile.maximumBorrowAmount = 200;
          } else if (profile.trustScore < 115) {
            profile.accountTier = 'Tier 2';
            profile.totalBorrowLimit = 500;
            profile.maximumBorrowAmount = 500;
          }
          
          profile.availableBorrowLimit = Math.max(0, profile.totalBorrowLimit - profile.borrowedOutstanding);
        }
        
        // If risk score is critical, suspend eligibility
        if (riskEntry.score > 7) {
          profile.borrowEligibility = false;
          if (!profile.tags) profile.tags = [];
          if (!profile.tags.includes('suspended')) {
            profile.tags.push('suspended');
          }
        } else {
          profile.borrowEligibility = true;
          if (profile.tags) {
            profile.tags = profile.tags.filter(t => t !== 'suspended');
          }
        }
        
        await profile.save();
        
        // Sync the risk-adjusted credit profile to the smart contract on-chain
        await blockchainService.syncAccountBorrowProfile(userAddress, profile);
        
        if (global.io) {
          const room = `wallet_${userAddress.toLowerCase()}`;
          global.io.to(room).emit('creditProfileUpdate', {
            address: userAddress.toLowerCase(),
            profile
          });
          // Also broadcast globally as fallback
          global.io.emit('creditProfileUpdate', {
            address: userAddress.toLowerCase(),
            profile
          });
        }
      }
    } catch (wpErr) {
      console.warn('[Scoring Error] Failed to update WalletProfile credit line:', wpErr.message);
    }

    // Update protocol-wide risk score
    await updateProtocolRisk();

    return riskEntry.score;
  } catch (err) {
    console.error('[Scoring Error]', err.message);
  }
};

const updateProtocolRisk = async () => {
  const allUserScores = await RiskScore.find({ address: { $ne: 'protocol' } });
  if (allUserScores.length === 0) return;

  const avgScore = allUserScores.reduce((a, b) => a + b.score, 0) / allUserScores.length;
  
  await RiskScore.findOneAndUpdate(
    { address: 'protocol' },
    { 
      score: Math.min(10, avgScore * 1.5), // Protocol risk is sensitive to user risks
      lastUpdated: new Date()
    },
    { upsert: true }
  );
};

module.exports = { updateRiskScore };
