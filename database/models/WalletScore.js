const mongoose = require('mongoose');

const WalletScoreSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  metrics: {
    healthFactor: { type: Number, default: 100 },
    borrowUtilization: { type: Number, default: 0 },
    riskScore: { type: Number, default: 0 },
    trustIdentityScore: { type: Number, default: 100 },
    suppliedCollateral: { type: Number, default: 0 },
    outstandingDebt: { type: Number, default: 0 },
    dynamicCreditLimit: { type: Number, default: 200 },
    borrowCapacity: { type: Number, default: 200 },
    liquidationBuffer: { type: Number, default: 0 }
  },
  txHash: { type: String },
  eventType: { type: String }
});

WalletScoreSchema.index({ walletAddress: 1, timestamp: -1 });

module.exports = mongoose.model('WalletScore', WalletScoreSchema);
