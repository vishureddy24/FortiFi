const mongoose = require('mongoose');

const ProtocolStateSchema = new mongoose.Schema({
  totalValueLocked: { type: String, default: '0' },
  totalBorrowed: { type: String, default: '0' },
  utilizationRate: { type: Number, default: 0 },
  globalRiskScore: { type: Number, default: 0 },
  isPaused: { type: Boolean, default: false },
  activeAlerts: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('ProtocolState', ProtocolStateSchema);
