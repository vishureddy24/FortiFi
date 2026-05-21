const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { validateConfig } = require('./utils/configValidator');
validateConfig();
// Trigger nodemon restart again



const connectDB = require('../database/db');

// Models
const User = require('../database/models/User');
const Transaction = require('../database/models/Transaction');
const Alert = require('../database/models/Alert');
const RiskScore = require('../database/models/RiskScore');
const Simulation = require('../database/models/Simulation');
const ProtocolState = require('../database/models/ProtocolState');
const GovernanceLog = require('../database/models/GovernanceLog');
const WalletProfile = require('../database/models/WalletProfile');

// Analytics Logic
const attackSimulator = require('../analytics/simulations/attackSimulator');

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./docs/swagger.json');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Export io for use in other modules
global.io = io;

io.on('connection', (socket) => {
  console.log('[Socket.io] Client connected');
  
  socket.on('join_wallet', (walletAddress) => {
    if (walletAddress) {
      const room = `wallet_${walletAddress.toLowerCase()}`;
      socket.join(room);
      console.log(`[Socket.io] Client joined room: ${room}`);
    }
  });

  // Support wallet:<address> room format used by portfolio realtime
  socket.on('join', (roomName) => {
    if (roomName) {
      const lowerRoom = roomName.toLowerCase();
      socket.join(lowerRoom);
      console.log(`[Socket.io] SOCKET_EMITTED: Client joined room: ${lowerRoom}`);
    }
  });

  socket.on('leave', (roomName) => {
    if (roomName) {
      const lowerRoom = roomName.toLowerCase();
      socket.leave(lowerRoom);
      console.log(`[Socket.io] Client left room: ${lowerRoom}`);
    }
  });

  socket.on('disconnect', () => console.log('[Socket.io] Client disconnected'));
});

// Connect to Database
connectDB();

// --- REST APIs ---

