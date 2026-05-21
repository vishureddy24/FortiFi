const mongoose = require('mongoose');

const PortfolioSnapshotSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  totalCollateral: { type: Number, default: 0 },
  totalDebt: { type: Number, default: 0 },
  healthFactor: { type: Number, default: 100 },
  liquidationBuffer: { type: Number, default: 0 },
  borrowUtilization: { type: Number, default: 0 },
  riskScore: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

PortfolioSnapshotSchema.index({ walletAddress: 1, timestamp: -1 });

module.exports = mongoose.model('PortfolioSnapshot', PortfolioSnapshotSchema);
