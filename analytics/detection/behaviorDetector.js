const Transaction = require('../../database/models/Transaction');

/**
 * Suspicious Wallet Behavior Detection
 * Detects unusual patterns like new wallets performing high-value actions.
 */
const detectSuspiciousBehavior = async (event, type) => {
  const userAddress = event.returnValues.sender;
  
  const txCount = await Transaction.countDocuments({ user: userAddress });

  if (txCount === 0) {
    const amount = parseFloat(event.returnValues.amount || 0);
    if (amount > 100000) {
      return {
        detected: true,
        reason: 'New wallet performing a high-value transaction (>100k).',
        severity: 'Medium',
        scoreWeight: 2
      };
    }
  }

  return { detected: false };
};

module.exports = { detectSuspiciousBehavior };
