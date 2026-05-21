const Transaction = require('../../database/models/Transaction');

/**
 * Liquidity Anomaly Detection
 * Detects large withdrawals that significantly drain protocol liquidity.
 */
const detectLiquidityAnomaly = async (event, type) => {
  if (type !== 'Withdraw') return { detected: false };

  const amount = parseFloat(event.returnValues.amount || 0);

  // Simulation: If withdrawal is > 50% of total deposits in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const totalDeposits = await Transaction.aggregate([
    { $match: { type: 'Deposit', timestamp: { $gte: oneDayAgo } } },
    { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
  ]);

  const depositSum = totalDeposits[0] ? totalDeposits[0].total : 1;

  if (amount > depositSum * 0.5) {
    return {
      detected: true,
      reason: 'Single withdrawal exceeds 50% of 24h deposit volume.',
      severity: 'High',
      scoreWeight: 4
    };
  }

  return { detected: false };
};

module.exports = { detectLiquidityAnomaly };
