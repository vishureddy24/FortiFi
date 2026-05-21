require('dotenv').config();
const { Web3 } = require('web3');
const LendingAndBorrowing = require('../../abis/LendingAndBorrowing.json');
const WalletProfile = require('../../database/models/WalletProfile');
const WalletScore = require('../../database/models/WalletScore');

const web3 = new Web3(process.env.RPC_URL || 'http://127.0.0.1:7545');

async function rebuildPortfolio(wallet, eventType = null, txHash = null) {
    try {
        wallet = wallet.toLowerCase();
        const networkId = await web3.eth.net.getId();
        const contractData = LendingAndBorrowing.networks[networkId];
        
        if (!contractData) {
            console.error(`Contract not deployed on network ${networkId}`);
            return null;
        }

        const contract = new web3.eth.Contract(LendingAndBorrowing.abi, contractData.address);

        // Fetch data from contract
        let outstandingDebtWei = await contract.methods.getOutstandingDebt(wallet).call();
        let creditLimitWei = await contract.methods.getCreditLimit(wallet).call();
        let collateralWei = await contract.methods.getTotalAmountLentInDollars(wallet).call();
        
        const debt = Number(web3.utils.fromWei(outstandingDebtWei, 'ether')) || 0;
        const creditLimit = Number(web3.utils.fromWei(creditLimitWei, 'ether')) || 0;
        const collateral = Number(web3.utils.fromWei(collateralWei, 'ether')) || 0;
        
        // 1. Fetch Profile
        let profile = await WalletProfile.findOne({ address: wallet });
        if (!profile) profile = new WalletProfile({ address: wallet });

        // 2. Score Formulas
        let utilization = 0;
        if (creditLimit > 0) {
            utilization = (debt / creditLimit) * 100;
        }
        
        const risk = Math.min(10, utilization / 10);
        const health = Math.max(1, collateral / Math.max(debt, 1));
        const successfulRepays = profile.repaymentCount || 0;
        const identity = 100 + (successfulRepays * 5);
        const capacity = Math.max(0, creditLimit - debt);
        const buffer = Math.max(0, collateral - debt);

        // 3. Last Score retrieval
        let lastScoreDoc = await WalletScore.findOne({ walletAddress: wallet }).sort({ timestamp: -1 });
        let newMetrics = lastScoreDoc && lastScoreDoc.metrics ? { ...lastScoreDoc.metrics.toObject() } : {
            healthFactor: health,
            borrowUtilization: utilization,
            riskScore: risk,
            trustIdentityScore: identity,
            suppliedCollateral: collateral,
            outstandingDebt: debt,
            dynamicCreditLimit: creditLimit > 0 ? creditLimit : 200, // DEFAULT_CREDIT_LIMIT = 200
            borrowCapacity: capacity,
            liquidationBuffer: buffer
        };

        // Realtime update rules mapping
        if (eventType === 'Borrow') {
            newMetrics.outstandingDebt = debt;
            newMetrics.riskScore = risk;
            newMetrics.borrowUtilization = utilization;
            newMetrics.borrowCapacity = capacity;
            newMetrics.healthFactor = health;
        } else if (eventType === 'Repay') {
            newMetrics.outstandingDebt = debt;
            newMetrics.borrowCapacity = capacity;
            newMetrics.healthFactor = health;
            newMetrics.borrowUtilization = utilization;
        } else if (eventType === 'Supply' || eventType === 'Deposit') {
            newMetrics.suppliedCollateral = collateral;
            newMetrics.trustIdentityScore = identity;
            newMetrics.borrowCapacity = capacity;
            newMetrics.liquidationBuffer = buffer;
        } else if (eventType === 'Withdraw') {
            newMetrics.suppliedCollateral = collateral;
            newMetrics.healthFactor = health;
            newMetrics.riskScore = risk;
            newMetrics.liquidationBuffer = buffer;
        } else {
            newMetrics = {
                healthFactor: health,
                borrowUtilization: utilization,
                riskScore: risk,
                trustIdentityScore: identity,
                suppliedCollateral: collateral,
                outstandingDebt: debt,
                dynamicCreditLimit: creditLimit,
                borrowCapacity: capacity,
                liquidationBuffer: buffer
            };
        }

        // 4. Append WalletScore (Never overwrite)
        const snapshot = new WalletScore({
            walletAddress: wallet,
            metrics: newMetrics,
            txHash: txHash || 'Unknown',
            eventType: eventType || 'Sync'
        });
        await snapshot.save();

        // Note: Update WalletProfile for completeness
        await WalletProfile.findOneAndUpdate(
            { address: wallet },
            {
                totalDebt: newMetrics.outstandingDebt,
                borrowedOutstanding: newMetrics.outstandingDebt,
                totalCollateral: newMetrics.suppliedCollateral,
                totalBorrowLimit: newMetrics.dynamicCreditLimit,
                creditLimit: newMetrics.dynamicCreditLimit,
                availableBorrowLimit: newMetrics.borrowCapacity,
                availableBorrow: newMetrics.borrowCapacity,
                borrowUtilization: newMetrics.borrowUtilization,
                walletRiskScore: newMetrics.riskScore,
                riskScore: newMetrics.riskScore,
                healthFactor: newMetrics.healthFactor,
                trustScore: newMetrics.trustIdentityScore,
                lastUpdated: new Date()
            },
            { upsert: true, new: true }
        );
        
        return {
            wallet,
            snapshot,
            ...newMetrics
        };

    } catch (err) {
        console.error(`[rebuildPortfolio] Failed for wallet ${wallet}:`, err);
        return null;
    }
}

module.exports = rebuildPortfolio;
