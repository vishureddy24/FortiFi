const mongoose = require('mongoose');

const EnterpriseSecurityLogSchema = new mongoose.Schema({
  wallet: { type: String, required: true },
  severity: { type: String, default: 'INFO' }, // INFO, WARNING, HIGH
  event: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, {
  collection: 'enterprise_security_logs',
  timestamps: { createdAt: 'createdAt', updatedAt: false }
});

EnterpriseSecurityLogSchema.index({ wallet: 1, timestamp: -1 });

module.exports = mongoose.model('EnterpriseSecurityLog', EnterpriseSecurityLogSchema);
