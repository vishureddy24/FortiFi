const { ethers } = require('ethers');
const mongoose = require('mongoose');
const LendingAndBorrowingABI = require('../../abis/LendingAndBorrowing.json');
const portfolioService = require('../portfolio/portfolioService');
const eventProcessor = require('../utils/eventProcessor');
const Transaction = require('../../database/models/Transaction');
const PortfolioTransaction = require('../../database/models/PortfolioTransaction');
const WalletSnapshotNew = require('../../database/models/WalletSnapshotNew');
const SecurityLog = require('../../database/models/SecurityLog');
const WalletProfile = require('../../database/models/WalletProfile');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:7545';
const CONTRACT_ADDRESS = process.env.LENDING_PROTOCOL_ADDRESS;

class PortfolioListener {
  constructor() {
    this.reconnectInterval = 5000;
    this.lastBlock = 0;
    this.isPolling = false;
  }

  async start() {
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x...') {
      console.warn('[RealtimeListener] Valid contract address not found. Event monitoring disabled.');
      return;
    }
    
    console.log(`[RealtimeListener] Connecting to RPC: ${RPC_URL}`);
    try {
      this.provider = RPC_URL.startsWith('ws')
        ? new ethers.WebSocketProvider(RPC_URL)
        : new ethers.JsonRpcProvider(RPC_URL);
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, LendingAndBorrowingABI.abi, this.provider);
      
      this.lastBlock = await this.provider.getBlockNumber();
      console.log(`[RealtimeListener] EVENT_RECEIVED: Initialized block tracking at block ${this.lastBlock}`);
      