// 1. Users API
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Transactions API
app.get('/api/transactions', async (req, res) => {
  try {
    const txs = await Transaction.find().sort({ timestamp: -1 }).limit(50);
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Alerts API
app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Risk Scores API
app.get('/api/risk-scores', async (req, res) => {
  try {
    const scores = await RiskScore.find().sort({ score: -1 });
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/risk-scores/:address', async (req, res) => {
  try {
    const score = await RiskScore.findOne({ address: req.params.address });
    res.json(score || { score: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4.5 Wallet Profile Credit-Line API
app.get('/api/wallet-profile/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    let profile = await WalletProfile.findOne({ address });
    if (!profile) {
      profile = new WalletProfile({
        address,
        trustScore: 100,
        totalBorrowLimit: 200,
        availableBorrowLimit: 200,
        borrowedOutstanding: 0,
        repaymentCount: 0,
        riskScore: 0,
        accountTier: 'Tier 1',
        minimumBorrowAmount: 50,
        maximumBorrowAmount: 200,
        borrowEligibility: true
      });
      await profile.save();
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Simulations API

app.get('/api/simulations', async (req, res) => {
  try {
    const sims = await Simulation.find().sort({ createdAt: -1 });
    res.json(sims);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/simulations/run', async (req, res) => {
  try {
    const { type, userAddress, requestId } = req.body;
    
    if (requestId) {
      const existingSim = await Simulation.findOne({ requestId });
      if (existingSim) return res.status(200).json(existingSim);
    }

    const result = await attackSimulator.runSimulation(type, userAddress);
    
    if (requestId && result) {
      // Assuming result is what gets saved to Simulation model in attackSimulator
      // If not, we should save it here or ensure attackSimulator handles requestId
      await Simulation.findOneAndUpdate({ createdAt: result.createdAt }, { requestId });
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Protocol State API
app.get('/api/protocol-state', async (req, res) => {
  try {
    const state = await ProtocolState.findOne().sort({ createdAt: -1 });
    res.json(state || { globalRiskScore: 0, isPaused: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Governance API
app.get('/api/governance/logs', async (req, res) => {
  try {
    const logs = await GovernanceLog.find().sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/governance/log', async (req, res) => {
  try {
    const { requestId, transactionHash } = req.body;

    if (requestId) {
      const existing = await GovernanceLog.findOne({ requestId });
      if (existing) return res.status(200).json(existing);
    }

    if (transactionHash) {
      const existingTx = await GovernanceLog.findOne({ transactionHash });
      if (existingTx) return res.status(200).json(existingTx);
    }

    const newLog = new GovernanceLog(req.body);
    await newLog.save();
    res.status(201).json(newLog);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 9. Create Transaction (to be called by blockchain listener or frontend)
app.post('/api/transactions', async (req, res) => {
  try {
    const { requestId, hash, eventId } = req.body;

    if (requestId) {
      const existing = await Transaction.findOne({ requestId });
      if (existing) return res.status(200).json(existing);
    }

    if (hash) {
      const existingHash = await Transaction.findOne({ txHash: hash });
      if (existingHash) return res.status(200).json(existingHash);
    }

    if (eventId) {
      const existingEvent = await Transaction.findOne({ eventId });
      if (existingEvent) return res.status(200).json(existingEvent);
    }

    const newTx = new Transaction(req.body);
    const savedTx = await newTx.save();
    res.status(201).json(savedTx);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const ApiKey = require('../database/models/ApiKey');
const rateLimit = require('express-rate-limit');

// --- SaaS Rate Limiting ---
const saasLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests from this IP, please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiter to all SaaS routes
app.use('/api/v1/saas/', saasLimiter);

// --- SaaS API Middleware ---
const validateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: "API Key missing. Please provide x-api-key header." });
  }

  try {
    const keyRecord = await ApiKey.findOne({ key: apiKey, isActive: true });
    if (!keyRecord) {
      return res.status(403).json({ error: "Invalid or inactive API Key." });
    }

    // Update usage stats
    keyRecord.requestsCount += 1;
    keyRecord.lastUsed = new Date();
    await keyRecord.save();

    req.apiKeyRecord = keyRecord;
    next();
  } catch (err) {
    res.status(500).json({ error: "Internal server error during authentication." });
  }
};

// --- SaaS Public APIs ---

// 1. Get Risk Score for any address
app.get('/api/v1/saas/risk-score/:address', validateApiKey, async (req, res) => {
  try {
    const score = await RiskScore.findOne({ address: req.params.address });
    res.json({
      address: req.params.address,
      riskScore: score ? score.score : 0,
      tier: req.apiKeyRecord.tier,
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Global Protocol Health
app.get('/api/v1/saas/protocol-health', validateApiKey, async (req, res) => {
  try {
    const state = await ProtocolState.findOne().sort({ createdAt: -1 });
    const alertsCount = await Alert.countDocuments({ createdAt: { $gt: new Date(Date.now() - 24*60*60*1000) } });
    
    res.json({
      health: state ? (state.globalRiskScore > 70 ? 'CRITICAL' : state.globalRiskScore > 40 ? 'WARNING' : 'HEALTHY') : 'UNKNOWN',
      globalRiskScore: state ? state.globalRiskScore : 0,
      isPaused: state ? state.isPaused : false,
      activeAlerts24h: alertsCount,
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Generate a temporary API Key (for testing)
app.post('/api/v1/saas/generate-key', async (req, res) => {
  try {
    const { owner } = req.body;
    const newKey = `ff_${require('crypto').randomBytes(16).toString('hex')}`;
    const keyRecord = new ApiKey({
      key: newKey,
      owner: owner || 'anonymous',
      tier: 'free'
    });
    await keyRecord.save();
    res.status(201).json({ apiKey: newKey, owner: keyRecord.owner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Dashboard Public APIs (No API Key Required for Internal UI) - Trigger ---
app.get('/api/v1/alerts', async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 }).limit(20);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/risk-stats', async (req, res) => {
  try {
    const state = await ProtocolState.findOne().sort({ createdAt: -1 });
    res.json(state || { globalRiskScore: 0, isPaused: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- FortiFi Real-Time Wallet Intelligence REST APIs ---

// 1. Live Portfolio Stats and Snapshots
app.get('/api/portfolio/live/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const WalletProfile = require('../database/models/WalletProfile');
    const PortfolioSnapshot = require('../database/models/PortfolioSnapshot');
    
    let profile = await WalletProfile.findOne({ address: wallet });
    if (!profile) {
      profile = new WalletProfile({
        address: wallet,
        trustScore: 100,
        totalBorrowLimit: 200,
        availableBorrowLimit: 200,
        borrowedOutstanding: 0,
        repaymentCount: 0,
        riskScore: 0,
        accountTier: 'Tier 1',
        minimumBorrowAmount: 50,
        maximumBorrowAmount: 200,
        borrowEligibility: true
      });
      await profile.save();
    }
    
    const snapshots = await PortfolioSnapshot.find({ walletAddress: wallet })
      .sort({ timestamp: -1 })
      .limit(100);
      
    res.json({ profile, snapshots: snapshots.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Live Transaction Explorer Events
app.get('/api/transactions/live/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const TransactionHistory = require('../database/models/TransactionHistory');
    
    const { timeRange, type, highRisk } = req.query;
    let query = { walletAddress: wallet };
    
    if (timeRange === 'hour') {
      query.timestamp = { $gte: new Date(Date.now() - 60*60*1000) };
    } else if (timeRange === 'today') {
      const startOfToday = new Date();
      startOfToday.setHours(0,0,0,0);
      query.timestamp = { $gte: startOfToday };
    }
    
    if (type) {
      query.eventType = type;
    }
    
    if (highRisk === 'true') {
      query.riskScoreSnapshot = { $gte: 5 };
    }
    
    const txs = await TransactionHistory.find(query).sort({ timestamp: -1 });
    res.json(txs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Live Risk Intelligence History
app.get('/api/risk/live/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const RiskHistory = require('../database/models/RiskHistory');
    const history = await RiskHistory.find({ walletAddress: wallet }).sort({ timestamp: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Live Security Alerts
app.get('/api/alerts/live/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const Alert = require('../database/models/Alert');
    const alerts = await Alert.find({ userAddress: wallet }).sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Phase 1 & 2 & 3: Autonomous Global & Wallet Telemetry + SecurityLogs REST APIs ---

// 1. Live Global Protocol Telemetry Metrics
app.get('/api/telemetry/global', async (req, res) => {
  try {
    const telemetryService = require('./services/telemetryService');
    let metrics = await telemetryService.getGlobalTelemetry();
    if (!metrics) {
      metrics = {
        tvl: 0,
        totalBorrowed: 0,
        activeLoans: 0,
        solvencyScore: 100,
        liveWalletCount: 0,
        timestamp: new Date()
      };
    }
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Live Connected Wallet-Specific Telemetry Metrics
app.get('/api/telemetry/wallet/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const telemetryService = require('./services/telemetryService');
    const metrics = await telemetryService.getWalletTelemetry(wallet);
    if (!metrics) {
      return res.status(404).json({ error: 'Wallet profile not found' });
    }
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Live Global & Wallet-Specific SecurityLogs
app.get('/api/security-logs', async (req, res) => {
  try {
    const { wallet, severity } = req.query;
    const SecurityLog = require('../database/models/SecurityLog');
    
    let query = {};
    if (wallet) {
      query.walletAddress = wallet.toLowerCase();
    }
    if (severity && severity !== 'ALL') {
      query.severity = severity;
    }
    
    const logs = await SecurityLog.find(query).sort({ timestamp: -1 }).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Historical Protocol Snapshots
app.get('/api/telemetry/solvency-history', async (req, res) => {
  try {
    const ProtocolSnapshot = require('../database/models/ProtocolSnapshot');
    const history = await ProtocolSnapshot.find().sort({ timestamp: -1 }).limit(50);
    res.json(history.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Historical Wallet Snapshots
app.get('/api/telemetry/wallet-history/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    const WalletSnapshot = require('../database/models/WalletSnapshot');
    const history = await WalletSnapshot.find({ walletAddress: wallet }).sort({ timestamp: -1 }).limit(50);
    res.json(history.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5001;

// --- Portfolio Upgraded Module ---
const portfolioRouter = require('./portfolio/portfolioRoutes');
const portfolioListener = require('./portfolio/listener');
const portfolioSocket = require('./portfolio/socketHandler');

app.use('/api/portfolio', portfolioRouter);
portfolioSocket(io);

// --- Enterprise SaaS Cockpit Upgraded Module ---
const enterpriseRouter = require('./enterprise/enterpriseRoutes');
const enterpriseListener = require('./enterprise/listener');
const enterpriseSocket = require('./enterprise/enterpriseSockets');

app.use('/api/enterprise', enterpriseRouter);
enterpriseSocket(io);

const contractListener = require('./listeners/contractListener');
const realtimePortfolioListener = require('./realtime/portfolioListener');

http.listen(PORT, () => {
  console.log(`FortiFi Server running on port ${PORT}`);
  // Start all listeners
  contractListener.start();
  portfolioListener.start();
  realtimePortfolioListener.start();
  enterpriseListener.start();
});
