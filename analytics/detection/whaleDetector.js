/**
 * Whale Manipulation Detector
 * Monitors for large volume transactions that could lead to price slippage or cascading liquidations.
 */
const detectWhaleManipulation = async (event, type) => {
  const amountInDollars = event.returnValues.amountInDollars || 0;
  const WHALE_THRESHOLD = 500000; // $500k

  if (amountInDollars >= WHALE_THRESHOLD) {
    return {
      detected: true,
      reason: `Whale activity: Transaction of $${(amountInDollars/1000).toFixed(1)}k detected. Monitoring for market impact.`,
      severity: 'Medium',
      scoreWeight: 2
    };
  }

  return { detected: false };
};

module.exports = { detectWhaleManipulation };
