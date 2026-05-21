import React from 'react';

const GlobalLoading = ({ message = "Connecting to Secure Protocol...", error = null, onRetry }) => {
  return (
    <div className="min-h-screen bg-[#0a0b14] flex flex-col items-center justify-center p-4">
      <div className="relative">
        {/* Animated Rings */}
        <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping"></div>
        <div className="w-24 h-24 rounded-full border-t-4 border-blue-500 animate-spin shadow-[0_0_20px_rgba(59,130,246,0.5)]"></div>
        
        {/* Inner Pulse */}
        <div className="absolute inset-0 m-auto w-12 h-12 bg-blue-500 rounded-full animate-pulse shadow-inner flex items-center justify-center">
            <span className="text-[10px] font-bold text-white uppercase tracking-tighter">FortiFi</span>
        </div>
      </div>

      <div className="mt-12 text-center max-w-md">
        {error ? (
          <>
            <h2 className="text-2xl font-bold text-red-400 mb-2">Connection Anomaly Detected</h2>
            <p className="text-gray-400 mb-6 font-mono text-sm">{error}</p>
            <button 
              onClick={onRetry || (() => window.location.reload())}
              className="px-8 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 hover:bg-red-500/20 transition-all font-bold uppercase tracking-widest text-xs"
            >
              Force Reconnect
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">{message}</h2>
            <div className="flex items-center justify-center gap-2">
                <span className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce"></span>
            </div>
            <p className="text-gray-500 mt-8 text-[10px] uppercase tracking-[0.2em] font-medium opacity-50">
              Autonomous Threat Intelligence Engine Active
            </p>
          </>
        )}
      </div>

      <style jsx>{`
        .loader {
          border-top-color: #3b82f6;
          -webkit-animation: spinner 1.5s linear infinite;
          animation: spinner 1.5s linear infinite;
        }
        @-webkit-keyframes spinner {
          0% { -webkit-transform: rotate(0deg); }
          100% { -webkit-transform: rotate(360deg); }
        }
        @keyframes spinner {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default GlobalLoading;
