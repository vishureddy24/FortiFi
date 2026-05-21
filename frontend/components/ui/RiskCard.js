import React from 'react';

const RiskCard = ({ title, score, trend, details }) => {
  // Normalise to number — score may arrive as string from API or socket
  const s = Number(score) || 0;

  const getScoreColor = (v) => {
    if (v < 3) return 'text-green-500 bg-green-500/10';
    if (v < 7) return 'text-yellow-500 bg-yellow-500/10';
    return 'text-red-500 bg-red-500/10';
  };

  const getBorderColor = (v) => {
    if (v < 3) return 'border-green-500/20';
    if (v < 7) return 'border-yellow-500/20';
    return 'border-red-500/20';
  };

  return (
    <div className={`p-6 rounded-2xl border ${getBorderColor(s)} bg-gray-900/40 backdrop-blur-xl shadow-2xl transition-all hover:scale-[1.02]`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
          <p className="text-3xl font-bold text-white mt-1">{s.toFixed(1)}<span className="text-sm text-gray-500">/10</span></p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${getScoreColor(s)}`}>
          {s < 3 ? 'LOW' : s < 7 ? 'MEDIUM' : 'HIGH'}
        </div>
      </div>
      
      {details && (
        <div className="mt-4 space-y-2">
          {Object.entries(details).map(([key, value]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
              <span className="text-gray-300 font-mono">+{value}</span>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-6 flex items-center text-xs text-gray-500">
        <span className={Number(trend) >= 0 ? 'text-red-400' : 'text-green-400'}>
          {Number(trend) >= 0 ? '▲' : '▼'} {Math.abs(Number(trend) || 0)}%
        </span>
        <span className="ml-2 italic">vs last 24h</span>
      </div>
    </div>
  );
};

export default RiskCard;
