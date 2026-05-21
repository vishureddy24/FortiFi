const mongoose = require('mongoose');

const GovernanceLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., 'PAUSE', 'UNPAUSE', 'SET_LTV', 'RESTRICT_USER'
  adminAddress: { type: String, required: true },
  targetAddress: { type: String },
  details: { type: String },
  transactionHash: { type: String, unique: true, sparse: true },
  requestId: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Completed' }
}, { timestamps: true });

GovernanceLogSchema.index({ transactionHash: 1 }, { unique: true, sparse: true });
GovernanceLogSchema.index({ requestId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('GovernanceLog', GovernanceLogSchema);
