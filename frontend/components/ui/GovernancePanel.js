import React, { useState } from 'react';

const GovernancePanel = ({ onPause, onUnpause, onSimulateAttack, accountAddress }) => {
  const [isEmergency, setIsEmergency] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logAction = async (action, details) => {
    const requestId = `gov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
      await fetch('http://localhost:5001/api/governance/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          adminAddress: accountAddress,
          details,
          requestId
        })
      });
    } catch (err) {
      console.error('Failed to log governance action:', err);
    }
  };

  const handlePause = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onPause();
      setIsEmergency(true);
      await logAction('PAUSE', 'Protocol-wide emergency pause activated by admin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnpause = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onUnpause();
      setIsEmergency(false);
      await logAction('UNPAUSE', 'Protocol-wide emergency pause deactivated. Normal operations resumed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulate = async (type) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const requestId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
      await onSimulateAttack(type, requestId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-900/40 rounded-2xl border border-white/5 p-6 backdrop-blur-xl">
      <h3 className="text-white font-bold mb-6 flex items-center">
        <span className="mr-2">🛡️</span> Security Control Center
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Emergency Kill-switch */}
        <div className={`p-4 rounded-xl border ${isEmergency ? 'bg-red-500/20 border-red-500/50' : 'bg-gray-800/40 border-white/10'}`}>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold text-gray-300">Protocol Status</span>
            <span className={`h-2 w-2 rounded-full ${isEmergency ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
          </div>
          
          <div className="flex gap-2">
            {!isEmergency ? (
              <button 
                onClick={handlePause}
                disabled={isSubmitting}
                className={`flex-1 ${isSubmitting ? 'bg-gray-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} text-white text-sm font-bold py-2 rounded-lg transition-all`}
              >
                {isSubmitting ? 'PROCESSING...' : 'ENABLE EMERGENCY PAUSE'}
              </button>
            ) : (
              <button 
                onClick={handleUnpause}
                disabled={isSubmitting}
                className={`flex-1 ${isSubmitting ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white text-sm font-bold py-2 rounded-lg transition-all`}
              >
                {isSubmitting ? 'PROCESSING...' : 'RESUME PROTOCOL'}
              </button>
            )}
          </div>
        </div>

        {/* Attack Simulation */}
        <div className="p-4 rounded-xl bg-gray-800/40 border border-white/10">
          <span className="text-sm font-semibold text-gray-300 block mb-4">Stress Test Simulations</span>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => handleSimulate('FlashLoan')}
              disabled={isSubmitting}
              className={`px-3 py-1.5 ${isSubmitting ? 'bg-gray-700 cursor-not-allowed opacity-50' : 'bg-gray-700 hover:bg-gray-600'} text-gray-300 text-[10px] font-bold rounded border border-white/5 transition-all`}
            >
              FLASH LOAN
            </button>
            <button 
              onClick={() => handleSimulate('Oracle')}
              disabled={isSubmitting}
              className={`px-3 py-1.5 ${isSubmitting ? 'bg-gray-700 cursor-not-allowed opacity-50' : 'bg-gray-700 hover:bg-gray-600'} text-gray-300 text-[10px] font-bold rounded border border-white/5 transition-all`}
            >
              ORACLE DRIFT
            </button>
            <button 
              onClick={() => handleSimulate('Velocity')}
              disabled={isSubmitting}
              className={`px-3 py-1.5 ${isSubmitting ? 'bg-gray-700 cursor-not-allowed opacity-50' : 'bg-gray-700 hover:bg-gray-600'} text-gray-300 text-[10px] font-bold rounded border border-white/5 transition-all`}
            >
              VELOCITY SPIKE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GovernancePanel;
