const { Web3 } = require('web3');
const RiskControllerABI = require('../../abis/RiskController.json');
require('dotenv').config();

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:7545';
const RISK_CONTROLLER_ADDRESS = process.env.RISK_CONTROLLER_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Backend needs a private key to sign transactions

class BlockchainService {
  constructor() {
    this.web3 = new Web3(RPC_URL);
    const isValidAddress = (addr) => addr && addr.startsWith('0x') && addr.length === 42 && addr !== '0x...';
    
    if (isValidAddress(RISK_CONTROLLER_ADDRESS)) {
      this.riskController = new this.web3.eth.Contract(RiskControllerABI.abi, RISK_CONTROLLER_ADDRESS);
    } else {
      console.warn('[Blockchain] Valid RiskController address not found in .env. On-chain sync disabled.');
    }
  }

  async syncRiskScore(userAddress, score) {
    if (!this.riskController || !PRIVATE_KEY) {
      console.warn('[Blockchain] RiskController address or Private Key missing. Skipping on-chain sync.');
      return;
    }

    try {
      const account = this.web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
      const data = this.riskController.methods.updateRiskScore(userAddress, Math.round(score)).encodeABI();
      
      const tx = {
        from: account.address,
        to: RISK_CONTROLLER_ADDRESS,
        gas: 200000,
        data: data
      };

      const signedTx = await this.web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
      await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      console.log(`[Blockchain] Successfully synced risk score for ${userAddress} on-chain.`);
    } catch (err) {
      // Non-fatal — off-chain risk score is already saved to MongoDB.
      // On-chain sync fails if PRIVATE_KEY account is not the contract owner.
      console.warn(`[Blockchain] On-chain risk score sync skipped for ${userAddress}: ${err.message}`);
    }
  }

  async setEmergencyMode(active) {
    if (!this.riskController || !PRIVATE_KEY) return;

    try {
      const account = this.web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
      const data = this.riskController.methods.setEmergencyMode(active).encodeABI();
      
      const tx = {
        from: account.address,
        to: RISK_CONTROLLER_ADDRESS,
        gas: 100000,
        data: data
      };

      const signedTx = await this.web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
      await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      console.log(`[Blockchain] Emergency mode set to ${active}.`);
    } catch (err) {
      console.error('[Blockchain Error] Failed to set emergency mode:', err.message);
    }
  }

  async syncAccountBorrowProfile(userAddress, profile) {
    const LENDING_PROTOCOL_ADDRESS = process.env.LENDING_PROTOCOL_ADDRESS;
    if (!LENDING_PROTOCOL_ADDRESS || !PRIVATE_KEY) {
      console.warn('[Blockchain] Lending protocol address or Private Key missing. Skipping on-chain profile sync.');
      return;
    }

    try {
      const LendingAndBorrowingABI = require('../../abis/LendingAndBorrowing.json');
      const contract = new this.web3.eth.Contract(LendingAndBorrowingABI.abi, LENDING_PROTOCOL_ADDRESS);
      const account = this.web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);

      const tierNum = profile.accountTier === 'Tier 3' ? 3 : profile.accountTier === 'Tier 2' ? 2 : 1;
      
      const totalLimitWei = this.web3.utils.toWei(profile.totalBorrowLimit.toString(), 'ether');
      const availableWei = this.web3.utils.toWei(profile.availableBorrowLimit.toString(), 'ether');
      const outstandingWei = this.web3.utils.toWei(profile.borrowedOutstanding.toString(), 'ether');

      const data = contract.methods.syncAccountBorrowProfile(
        userAddress,
        totalLimitWei,
        availableWei,
        outstandingWei,
        profile.repaymentCount || 0,
        profile.trustScore || 100,
        profile.riskScore || 0,
        tierNum,
        profile.borrowEligibility !== false
      ).encodeABI();

      const tx = {
        from: account.address,
        to: LENDING_PROTOCOL_ADDRESS,
        gas: 300000,
        data: data
      };

      const signedTx = await this.web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
      await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      console.log(`[Blockchain] Successfully synced account borrow profile for ${userAddress} on-chain.`);
    } catch (err) {
      // Non-fatal — MongoDB profile is already updated.
      console.warn(`[Blockchain] On-chain profile sync skipped for ${userAddress}: ${err.message}`);
    }
  }
}

module.exports = new BlockchainService();