      // Start polling loop every 1.5 seconds for instant updates
      this.pollInterval = setInterval(() => this.pollEvents(), 1500);
    } catch (err) {
      console.error('[RealtimeListener] Initialization failed:', err.message);
      this.handleRetry();
    }
  }

  async pollEvents() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const currentBlock = await this.provider.getBlockNumber();
      if (currentBlock >= this.lastBlock) {
        const filter = {
          address: CONTRACT_ADDRESS,
          fromBlock: this.lastBlock,
          toBlock: currentBlock
        };
        
        const logs = await this.provider.getLogs(filter);
        for (const log of logs) {
          try {
            const parsedLog = this.contract.interface.parseLog({
              topics: log.topics,
              data: log.data
            });

            if (parsedLog) {
              console.log(`[RealtimeListener] EVENT_RECEIVED: ${parsedLog.name} in block ${log.blockNumber}`);
              await this.handleEvent(parsedLog, log);
            }
          } catch (err) {
            // Ignore non-LendingAndBorrowing event logs
          }
        }
        this.lastBlock = currentBlock + 1;
      }
    } catch (err) {
      console.error('[RealtimeListener] Error polling events:', err.message);
    } finally {
      this.isPolling = false;
    }
  }

  async handleEvent(parsedLog, log) {
    const { name, args } = parsedLog;
    const txHash = log.transactionHash;
    const blockNumber = log.blockNumber;

    let walletAddress;
    let asset = 'DAI';
    let amount = 0;

    if (name === 'Supply') {
      walletAddress = args.from || args[0];
      asset = 'LAR';
      amount = Number(args.amount || args[3]) / 1e18;
    } else if (name === 'Borrow') {
      walletAddress = args.borrower || args[0];
      asset = 'DAI';
      amount = Number(args.amount || args[3]) / 1e18;
    } else if (name === 'Repay') {
      walletAddress = args.payer || args[0];
      asset = 'DAI';
      amount = Number(args.amount || args[3]) / 1e18;
    } else if (name === 'Withdraw') {
      walletAddress = args.user || args[1];
      asset = 'LAR';
      amount = Number(args.amount || args[3]) / 1e18;
    } else {
      walletAddress = args[0];
      amount = Number(args[1] || 0) / 1e18;
    }

    if (!walletAddress) return;
    walletAddress = walletAddress.toLowerCase();

    let gasUsed = 0;
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (receipt) gasUsed = Number(receipt.gasUsed);
    } catch (err) {
      console.warn(`[RealtimeListener] Could not fetch gasUsed: ${err.message}`);
    }

    // Process event using general eventProcessor (triggers risk updates, user activity, alerts)
    const mockWeb3Event = {
      transactionHash: txHash,
      blockNumber: blockNumber,
      logIndex: log.index,
      returnValues: {
        from: args[0],
        to: args[1],
        asset: args[2],
        amount: args[3]?.toString(),
        timestamp: args[4]?.toString(),
        user: name === 'Withdraw' ? args[1] : undefined,
        payer: name === 'Repay' ? args[0] : undefined,
        protocol: name === 'Repay' ? args[1] : (name === 'Withdraw' ? args[0] : undefined),
        borrower: name === 'Borrow' ? args[0] : undefined,
        lenderPool: name === 'Borrow' ? args[1] : undefined
      }
    };

    const typeMapping = {
      Supply: 'Supply',
      Borrow: 'Borrow',
      Repay: 'Repay',
      Withdraw: 'Withdraw'
    };

    await eventProcessor.processEvent(mockWeb3Event, typeMapping[name] || name);

    // Save PortfolioTransaction — this also calls rebuildPortfolio internally
    const pTx = await portfolioService.recordTransaction(walletAddress, txHash, asset, name, amount, gasUsed);

    // Fetch refreshed profile after rebuild
    const updatedProfile = await WalletProfile.findOne({ address: walletAddress });
    const latestSnapshot = await WalletSnapshotNew.findOne({ wallet: walletAddress }).sort({ timestamp: -1 });
    const latestSecurityLogs = await SecurityLog.find({ walletAddress }).sort({ timestamp: -1 }).limit(1);
    const newestSecurityLog = latestSecurityLogs[0];

    if (global.io) {
      const room = `wallet:${walletAddress}`;

      // Build normalised profile — same shape as portfolioRoutes GET /:wallet
      // so the frontend hook can consume it identically whether from REST or socket.
      const normalisedProfile = {
        address: walletAddress,
        totalCollateral: updatedProfile?.totalCollateral ?? 0,
        suppliedCollateral: updatedProfile?.totalCollateral ?? 0,
        totalDebt: updatedProfile?.totalDebt ?? 0,
        outstandingDebt: updatedProfile?.totalDebt ?? 0,
        borrowedOutstanding: updatedProfile?.borrowedOutstanding ?? 0,
        healthFactor: updatedProfile?.healthFactor ?? 100,
        borrowUtilization: updatedProfile?.borrowUtilization ?? 0,
        riskScore: updatedProfile?.riskScore ?? 0,
        trustScore: updatedProfile?.trustScore ?? 100,
        trustIdentityScore: updatedProfile?.trustScore ?? 100,
        accountTier: updatedProfile?.accountTier ?? 'Tier 1',
        totalBorrowLimit: updatedProfile?.totalBorrowLimit ?? 200,
        dynamicCreditLimit: updatedProfile?.totalBorrowLimit ?? 200,
        availableBorrowLimit: updatedProfile?.availableBorrowLimit ?? 200,
        borrowCapacity: updatedProfile?.availableBorrowLimit ?? 200,
        availableBorrow: updatedProfile?.availableBorrow ?? 200,
        liquidationBuffer: Math.max(0, (updatedProfile?.totalCollateral ?? 0) - (updatedProfile?.totalDebt ?? 0)),
        borrowEligibility: updatedProfile?.borrowEligibility ?? true
      };

      // Build normalised snapshot for the chart
      const normalisedSnapshot = latestSnapshot ? {
        healthFactor: latestSnapshot.healthFactor ?? normalisedProfile.healthFactor,
        utilization: latestSnapshot.utilization ?? normalisedProfile.borrowUtilization,
        riskScore: latestSnapshot.riskScore ?? normalisedProfile.riskScore,
        suppliedCollateral: latestSnapshot.collateral ?? normalisedProfile.totalCollateral,
        outstandingDebt: latestSnapshot.debt ?? normalisedProfile.totalDebt,
        timestamp: latestSnapshot.timestamp
      } : null;

      const payload = {
        walletAddress,
        profile: normalisedProfile,
        snapshot: normalisedSnapshot
      };

      console.log(`[RealtimeListener] SOCKET_EMITTED portfolio:update to ${room}`);
      global.io.to(room).emit('portfolio:update', payload);

      if (pTx) {
        console.log(`[RealtimeListener] SOCKET_EMITTED tx:new to ${room}`);
        global.io.to(room).emit('tx:new', {
          _id: pTx._id,
          txHash: pTx.txHash,
          type: pTx.type,
          asset: pTx.asset,
          amount: pTx.amount,
          gasUsed: pTx.gasUsed,
          riskScore: pTx.riskScore,
          utilization: pTx.utilization,
          debtAfter: pTx.debtAfter,
          timestamp: pTx.timestamp
        });
      }

      if (newestSecurityLog) {
        console.log(`[RealtimeListener] SOCKET_EMITTED security:update to ${room}`);
        global.io.to(room).emit('security:update', {
          title: `Security Alert: ${newestSecurityLog.threatType}`,
          message: newestSecurityLog.message,
          severity: newestSecurityLog.severity,
          timestamp: newestSecurityLog.timestamp,
          txHash: newestSecurityLog.txHash
        });
      }

      // Also emit risk:update so the hook's risk:update handler fires
      console.log(`[RealtimeListener] SOCKET_EMITTED risk:update to ${room}`);
      global.io.to(room).emit('risk:update', {
        wallet: walletAddress,
        score: normalisedProfile.riskScore,
        debt: normalisedProfile.totalDebt,
        collateral: normalisedProfile.totalCollateral,
        utilization: normalisedProfile.borrowUtilization
      });
    }
  }

  handleRetry() {
    setTimeout(() => this.start(), this.reconnectInterval);
  }
}

module.exports = new PortfolioListener();
