const Transaction = require('../../database/models/Transaction');

/**
 * Rapid Borrow Velocity Detection
 * Detects if a user is borrowing/repaying too frequently.
 */
const detectVelocity = async (event, type) => {
  const userAddress = event.returnValues.sender;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const recentTxsCount = await Transaction.countDocuments({
    user: userAddress,
    timestamp: { $gte: fiveMinutesAgo }
  });

  if (recentTxsCount > 5) {
    return {
      detected: true,
      reason: `User has performed ${recentTxsCount} transactions in the last 5 minutes.`,
      severity: 'Medium',
      scoreWeight: 2
    };
  }

  return { detected: false };
};

module.exports = { detectVelocity };
