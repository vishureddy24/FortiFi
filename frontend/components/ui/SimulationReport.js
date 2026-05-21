import React from 'react';

const SimulationReport = ({ simulations }) => {
  return (
    <div className="bg-gray-900/60 rounded-2xl border border-white/10 overflow-hidden shadow-xl backdrop-blur-md">
      <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
        <h3 className="text-white font-semibold italic">Attack Resilience Logs</h3>
        <span className="text-[10px] text-gray-500 font-mono tracking-widest">RESILIENCE_REPORT_v1.0</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-gray-400 font-bold uppercase tracking-tighter">
            <tr>
              <th className="px-4 py-3">Attack Vector</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Detection Time</th>
              <th className="px-4 py-3">Risk Score</th>
              <th className="px-4 py-3">On-Chain Sync</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {simulations.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-4 py-10 text-center text-gray-600 italic">No simulation data available. Initiate stress test to begin.</td>
              </tr>
            ) : (
              simulations.map((sim, idx) => (
                <tr key={idx} className="hover:bg-white/5 transition-colors group">
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-white font-bold">{sim.attackType}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{sim._id.slice(-8)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      sim.status === 'Detected' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {sim.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-300 font-mono">
                    {sim.detectionTime || 0}ms
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-gray-300">{sim.riskScoreIncrease?.toFixed(1)}</span>
                    <span className="text-gray-600">/10</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-[10px] font-mono text-blue-400">{sim.onChainAction}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SimulationReport;
