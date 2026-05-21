const mongoose = require('mongoose');

const WalletProfileSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true },
  walletAddress: { type: String }, // duplicate for direct walletAddress queries
  classification: { type: String, enum: ['Standard', 'High-Net-Worth', 'Contract', 'Flash-Loan-Seeker'], default: 'Standard' },
  historicalBorrowVolume: { type: String, default: '0' },
  historicalLendVolume: { type: String, default: '0' },
  trustScore: { type: Number, default: 100 },
  tags: [String],
  lastBehaviorAudit: { type: Date },

  // NEW CREDIT MODEL FIELDS
  totalBorrowLimit: { type: Number, default: 200 },
  availableBorrowLimit: { type: Number, default: 200 },
  borrowedOutstanding: { type: Number, default: 0 },
  repaymentCount: { type: Number, default: 0 },
  riskScore: { type: Number, default: 0 },
  accountTier: { type: String, enum: ['Tier 1', 'Tier 2', 'Tier 3'], default: 'Tier 1' },
  minimumBorrowAmount: { type: Number, default: 50 },
  maximumBorrowAmount: { type: Number, default: 200 },
  borrowEligibility: { type: Boolean, default: true },

  // REAL-TIME WALLET INTELLIGENCE FIELDS
  totalCollateral: { type: Number, default: 0 },
  totalDebt: { type: Number, default: 0 },
  availableBorrow: { type: Number, default: 200 },
  creditLimit: { type: Number, default: 200 },
  healthFactor: { type: Number, default: 100 },
  borrowUtilization: { type: Number, default: 0 },
  walletRiskScore: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

WalletProfileSchema.pre('save', function(next) {
  if (this.address && !this.walletAddress) {
    this.walletAddress = this.address;
  }
  next();
});

module.exports = mongoose.model('WalletProfile', WalletProfileSchema);
