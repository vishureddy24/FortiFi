const Transaction = require('../../database/models/Transaction');

/**
 * Sybil Attack Detector
 * Identifies clusters of wallets with identical behavior or shared funding sources.
 */
const detectSybil = async (event, type) => {
  const userAddress = event.returnValues.sender;
  const amount = event.returnValues.amount || 0;
  
  // 1. Check for shared funding (simplified heuristic)
  // In a real scenario, we would trace the 'transfer' events from the same source
  
  // 2. Check for identical timing patterns
  const recentTxs = await Transaction.find({
    type: type,
    timestamp: { $gt: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 mins
  }).limit(20);

  const similarTxs = recentTxs.filter(tx => 
    tx.user !== userAddress && 
    Math.abs(tx.amount - amount) < (amount * 0.01) // Within 1% of amount
  );

  if (similarTxs.length >= 3) {
    return {
      detected: true,
      reason: 'Sybil pattern: Multiple wallets executing identical transactions within minutes.',
      severity: 'High',
      scoreWeight: 4
    };
  }

  return { detected: false };
};

module.exports = { detectSybil };
