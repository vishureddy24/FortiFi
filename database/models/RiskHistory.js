const mongoose = require('mongoose');

const RiskHistorySchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  previousRisk: { type: Number, default: 0 },
  updatedRisk: { type: Number, required: true },
  triggerType: { type: String },
  timestamp: { type: Date, default: Date.now },
  threatDetected: { type: Boolean, default: false },
  protocolActionTaken: { type: String }
}, { timestamps: true });

RiskHistorySchema.index({ walletAddress: 1, timestamp: -1 });

module.exports = mongoose.model('RiskHistory', RiskHistorySchema);
