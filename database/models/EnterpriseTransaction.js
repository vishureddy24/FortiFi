const mongoose = require('mongoose');

const EnterpriseTransactionSchema = new mongoose.Schema({
  wallet: { type: String, required: true },
  txHash: { type: String, required: true },
  type: { type: String, required: true }, // Supply, Withdraw, Borrow, Repay, etc.
  amount: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
}, {
  collection: 'enterprise_transactions',
  timestamps: { createdAt: 'createdAt', updatedAt: false }
});

EnterpriseTransactionSchema.index({ wallet: 1, timestamp: -1 });

module.exports = mongoose.model('EnterpriseTransaction', EnterpriseTransactionSchema);
