const mongoose = require('mongoose');

const SimulationSchema = new mongoose.Schema({
  attackType: { 
    type: String, 
    enum: ['FlashLoan', 'OracleManipulation', 'RapidBorrowing', 'LiquidityDrain'],
    required: true 
  },
  status: { type: String, enum: ['Pending', 'Running', 'Detected', 'Succeeded'], default: 'Pending' },
  userAddress: { type: String },
  requestId: { type: String, unique: true, sparse: true },
  payload: { type: Object },
  detectionTime: { type: Number }, // ms to detect
  riskScoreIncrease: { type: Number },
  onChainAction: { type: String }, // e.g., 'Protocol Paused', 'User Restricted'
  details: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Simulation', SimulationSchema);
