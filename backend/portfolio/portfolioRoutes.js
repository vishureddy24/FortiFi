const express = require('express');
const router = express.Router();
const portfolioService = require('./portfolioService');

// IMPORTANT: Specific named routes MUST come before the wildcard /:wallet route.
// Express matches routes in registration order, so /:wallet would shadow /history/:wallet etc.

// GET /api/portfolio/history/:wallet
// Returns snapshot history for the Health Factor chart.
// Normalises WalletScore.metrics into a flat shape the frontend chart expects.
router.get('/history/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const WalletScore = require('../../database/models/WalletScore');
    const history = await WalletScore.find({ walletAddress: wallet }).sort({ timestamp: -1 }).limit(100);

    // Normalise: chart needs { healthFactor, utilization, timestamp }
    const normalised = history.map(doc => {
      const m = doc.metrics || {};
      return {
        _id: doc._id,
        walletAddress: doc.walletAddress,
        healthFactor: m.healthFactor ?? 100,
        utilization: m.borrowUtilization ?? 0,
        riskScore: m.riskScore ?? 0,
        suppliedCollateral: m.suppliedCollateral ?? 0,
        outstandingDebt: m.outstandingDebt ?? 0,
        timestamp: doc.timestamp,
        txHash: doc.txHash,
        eventType: doc.eventType
      };
    });

    res.json(normalised);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portfolio/transactions/:wallet
// Queries both PortfolioTransaction (from realtime listener) and TransactionHistory (from legacy listener)
// and merges them so the Transaction Explorer always has data regardless of which listener fired.
router.get('/transactions/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const PortfolioTransaction = require('../../database/models/PortfolioTransaction');
    const TransactionHistory = require('../../database/models/TransactionHistory');

    // Primary source: PortfolioTransaction (written by portfolioListener.js)
    const portfolioTxs = await PortfolioTransaction.find({ wallet }).sort({ timestamp: -1 }).limit(100);

    // Secondary source: TransactionHistory (written by contractListener.js / eventProcessor)
    const historyTxs = await TransactionHistory.find({ walletAddress: wallet }).sort({ timestamp: -1 }).limit(100);

    // Normalise TransactionHistory records to match PortfolioTransaction shape
    const normalisedHistory = historyTxs.map(h => ({
      _id: h._id,
      txHash: h.txHash,
      type: h.eventType,
      asset: h.token || 'DAI',
      amount: h.amount || 0,
      gasUsed: h.gasUsed || 0,
      riskScore: h.riskScoreSnapshot || 0,
      debtAfter: 0,
      utilization: 0,
      timestamp: h.timestamp
    }));

    // Merge: prefer PortfolioTransaction entries; fill gaps from TransactionHistory
    const seen = new Set(portfolioTxs.map(t => t.txHash));
    const merged = [
      ...portfolioTxs,
      ...normalisedHistory.filter(t => !seen.has(t.txHash))
    ];

    // Sort newest first, cap at 100
    merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(merged.slice(0, 100));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portfolio/download/:wallet
router.get('/download/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const format = req.query.format || 'csv';
    const WalletScore = require('../../database/models/WalletScore');

    const history = await WalletScore.find({ walletAddress: wallet }).sort({ timestamp: -1 }).limit(100);

    const fs = require('fs');
    const path = require('path');
    const reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${wallet}_${dateStr}.${format}`;
    const filePath = path.join(reportsDir, filename);

    if (format === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
      res.download(filePath, filename);
    } else {
      let csv = 'Timestamp,Wallet,Debt,Collateral,Risk,Utilization,Health,Identity,TxHash\n';
      history.forEach(doc => {
        const t = doc.timestamp ? new Date(doc.timestamp).toISOString() : 'N/A';
        const m = doc.metrics || {};
        csv += `${t},${doc.walletAddress},${m.outstandingDebt || 0},${m.suppliedCollateral || 0},${m.riskScore || 0},${m.borrowUtilization || 0},${m.healthFactor || 100},${m.trustIdentityScore || 100},${doc.txHash || 'N/A'}\n`;
      });
      fs.writeFileSync(filePath, csv);
      res.download(filePath, filename);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portfolio/credit-state/:wallet
router.get('/credit-state/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const WalletCreditState = require('../../database/models/WalletCreditState');
    let creditState = await WalletCreditState.findOne({ wallet });
    if (!creditState) {
      creditState = new WalletCreditState({
        wallet,
        currentCreditLimit: 200,
        outstandingDebt: 0,
        totalBorrowed: 0,
        totalRepaid: 0,
        borrowCycles: 0
      });
      await creditState.save();
    }
    res.json(creditState);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portfolio/borrow/validate
router.post('/borrow/validate', async (req, res) => {
  try {
    const { wallet, amount } = req.body;
    if (!wallet || amount === undefined) {
      return res.status(400).json({ error: "Missing wallet or amount" });
    }
    const walletLower = wallet.toLowerCase();
    const amountNum = Number(amount);

    const WalletScore = require('../../database/models/WalletScore');
    const latestScore = await WalletScore.findOne({ walletAddress: walletLower }).sort({ timestamp: -1 });

    const outstandingDebt = latestScore?.metrics?.outstandingDebt || 0;
    const currentLimit = latestScore?.metrics?.dynamicCreditLimit || 200;
    const available = Math.max(0, currentLimit - outstandingDebt);

    if (outstandingDebt + amountNum > currentLimit) {
      return res.json({
        allowed: false,
        reason: "Borrow limit reached. Repay existing debt.",
        availableBorrow: available
      });
    }

    res.json({
      allowed: true,
      availableBorrow: available - amountNum
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portfolio/repay/validate
router.post('/repay/validate', async (req, res) => {
  try {
    const { wallet, amount } = req.body;
    if (!wallet || amount === undefined) {
      return res.status(400).json({ error: "Missing wallet or amount" });
    }
    const walletLower = wallet.toLowerCase();

    const WalletScore = require('../../database/models/WalletScore');
    const latestScore = await WalletScore.findOne({ walletAddress: walletLower }).sort({ timestamp: -1 });
    const outstanding = latestScore?.metrics?.outstandingDebt || 0;

    res.json({
      allowed: true,
      outstandingDebt: outstanding
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portfolio/notify-transaction
// Accepts a transaction notification from the frontend to force a portfolio rebuild
// and emits real-time updates (risk:update, portfolio:update, transactionUpdate).
router.post('/notify-transaction', async (req, res) => {
  try {
    const { wallet, txHash, type, asset, amount, gasUsed } = req.body;
    if (!wallet || !txHash || !type) return res.status(400).json({ error: 'Missing wallet, txHash or type' });

    const portfolioService = require('./portfolioService');
    const recorded = await portfolioService.recordTransaction(wallet.toLowerCase(), txHash, asset || 'DAI', type, Number(amount) || 0, Number(gasUsed) || 0);

    if (!recorded) return res.status(500).json({ error: 'Failed to record transaction' });

    return res.status(200).json({ ok: true, transaction: recorded });
  } catch (err) {
    console.error('[portfolioRoutes] notify-transaction error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portfolio/:wallet  ← MUST be last — wildcard catches all unmatched paths
// Returns a normalised profile object that the frontend usePortfolioRealtime hook can consume directly.
router.get('/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();

    const WalletScore = require('../../database/models/WalletScore');
    const WalletProfile = require('../../database/models/WalletProfile');

    let latestScore = await WalletScore.findOne({ walletAddress: wallet }).sort({ timestamp: -1 });

    if (!latestScore) {
      // Force a rebuild so we always return something meaningful
      try {
        const rebuildPortfolio = require('../services/rebuildPortfolio');
        await rebuildPortfolio(wallet);
        latestScore = await WalletScore.findOne({ walletAddress: wallet }).sort({ timestamp: -1 });
      } catch (rebuildErr) {
        console.warn(`[portfolioRoutes] rebuildPortfolio failed for ${wallet}:`, rebuildErr.message);
      }
    }

    // Also pull WalletProfile for fields that rebuildPortfolio writes there
    const walletProfile = await WalletProfile.findOne({ address: wallet });

    const m = latestScore?.metrics || {};

    // Build a unified profile shape that matches what the frontend reads:
    // profile.totalCollateral, profile.totalDebt, profile.healthFactor,
    // profile.borrowUtilization, profile.riskScore, profile.trustScore, etc.
    const profile = {
      address: wallet,
      // Collateral — expose both field-name variants
      totalCollateral: m.suppliedCollateral ?? walletProfile?.totalCollateral ?? 0,
      suppliedCollateral: m.suppliedCollateral ?? walletProfile?.totalCollateral ?? 0,
      // Debt
      totalDebt: m.outstandingDebt ?? walletProfile?.totalDebt ?? 0,
      outstandingDebt: m.outstandingDebt ?? walletProfile?.totalDebt ?? 0,
      borrowedOutstanding: m.outstandingDebt ?? walletProfile?.borrowedOutstanding ?? 0,
      // Health & risk
      healthFactor: m.healthFactor ?? walletProfile?.healthFactor ?? 100,
      borrowUtilization: m.borrowUtilization ?? walletProfile?.borrowUtilization ?? 0,
      riskScore: m.riskScore ?? walletProfile?.riskScore ?? 0,
      // Identity / credit
      trustScore: m.trustIdentityScore ?? walletProfile?.trustScore ?? 100,
      trustIdentityScore: m.trustIdentityScore ?? walletProfile?.trustScore ?? 100,
      accountTier: walletProfile?.accountTier ?? 'Tier 1',
      totalBorrowLimit: m.dynamicCreditLimit ?? walletProfile?.totalBorrowLimit ?? 200,
      dynamicCreditLimit: m.dynamicCreditLimit ?? walletProfile?.totalBorrowLimit ?? 200,
      availableBorrowLimit: m.borrowCapacity ?? walletProfile?.availableBorrowLimit ?? 200,
      borrowCapacity: m.borrowCapacity ?? walletProfile?.availableBorrowLimit ?? 200,
      availableBorrow: m.borrowCapacity ?? walletProfile?.availableBorrow ?? 200,
      liquidationBuffer: m.liquidationBuffer ?? 0,
      borrowEligibility: walletProfile?.borrowEligibility ?? true
    };

    res.json({ snapshot: latestScore, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
