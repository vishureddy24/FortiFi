const mongoose = require('mongoose');

const PortfolioTransactionSchema = new mongoose.Schema({
  wallet: { type: String, required: true },
  txHash: { type: String, required: true },
  asset: { type: String, default: 'DAI' },
  type: { type: String, required: true },
  amount: { type: Number, default: 0 },
  gasUsed: { type: Number, default: 0 },
  debtAfter: { type: Number },
  utilization: { type: Number },
  riskScore: { type: Number },
  timestamp: { type: Date, default: Date.now }
}, { 
  collection: 'portfolio_transactions',
  timestamps: { createdAt: 'createdAt', updatedAt: false }
});

PortfolioTransactionSchema.index({ wallet: 1, timestamp: -1 });

module.exports = mongoose.model('PortfolioTransaction', PortfolioTransactionSchema);
