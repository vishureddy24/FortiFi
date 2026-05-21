const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  txHash: { type: String, required: true, unique: true },
  eventId: { type: String, unique: true, sparse: true }, 
  requestId: { type: String, unique: true, sparse: true }, 
  fromAddress: { type: String, required: true },
  toAddress: { type: String, required: true },
  tokenAddress: { type: String, required: true },
  tokenSymbol: { type: String },
  amount: { type: Number, required: true },
  usdValue: { type: Number },
  actionType: { 
    type: String, 
    enum: ['Deposit', 'Borrow', 'Repay', 'Liquidate', 'Supply', 'Withdraw'],
    required: true 
  },
  blockNumber: { type: Number },
  gasUsed: { type: Number },
  status: { type: String, default: 'Confirmed' },
  timestamp: { type: Date, default: Date.now },
  walletRiskScore: { type: Number },
  protocolRiskState: { type: String },
  debtAfter: { type: Number },
  utilization: { type: Number },
  riskScore: { type: Number }
}, { timestamps: true });

TransactionSchema.index({ eventId: 1 }, { unique: true, sparse: true });
TransactionSchema.index({ requestId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
