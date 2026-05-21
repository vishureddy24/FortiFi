const mongoose = require('mongoose');

const PortfolioAlertSchema = new mongoose.Schema({
  wallet: { type: String, required: true },
  title: { type: String, required: true },
  severity: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { 
  collection: 'portfolio_alerts',
  timestamps: { createdAt: 'createdAt', updatedAt: false }
});

PortfolioAlertSchema.index({ wallet: 1, timestamp: -1 });

module.exports = mongoose.model('PortfolioAlert', PortfolioAlertSchema);
