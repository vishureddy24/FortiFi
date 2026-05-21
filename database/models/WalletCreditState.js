const mongoose = require('mongoose');

const WalletCreditStateSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true },
  currentCreditLimit: { type: Number, default: 200 },
  outstandingDebt: { type: Number, default: 0 },
  totalBorrowed: { type: Number, default: 0 },
  totalRepaid: { type: Number, default: 0 },
  borrowCycles: { type: Number, default: 0 }
}, { 
  timestamps: { createdAt: false, updatedAt: 'updatedAt' } 
});

module.exports = mongoose.model('WalletCreditState', WalletCreditStateSchema, 'wallet_credit_state');
