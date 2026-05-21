const mongoose = require('mongoose');

const WalletRiskSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true, lowercase: true },
  debt: { type: Number, default: 0 },
  collateral: { type: Number, default: 0 },
  utilization: { type: Number, default: 0 },
  score: { type: Number, default: 0 }
}, { 
  timestamps: { createdAt: false, updatedAt: 'updatedAt' } 
});

module.exports = mongoose.model('WalletRisk', WalletRiskSchema, 'wallet_risk');
