const WalletRisk = require('../../database/models/WalletRisk');

/**
 * Calculates the utilization ratio of the credit limit.
 * @param {number} outstandingDebt 
 * @param {number} currentCreditLimit 
 * @returns {number} utilization fraction (0 to 1)
 */
function calculateUtilization(outstandingDebt, currentCreditLimit) {
  if (!currentCreditLimit || currentCreditLimit <= 0) return 0;
  return Math.max(0, outstandingDebt / currentCreditLimit);
}

/**
 * Calculates the Health Factor.
 * @param {number} collateral 
 * @param {number} outstandingDebt 
 * @returns {number} health factor percentage (0 to 100)
 */
function calculateHealthFactor(collateral, outstandingDebt) {
  if (!outstandingDebt || outstandingDebt <= 0) return 100;
  return Math.min(100, (collateral * 100) / outstandingDebt);
}

/**
 * Calculates the final risk score and persists it to MongoDB.
 * @param {string} wallet 
 * @param {number} outstandingDebt 
 * @param {number} currentCreditLimit 
 * @param {number} collateral 
 * @param {number} borrowCount 
 * @returns {Promise<object>} contains score and details
 */
async function calculateRisk(wallet, outstandingDebt, currentCreditLimit, collateral, borrowCount = 1) {
  const walletLower = wallet.toLowerCase();
  
  // 1. Calculate utilization
  const utilization = calculateUtilization(outstandingDebt, currentCreditLimit);
  const utilPercent = utilization * 100;
  
  // 2. Base Risk mapping
  let baseRisk = 0;
  if (outstandingDebt > 0) {
    if (utilPercent <= 20) baseRisk = 1;
    else if (utilPercent <= 40) baseRisk = 2;
    else if (utilPercent <= 60) baseRisk = 4;
    else if (utilPercent <= 80) baseRisk = 6;
    else if (utilPercent <= 90) baseRisk = 8;
    else baseRisk = 10;
  }
  
  // 3. Collateral Ratio
  const collateralRatio = collateral > 0 ? (outstandingDebt / collateral) : (outstandingDebt > 0 ? 1 : 0);
  
  // 4. Borrow Frequency factor (scaled from borrowCount)
  const borrowFrequency = outstandingDebt > 0 ? Math.min(1, borrowCount / 5 || 1) : 0;
  
  // 5. Final Risk Calculation
  // risk = (utilization * 7) + (collateralRatio * 2) + (borrowFrequency * 1)
  // Note: the prompt maps Base Risk (1-10) to the utilization weight of 7 (baseRisk * 0.7 contributes up to 7 points)
  let risk = (baseRisk * 0.7) + (collateralRatio * 2) + (borrowFrequency * 1);
  
  // Clamp 0 to 10
  risk = Math.max(0, Math.min(10, risk));
  
  // Risk must never remain 0 unless debt is actually 0.
  if (outstandingDebt > 0 && risk <= 0) {
    risk = 1;
  }
  
  const score = Number(risk.toFixed(2));
  
  // Persist to MongoDB wallet_risk collection
  let wr = await WalletRisk.findOne({ wallet: walletLower });
  if (!wr) {
    wr = new WalletRisk({ wallet: walletLower });
  }
  wr.debt = outstandingDebt;
  wr.collateral = collateral;
  wr.utilization = Number(utilPercent.toFixed(2));
  wr.score = score;
  await wr.save();
  
  return {
    score,
    utilization: wr.utilization,
    collateralRatio,
    borrowFrequency,
    baseRisk
  };
}

module.exports = {
  calculateRisk,
  calculateUtilization,
  calculateHealthFactor
};
