const Alert = require('../../database/models/Alert');

/**
 * Alert Manager
 * Automatically triggers and stores alerts based on detection results.
 */
const triggerAlert = async (userAddress, detectionResult) => {
  try {
    const alert = new Alert({
      type: 'Security',
      severity: detectionResult.severity || 'Medium',
      message: `[DEFI-THREAT] ${detectionResult.reason}`,
      metadata: {
        user: userAddress,
        ...detectionResult
      }
    });

    await alert.save();
    
    // Real-time broadcast
    if (global.io) {
      global.io.emit('new-alert', alert);
    }

    console.log(`[ALERT TRIGGERED] ${detectionResult.reason} for user ${userAddress}`);
  } catch (err) {
    console.error('[Alerting Error]', err.message);
  }
};

module.exports = { triggerAlert };
