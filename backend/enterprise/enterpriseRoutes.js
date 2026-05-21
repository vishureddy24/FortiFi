const express = require('express');
const router = express.Router();
const enterpriseService = require('./enterpriseService');

// Get all Cockpit datasets at once for efficient load time
router.get('/cockpit/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    
    let latestMetrics = await enterpriseService.getLatestMetrics(wallet);
    if (!latestMetrics) {
      latestMetrics = await enterpriseService.updateEnterpriseMetrics(wallet);
    }

    const history = await enterpriseService.getMetricsHistory(wallet);
    const securityLogs = await enterpriseService.getSecurityLogs(wallet);
    const transactions = await enterpriseService.getTransactions(wallet);

    res.json({
      metrics: latestMetrics,
      history: history.reverse(),
      securityLogs,
      transactions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Individual endpoints for granular updates
router.get('/metrics/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const metrics = await enterpriseService.getLatestMetrics(wallet);
    res.json(metrics || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const history = await enterpriseService.getMetricsHistory(wallet);
    res.json(history.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/security-logs/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const logs = await enterpriseService.getSecurityLogs(wallet);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/transactions/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const txs = await enterpriseService.getTransactions(wallet);
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
