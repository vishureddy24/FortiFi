/**
 * Oracle Price Deviation Detection
 * Detects if the price for a token changes too rapidly between transactions.
 * (In a real system, this would compare against an external oracle like Chainlink)
 */
const detectOracleDeviation = async (event, type) => {
  // Logic: Check if price changes more than 10% in a short window
  // For this prototype, we'll simulate a check on transaction amount vs historical average
  
  // Placeholder logic: Trigger if amount is abnormally high (simulation of oracle manipulation)
  const amount = parseFloat(event.returnValues.amount || 0);
  
  if (amount > 1000000) { // Simulation: Anything over 1M is suspicious for this mock
    return {
      detected: true,
      reason: 'Abnormal transaction value suggesting potential oracle manipulation or price slip',
      severity: 'Medium',
      scoreWeight: 3
    };
  }

  return { detected: false };
};

module.exports = { detectOracleDeviation };
