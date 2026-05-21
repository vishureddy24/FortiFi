const mongoose = require('mongoose');

const WalletSnapshotSchema = new mongoose.Schema({
  wallet: { type: String, required: true },
  collateral: { type: Number, default: 0 },
  debt: { type: Number, default: 0 },
  healthFactor: { type: Number, default: 100 },
  utilization: { type: Number, default: 0 },
  riskScore: { type: Number, default: 0 },
  identityScore: { type: Number, default: 0 },
  allocations: [{ type: String }],
  timestamp: { type: Date, default: Date.now }
}, { 
  collection: 'wallet_snapshots',
  timestamps: { createdAt: 'createdAt', updatedAt: false }
});

WalletSnapshotSchema.index({ wallet: 1, timestamp: -1 });

module.exports = mongoose.model('WalletSnapshotNew', WalletSnapshotSchema);
