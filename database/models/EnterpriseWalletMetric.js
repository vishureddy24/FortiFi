const mongoose = require('mongoose');

const EnterpriseWalletMetricSchema = new mongoose.Schema({
  wallet: { type: String, required: true },
  tvl: { type: Number, default: 0 },
  borrowed: { type: Number, default: 0 },
  activeLoans: { type: Number, default: 0 },
  solvency: { type: Number, default: 100 },
  timestamp: { type: Date, default: Date.now }
}, {
  collection: 'enterprise_wallet_metrics',
  timestamps: { createdAt: 'createdAt', updatedAt: false }
});

EnterpriseWalletMetricSchema.index({ wallet: 1, timestamp: -1 });

module.exports = mongoose.model('EnterpriseWalletMetric', EnterpriseWalletMetricSchema);
