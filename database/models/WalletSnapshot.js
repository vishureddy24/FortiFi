const mongoose = require('mongoose');

const WalletSnapshotSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  walletAddress: { type: String, required: true },
  collateral: { type: Number, default: 0 },
  debt: { type: Number, default: 0 },
  healthFactor: { type: Number, default: 100 },
  riskScore: { type: Number, default: 0 },
  utilization: { type: Number, default: 0 }
}, { timestamps: true });

WalletSnapshotSchema.index({ walletAddress: 1, timestamp: -1 });

module.exports = mongoose.model('WalletSnapshot', WalletSnapshotSchema);
