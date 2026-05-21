const mongoose = require('mongoose');

const TransactionHistorySchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  txHash: { type: String, required: true },
  idempotencyKey: { type: String, unique: true }, // computed as txHash + "_" + logIndex
  eventType: { type: String, enum: ['Supply', 'Borrow', 'Repay', 'Withdraw', 'Liquidation', 'RiskScoreChange', 'Governance'], required: true },
  token: { type: String },
  amount: { type: Number },
  fromAddress: { type: String },
  toAddress: { type: String },
  protocolAddress: { type: String },
  timestamp: { type: Date, default: Date.now },
  blockNumber: { type: Number },
  gasUsed: { type: Number },
  status: { type: String, default: 'Confirmed' },
  riskScoreSnapshot: { type: Number }
}, { timestamps: true });

TransactionHistorySchema.index({ walletAddress: 1, timestamp: -1 });

module.exports = mongoose.model('TransactionHistory', TransactionHistorySchema);
