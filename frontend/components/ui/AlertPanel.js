import React from 'react';

const AlertPanel = ({ alerts }) => {
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'Critical': return '🛑';
      case 'High': return '🟠';
      case 'Medium': return '🟡';
      default: return '🔵';
    }
  };

  return (
    <div className="bg-gray-900/60 rounded-2xl border border-white/10 overflow-hidden flex flex-col h-full shadow-xl backdrop-blur-md">
      <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
        <h3 className="text-white font-semibold">Threat Intelligence Feed</h3>
        <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="text-gray-500 text-center py-10 italic">No threats detected. System secure.</div>
        ) : (
          alerts.map((alert, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-gray-800/50 border-l-2 border-red-500 hover:bg-gray-800 transition-colors">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-red-400 uppercase">{alert.severity}</span>
                <span className="text-[10px] text-gray-500">{new Date(alert.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm text-gray-200 leading-snug">{alert.message}</p>
              <div className="mt-2 text-[10px] text-gray-500 font-mono truncate">
                ID: {alert._id?.slice(-8) || 'N/A'} | User: {alert.metadata?.user?.slice(0, 10) || 'Unknown'}...
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AlertPanel;
