const mongoose = require('mongoose');

const ProtocolSnapshotSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  tvl: { type: Number, default: 0 },
  totalBorrowed: { type: Number, default: 0 },
  activeLoans: { type: Number, default: 0 },
  solvencyScore: { type: Number, default: 100 },
  liveWalletCount: { type: Number, default: 0 }
}, { timestamps: true });

ProtocolSnapshotSchema.index({ timestamp: -1 });

module.exports = mongoose.model('ProtocolSnapshot', ProtocolSnapshotSchema);
