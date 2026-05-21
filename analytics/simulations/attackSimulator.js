const Simulation = require('../../database/models/Simulation');
const { processEvent } = require('../../backend/utils/eventProcessor');
const Alert = require('../../database/models/Alert');
const RiskScore = require('../../database/models/RiskScore');

/**
 * Attack Simulation Engine
 * Generates synthetic attacks to validate resilience.
 */
class AttackSimulator {
  async runSimulation(type, userAddress) {
    console.log(`[Simulation] Starting ${type} attack for user ${userAddress}...`);

    // Normalise type — frontend sends 'FLASH_LOAN', model expects 'FlashLoan'
    const typeMap = {
      'FLASH_LOAN':          'FlashLoan',
      'ORACLE_MANIPULATION': 'OracleManipulation',
      'SYBIL':               'RapidBorrowing',   // sybil uses rapid borrow pattern
      'VELOCITY':            'RapidBorrowing'
    };
    const normalisedType = typeMap[type] || type;

    const sim = new Simulation({
      attackType: normalisedType,
      userAddress: userAddress,
      status: 'Running'
    });
    await sim.save();

    const startTime = Date.now();
    let result = {};

    try {
      switch (normalisedType) {
        case 'FlashLoan':
          result = await this.simulateFlashLoan(userAddress);
          break;
        case 'OracleManipulation':
          result = await this.simulateOracleAttack(userAddress);
          break;
        case 'RapidBorrowing':
          result = await this.simulateRapidBorrowing(userAddress);
          break;
        case 'LiquidityDrain':
          result = await this.simulateLiquidityDrain(userAddress);
          break;
        default:
          result = await this.simulateFlashLoan(userAddress);
      }

      // Check if system detected it
      const detection = await this.verifyDetection(userAddress, normalisedType, startTime);

      sim.status = detection.detected ? 'Detected' : 'Succeeded';
      sim.detectionTime = detection.time;
      sim.riskScoreIncrease = detection.score;
      sim.details = result.details;
      sim.onChainAction = detection.onChainAction;
      await sim.save();

      // Return a shape the frontend can render directly
      return {
        ...sim.toObject(),
        message: detection.detected
          ? `${normalisedType} attack pattern detected and isolated. Risk score increased by ${detection.score.toFixed(1)}. Wallet flagged for review.`
          : `${normalisedType} simulation completed. No detection triggered — consider tuning detector thresholds.`,
        scoreChange: detection.score,
        detected: detection.detected,
        detectionTime: detection.time,
        onChainAction: detection.onChainAction
      };
    } catch (err) {
      console.error('[Simulation Error]', err);
      sim.status = 'Pending';
      await sim.save();
    }
  }

  async simulateFlashLoan(userAddress) {
    const block = 99999;
    // Step 1: Borrow
    await processEvent({
      transactionHash: '0xSIM_BORROW_' + Date.now(),
      blockNumber: block,
      returnValues: { sender: userAddress, amount: '5000000' }
    }, 'Borrow');

    // Step 2: Repay
    await processEvent({
      transactionHash: '0xSIM_REPAY_' + Date.now(),
      blockNumber: block,
      returnValues: { sender: userAddress, amount: '5000000' }
    }, 'Repay');

    return { details: 'Generated synthetic Borrow/Repay pair in block 99999.' };
  }

  async simulateOracleAttack(userAddress) {
    await processEvent({
      transactionHash: '0xSIM_ORACLE_' + Date.now(),
      blockNumber: 100000,
      returnValues: { sender: userAddress, amount: '999999999' } // Extreme value
    }, 'Deposit');

    return { details: 'Generated anomalous high-value deposit event.' };
  }

  async simulateRapidBorrowing(userAddress) {
    for (let i = 0; i < 6; i++) {
      await processEvent({
        transactionHash: `0xSIM_VELOCITY_${i}_` + Date.now(),
        blockNumber: 100001 + i,
        returnValues: { sender: userAddress, amount: '1000' }
      }, 'Borrow');
    }
    return { details: 'Generated 6 rapid borrow events.' };
  }

  async simulateLiquidityDrain(userAddress) {
    await processEvent({
      transactionHash: '0xSIM_DRAIN_' + Date.now(),
      blockNumber: 100002,
      returnValues: { sender: userAddress, amount: '1000000000' } // Drain everything
    }, 'Withdraw');
    return { details: 'Generated massive withdrawal event.' };
  }

  async verifyDetection(userAddress, type, startTime) {
    // Wait for engine to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    const latestAlert = await Alert.findOne({ 
      'metadata.user': userAddress,
      createdAt: { $gte: new Date(startTime) }
    });

    const risk = await RiskScore.findOne({ address: userAddress });

    return {
      detected: !!latestAlert,
      time: latestAlert ? (new Date(latestAlert.createdAt) - startTime) : 0,
      score: risk ? risk.score : 0,
      onChainAction: risk && risk.score >= 7 ? 'User Restricted' : 'None'
    };
  }
}

module.exports = new AttackSimulator();
