const mongoose = require('mongoose');

const RiskScoreSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true }, // 'protocol' for protocol-wide score
  score: { type: Number, min: 0, max: 10, default: 0 },
  factors: {
    flashLoan: { type: Number, default: 0 },
    oracleManipulation: { type: Number, default: 0 },
    velocity: { type: Number, default: 0 },
    liquidityAnomaly: { type: Number, default: 0 },
    suspiciousBehavior: { type: Number, default: 0 }
  },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('RiskScore', RiskScoreSchema);
