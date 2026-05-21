const mongoose = require('mongoose');

const ApiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  owner: {
    type: String, // Wallet address or user ID
    required: true
  },
  tier: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },
  requestsCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ApiKey', ApiKeySchema);
