const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['Security', 'Risk', 'Governance', 'Simulation'],
    required: true 
  },
  severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Low' },
  message: { type: String, required: true },
  metadata: { type: Object }, // Flexible for different alert types
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Alert', AlertSchema);
