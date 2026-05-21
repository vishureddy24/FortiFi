const Transaction = require('../../database/models/Transaction');

/**
 * Flash Loan Detection Logic
 * Flash loans often involve large borrow and repay actions in the same block.
 */
const detectFlashLoan = async (event, type) => {
  const { transactionHash, blockNumber, returnValues } = event;
  const userAddress = returnValues.sender;

  // Find other transactions in the same block for the same user
  const relatedTxs = await Transaction.find({
    blockNumber: blockNumber,
    user: userAddress,
    hash: { $ne: transactionHash }
  });

  if (relatedTxs.length > 0) {
    const hasBorrow = type === 'Borrow' || relatedTxs.some(tx => tx.type === 'Borrow');
    const hasRepay = type === 'Repay' || relatedTxs.some(tx => tx.type === 'Repay');

    if (hasBorrow && hasRepay) {
      return {
        detected: true,
        reason: 'Large Borrow and Repay detected in the same block (Flash Loan Pattern)',
        severity: 'High',
        scoreWeight: 5
      };
    }
  }

  return { detected: false };
};

module.exports = { detectFlashLoan };
