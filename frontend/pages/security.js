import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import EnterpriseLayout from '../components/ui/EnterpriseLayout';
import { useAccount } from '../components/hooks/web3';
import RiskCard from '../components/ui/RiskCard';
import GovernancePanel from '../components/ui/GovernancePanel';
import SimulationReport from '../components/ui/SimulationReport';
import { useWeb3 } from '../components/providers/web3';
import axios from 'axios';
import { io } from 'socket.io-client';
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

export default function SecurityDashboard() {
  const { account } = useAccount();
  const { contract, web3 } = useWeb3();
  
  // Real-Time MongoDB state
  const [securityLogs, setSecurityLogs] = useState([]);
  const [solvencyHistory, setSolvencyHistory] = useState([]);
  const [globalMetrics, setGlobalMetrics] = useState(null);
  const [walletMetrics, setWalletMetrics] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Controls
  const [severityFilter, setSeverityFilter] = useState('ALL'); // 'ALL', 'HIGH', 'WARNING', 'INFO'
  const [feedType, setFeedType] = useState('global'); // 'global', 'personal'

  // Fetch initial telemetry and logs
  const fetchSecurityData = async () => {
    try {
      // 1. Fetch Global Telemetry
      const globRes = await axios.get('http://localhost:5001/api/telemetry/global');
      if (globRes.data) {
        setGlobalMetrics(globRes.data);
      }

      // 2. Fetch Solvency History
      const solvRes = await axios.get('http://localhost:5001/api/telemetry/solvency-history');
      if (solvRes.data) {
        setSolvencyHistory(solvRes.data);
      }

      // 3. Fetch Security Logs with filters
      let logUrl = 'http://localhost:5001/api/security-logs?';
      if (feedType === 'personal' && account.data) {
        logUrl += `wallet=${account.data.toLowerCase()}&`;
      }
      if (severityFilter !== 'ALL') {
        logUrl += `severity=${severityFilter}&`;
      }
      const logsRes = await axios.get(logUrl);
      setSecurityLogs(logsRes.data || []);

      // 4. Fetch simulations from SaaS simulation logs
      const simRes = await axios.get('http://localhost:5001/api/v1/saas/simulations').catch(() => ({ data: [] }));
      setSimulations(simRes.data || []);

      // 5. Fetch user-specific telemetry
      if (account.data) {
        const walletRes = await axios.get(`http://localhost:5001/api/telemetry/wallet/${account.data}`);
        if (walletRes.data) {
          setWalletMetrics(walletRes.data);
        }
      }

      // 6. Check contract pause state
      if (contract) {
        const pausedState = await contract.methods.paused().call().catch(() => false);
        setIsPaused(pausedState);
      }

    } catch (err) {
      console.error('[Security] Failed to fetch live security data:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
    
    // Fallback polling refresh every 6 seconds
    const interval = setInterval(() => {
      fetchSecurityData();
    }, 6000);

    return () => clearInterval(interval);
  }, [account.data, severityFilter, feedType, contract]);

  // Socket.io Real-Time Event Hook
  useEffect(() => {
    if (!account.data) return;

    console.log('[WebSocket Security] Connecting...');
    const socket = io('http://localhost:5001');

    socket.on('connect', () => {
      console.log('[WebSocket Security] Connected. Joining wallet room:', account.data);
      socket.emit('join_wallet', account.data.toLowerCase());
    });

    socket.on('securityLogUpdate', (log) => {
      console.log('[WebSocket Security] Live Security Log received:', log);
      
      // Conditionally prepend if filters match
      const isForMe = log.walletAddress.toLowerCase() === account.data.toLowerCase();
      if (feedType === 'personal' && !isForMe) return;
      if (severityFilter !== 'ALL' && log.severity !== severityFilter) return;

      setSecurityLogs(prev => {
        if (prev.some(x => x._id === log._id)) return prev;
        return [log, ...prev];
      });
    });

    socket.on('globalTelemetryUpdate', (metrics) => {
      console.log('[WebSocket Security] Global telemetry update:', metrics);
      setGlobalMetrics(metrics);
      setSolvencyHistory(prev => {
        const updated = [...prev, metrics];
        if (updated.length > 50) updated.shift();
        return updated;
      });
    });

    socket.on('walletTelemetryUpdate', (metrics) => {
      if (metrics.walletAddress.toLowerCase() === account.data.toLowerCase()) {
        console.log('[WebSocket Security] Wallet telemetry update:', metrics);
        setWalletMetrics(metrics);
      }
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket Security] Disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, [account.data, severityFilter, feedType]);

  const handlePause = async () => {
    if (!contract || !account.data) return alert("Please connect an admin wallet.");
    try {
      await contract.methods.pause().send({ from: account.data });
      setIsPaused(true);
      alert('Protocol Emergency Paused successfully.');
    } catch (err) {
      console.error(err);
      alert('Transaction failed: admin authorization required.');
    }
  };

  const handleUnpause = async () => {
    if (!contract || !account.data) return alert("Please connect an admin wallet.");
    try {
      await contract.methods.unpause().send({ from: account.data });
      setIsPaused(false);
      alert('Protocol Resumed successfully.');
    } catch (err) {
      console.error(err);
      alert('Transaction failed: admin authorization required.');
    }
  };

  const handleSimulateAttack = async (type) => {
    alert(`Initiating automated ${type} threat simulation... Security logs stream will display details.`);
    try {
      await fetch('http://localhost:5001/api/simulations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: type,
          userAddress: account.data
        })
      });
      fetchSecurityData();
    } catch (err) {
      console.error('Simulation failed:', err);
    }
  };

  // Convert solvency history for Recharts
  const solvencyChartData = solvencyHistory.map((s, idx) => ({
    time: s.timestamp ? new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `T-${solvencyHistory.length - idx}`,
    score: s.solvencyScore || 100
  }));

  const displaySolvencyData = solvencyChartData.length > 0 ? solvencyChartData : [
    { time: '10:00', score: 100 },
    { time: '11:00', score: 100 },
    { time: '12:00', score: 100 }
  ];

  // Derived values for bottom console
  const totalCollateral = walletMetrics?.collateral || 0;
  const totalDebt = walletMetrics?.debt || 0;
  const walletRiskScore = walletMetrics?.riskScore !== undefined ? (walletMetrics.riskScore / 10).toFixed(1) : "0.0";
  const trustScore = walletMetrics?.trustScore || 100;
  const accountTier = walletMetrics?.accountTier || "Tier 1";

  return (
    <EnterpriseLayout title="Security Control Panel">
      <div className="mb-24">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
              Security <span className="text-red-500">Control Panel</span>
            </h1>
            <p className="text-gray-400 mt-1 flex items-center font-medium">
              <span className="h-2.5 w-2.5 bg-red-500 rounded-full mr-2.5 animate-ping"></span>
              Real-time autonomous threat detection engine active
            </p>
          </div>
          
          <div className="flex gap-3">
             <div className="px-4 py-2 bg-gray-900/60 rounded-2xl border border-white/5 backdrop-blur-sm">
                <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">Protocol Safety Status</span>
                <span className={`text-sm font-black font-mono tracking-widest uppercase ${isPaused ? 'text-red-500' : 'text-emerald-400 animate-pulse'}`}>
                  {isPaused ? 'Emergency Paused' : 'Operational'}
                </span>
             </div>
             <div className="px-4 py-2 bg-gray-900/60 rounded-2xl border border-white/5 backdrop-blur-sm">
                <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">Solvency Ratio</span>
                <span className="text-sm font-black text-blue-400 font-mono tracking-widest">
                  {globalMetrics?.solvencyScore || 100}%
                </span>
             </div>
          </div>
        </div>

        {!account.data ? (
          <div className="flex flex-col items-center justify-center p-16 bg-gray-900/30 border border-white/5 rounded-3xl backdrop-blur-md">
            <svg className="w-16 h-16 text-gray-500 mb-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="text-lg font-bold text-white mb-2">Security Authorization Required</h3>
            <p className="text-gray-500 text-sm">Please connect your MetaMask wallet to gain access to security telemetries.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column - Live Risk Scores, Governance, & Graphs */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* Risk Scores Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <RiskCard 
                  title="Global Protocol Risk" 
                  score={(globalMetrics?.tvl > 0 ? (globalMetrics.totalBorrowed / globalMetrics.tvl) * 10 : 0.8).toFixed(1)} 
                  trend={-2.4} 
                />
                <RiskCard 
                  title="Personal Threat Profile" 
                  score={walletRiskScore} 
                  trend={0.0}
                  details={walletMetrics?.riskScore > 0 ? "Flagged high-frequency transaction activity" : "No threat patterns detected."}
                />
              </div>

              {/* Governance & Pausing Controls */}
              <GovernancePanel 
                onPause={handlePause}
                onUnpause={handleUnpause}
                onSimulateAttack={handleSimulateAttack}
                accountAddress={account.data}
              />

              {/* Dynamic Solvency History AreaChart (Phase 5) */}
              <div className="bg-gray-900/40 rounded-[2rem] border border-white/5 p-8 relative overflow-hidden group backdrop-blur-xl">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 blur-[100px] rounded-full group-hover:bg-red-500/10 transition-all"></div>
                 <h3 className="text-lg font-bold text-white mb-2">Global Solvency Trajectory</h3>
                 <p className="text-xs text-gray-500 mb-6">Real-time ratio between supplied TVL and borrowed outstanding liquidity</p>
                 
                 <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={displaySolvencyData}>
                      <defs>
                        <linearGradient id="colorSolv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="time" stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} domain={[50, 110]} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="score" name="Solvency score" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorSolv)" />
                    </AreaChart>
                  </ResponsiveContainer>
                 </div>
              </div>

              {/* Simulation Report */}
              <SimulationReport simulations={simulations} />
            </div>

            {/* Right Column - Autonomous Live Security Logs (Phase 2) */}
            <div className="lg:col-span-5 space-y-8 flex flex-col justify-start">
              
              {/* Security Logs Box */}
              <div className="bg-gray-900/40 rounded-[2rem] border border-white/5 p-8 backdrop-blur-xl flex flex-col min-h-[500px]">
                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Autonomous Threat Stream</h3>
                    <p className="text-xs text-gray-500">Live security engine detection logs</p>
                  </div>
                  
                  {/* Feed Toggle (Global vs Personal) */}
                  <div className="flex bg-gray-950 p-1 border border-white/10 rounded-xl">
                    <button 
                      onClick={() => setFeedType('global')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition ${feedType === 'global' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                      Global
                    </button>
                    <button 
                      onClick={() => setFeedType('personal')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition ${feedType === 'personal' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                      Wallet
                    </button>
                  </div>
                </div>

                {/* Severity Filters */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {['ALL', 'HIGH', 'WARNING', 'INFO'].map(sev => (
                    <button
                      key={sev}
                      onClick={() => setSeverityFilter(sev)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                        severityFilter === sev 
                          ? 'bg-red-500/20 border-red-500 text-red-300' 
                          : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                      }`}>
                      {sev}
                    </button>
                  ))}
                </div>

                {/* Logs Stream (Phase 2 animated entry) */}
                <div className="flex-1 overflow-y-auto max-h-[350px] space-y-4 pr-1 custom-scrollbar">
                  {securityLogs.length > 0 ? (
                    securityLogs.map((log, idx) => (
                      <div 
                        key={log._id || idx} 
                        className={`p-4 rounded-2xl border transition duration-300 transform translate-x-0 ${
                          log.severity === 'HIGH' ? 'bg-red-950/20 border-red-500/20 text-red-100 hover:border-red-500/40' :
                          log.severity === 'WARNING' ? 'bg-amber-950/20 border-amber-500/20 text-amber-100 hover:border-amber-500/40' :
                          'bg-blue-950/20 border-blue-500/20 text-blue-100 hover:border-blue-500/40'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            log.severity === 'HIGH' ? 'bg-red-500 text-white' :
                            log.severity === 'WARNING' ? 'bg-amber-500 text-black' :
                            'bg-blue-500 text-white'
                          }`}>
                            {log.severity}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-white mb-1.5">{log.message}</p>
                        
                        <div className="text-[10px] text-gray-400 space-y-1">
                          <div>
                            <span className="font-bold uppercase text-gray-500 tracking-wider text-[8px] mr-1.5">Threat:</span>
                            <span className="font-mono text-white">{log.threatType}</span>
                          </div>
                          <div>
                            <span className="font-bold uppercase text-gray-500 tracking-wider text-[8px] mr-1.5">Mitigation:</span>
                            <span className="font-mono text-emerald-400">{log.mitigationAction || 'None'}</span>
                          </div>
                          {log.txHash && (
                            <div>
                              <span className="font-bold uppercase text-gray-500 tracking-wider text-[8px] mr-1.5">Tx Hash:</span>
                              <a 
                                href={`https://etherscan.io/tx/${log.txHash}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="font-mono text-blue-400 hover:underline">
                                {log.txHash.slice(0, 10)}...{log.txHash.slice(-8)}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center py-20 text-center border border-dashed border-gray-800 rounded-[1.5rem]">
                      <svg className="w-10 h-10 text-gray-600 mb-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <h4 className="text-sm font-bold text-gray-400">Sandbox Protected</h4>
                      <p className="text-[11px] text-gray-600 px-6 mt-1 leading-relaxed">No threat events flagged. The threat log is clear and identity validation is 100% operational.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* LIVE OVERLAY TELEMETRY FOOTER PANEL (PHASE 4) */}
      {account.data && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/85 backdrop-blur-2xl border-t border-white/10 px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-4 transition duration-300 shadow-2xl animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
            <div>
              <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-widest">Active Financial Identity</span>
              <span className="font-mono text-[11px] text-white font-bold tracking-tight select-all">{account.data}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 md:gap-10">
            <div>
              <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Live Collateral</span>
              <span className="text-emerald-400 font-mono font-bold text-xs">${totalCollateral.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Live Debt</span>
              <span className="text-red-400 font-mono font-bold text-xs">${totalDebt.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Current Risk</span>
              <span className="text-amber-400 font-mono font-bold text-xs">{walletRiskScore}</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Identity Score</span>
              <span className="text-blue-400 font-mono font-bold text-xs">{trustScore}</span>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Risk Assessment</span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${parseFloat(walletRiskScore) >= 7 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {parseFloat(walletRiskScore) >= 7 ? 'Critical Threat' : 'Authorized'}
              </span>
            </div>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </EnterpriseLayout>
  );
}
