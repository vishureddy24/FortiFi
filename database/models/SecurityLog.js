const mongoose = require('mongoose');

const SecurityLogSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true },
  severity: { type: String, enum: ['INFO', 'WARNING', 'HIGH'], default: 'INFO' },
  threatType: { type: String, required: true },
  message: { type: String, required: true },
  txHash: { type: String },
  blockNumber: { type: Number },
  timestamp: { type: Date, default: Date.now },
  mitigationAction: { type: String, default: 'None' },
  confidenceScore: { type: Number, default: 1.0 }
}, { timestamps: true });

SecurityLogSchema.index({ walletAddress: 1, severity: 1, timestamp: -1 });

module.exports = mongoose.model('SecurityLog', SecurityLogSchema);
