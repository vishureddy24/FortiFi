import Head from 'next/head';
import { useRouter } from 'next/router';
import EnterpriseLayout from '../components/ui/EnterpriseLayout';
import { useWalletEnterprise } from '../hooks/useWalletEnterprise';
import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';

export default function EnterpriseDashboard() {
  const {
    activeAddress,
    metrics,
    history,
    securityLogs,
    transactions,
    isConnected,
    isLoading
  } = useWalletEnterprise();

  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [searchTx, setSearchTx] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Derived metrics with fallbacks
  const tvl = metrics?.tvl || 0;
  const borrowed = metrics?.borrowed || 0;
  const activeLoans = metrics?.activeLoans || 0;
  const solvency = metrics?.solvency !== undefined ? Number(metrics.solvency).toFixed(1) : "100.0";
  const currentRisk = tvl > 0 ? ((borrowed * 10) / tvl).toFixed(1) : "0.0";

  // Filtered security logs
  const filteredAlerts = securityLogs.filter(log => {
    if (severityFilter === 'ALL') return true;
    return log.severity?.toUpperCase() === severityFilter;
  });

  // Filtered transactions for Live Explorer
  const filteredTxs = transactions.filter(tx => {
    if (searchTx) {
      const q = searchTx.toLowerCase();
      const matchHash = tx.txHash && tx.txHash.toLowerCase().includes(q);
      const matchType = tx.type && tx.type.toLowerCase().includes(q);
      if (!matchHash && !matchType) return false;
    }
    if (typeFilter !== 'all') {
      if (tx.type !== typeFilter) return false;
    }
    return true;
  });

  // Export to CSV Functionality
  const exportTransactionsCSV = () => {
    if (filteredTxs.length === 0) return alert('No transaction logs to export.');
    const headers = ['Action', 'From', 'To', 'Asset', 'Amount', 'Tx Hash', 'Time', 'Status'];
    const rows = filteredTxs.map(tx => [
      tx.type || 'N/A',
      activeAddress || 'N/A',
      'FortiFi Protocol',
      tx.type === 'Supply' || tx.type === 'Withdraw' ? 'LAR' : 'DAI',
      tx.amount || 0,
      tx.txHash || 'N/A',
      tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'N/A',
      'Confirmed'
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(",") + "\n";
    rows.forEach(row => {
      csvContent += row.join(",") + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `enterprise_tx_export_${activeAddress}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic risk heatmap: Only show assets used by active wallet
  const heatmapData = [];
  if (tvl > 0) {
    heatmapData.push({ asset: 'LAR', risk: 1.5, color: '#10b981' }); // supplied collateral
  }
  if (borrowed > 0) {
    heatmapData.push({ asset: 'DAI', risk: 4.8, color: '#f59e0b' }); // outstanding debt
  }
  if (heatmapData.length === 0) {
    heatmapData.push({ asset: 'No Active Positions', risk: 0, color: '#4b5563' });
  }

  // Solvency History Chart data conversion (last 50 points)
  const chartData = history.map((pt, idx) => ({
    time: pt.timestamp ? new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `T-${history.length - idx}`,
    solvency: pt.solvency || 100
  }));

  const displayChartData = chartData.length > 0 ? chartData : [
    { time: '00:00', solvency: 100 },
    { time: '04:00', solvency: 100 },
    { time: '08:00', solvency: 100 }
  ];

  return (
    <EnterpriseLayout title="Enterprise Telemetry">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            SaaS <span className="text-blue-500">Intelligence Cockpit</span>
          </h1>
          <p className="mt-2 text-gray-400">Institutional DeFi Telemetry, AI Risk Analytics & Live Monitoring.</p>
        </div>
        <div className="flex items-center gap-3">
          {activeAddress && (
            <div className="flex items-center gap-3 bg-gray-900/60 border border-white/10 px-4 py-2 rounded-2xl shadow-lg">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500 animate-pulse'}`}></span>
              <span className="font-mono text-xs text-gray-300 select-all">
                {activeAddress.slice(0, 8)}...{activeAddress.slice(-8)}
              </span>
              <span className="text-[9px] text-gray-500 font-bold ml-1 uppercase">
                {isConnected ? 'Real-Time connected' : 'Reconnecting'}
              </span>
            </div>
          )}
          <button className="bg-red-600/10 border border-red-500/20 hover:bg-red-600 hover:text-white text-red-400 px-6 py-2.5 rounded-2xl font-bold transition-all text-xs uppercase tracking-widest shadow-lg shadow-red-500/5">
            Emergency Circuit Breaker
          </button>
        </div>
      </div>

      {!activeAddress ? (
        <div className="flex flex-col items-center justify-center p-20 bg-gray-900/30 border border-white/5 rounded-3xl backdrop-blur-md">
          <svg className="w-16 h-16 text-gray-500 mb-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 className="text-xl font-bold text-white mb-2">Telemetry Authorization Required</h3>
          <p className="text-gray-500 text-sm">Please connect your MetaMask identity wallet to sync institutional cockpit telemetry.</p>
        </div>
      ) : (
        <>
          {/* Top Premium Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {/* TVL */}
            <div className="bg-gray-900/40 border border-white/5 p-6 rounded-3xl backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-2xl rounded-full"></div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total Value Locked</p>
              <h3 className="text-2xl font-black text-white mb-2 font-mono">${tvl.toFixed(2)}</h3>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                 <span>Live</span>
                 <span className="text-gray-600">active supplied collateral</span>
              </div>
            </div>

            {/* Total Borrowed */}
            <div className="bg-gray-900/40 border border-white/5 p-6 rounded-3xl backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-2xl rounded-full"></div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total Borrowed</p>
              <h3 className="text-2xl font-black text-white mb-2 font-mono">${borrowed.toFixed(2)}</h3>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                 <span>Live</span>
                 <span className="text-gray-600">outstanding protocol debt</span>
              </div>
            </div>

            {/* Active Loans */}
            <div className="bg-gray-900/40 border border-white/5 p-6 rounded-3xl backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-2xl rounded-full"></div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Active Loans</p>
              <h3 className="text-2xl font-black text-white mb-2 font-mono">{activeLoans}</h3>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400">
                 <span>Live Sync</span>
                 <span className="text-gray-600">active credit allocations</span>
              </div>
            </div>

            {/* Protocol Solvency Score */}
            <div className="bg-gradient-to-br from-indigo-950/20 to-blue-950/20 border border-blue-500/20 p-6 rounded-3xl backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-400/10 blur-2xl rounded-full"></div>
              <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest mb-1">Protocol Solvency Score</p>
              <h3 className={`text-2xl font-black mb-2 font-mono ${parseFloat(solvency) >= 150 ? 'text-emerald-400' : parseFloat(solvency) >= 120 ? 'text-amber-400' : 'text-red-500'}`}>{solvency}%</h3>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                 <span>{parseFloat(solvency) >= 120 ? 'Stable State' : 'Unstable Limit'}</span>
                 <span className="text-blue-300/60">self-defending</span>
              </div>
            </div>
          </div>

          {/* Main Charts & Risk Center Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
            {/* System Solvency History */}
            <div className="lg:col-span-8 bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white">System Solvency History</h3>
                  <p className="text-xs text-gray-500">Live dynamic LTV adjustments & threat impact velocity.</p>
                </div>
                <span className="px-3 py-1 bg-white/5 rounded-full text-xs text-gray-400 font-bold uppercase tracking-widest">
                  {isConnected ? 'Real-Time Connected' : 'Syncing'}
                </span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayChartData}>
                    <defs>
                      <linearGradient id="colorSolv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="time" stroke="#ffffff40" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff40" fontSize={11} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '16px' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="solvency" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSolv)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Heatmap Asset Exposure */}
            <div className="lg:col-span-4 bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl">
              <h3 className="text-lg font-bold text-white mb-2">Asset Risk Heatmap</h3>
              <p className="text-xs text-gray-500 mb-6">Liquidity stress & oracle deviation profiles.</p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={heatmapData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                    <XAxis type="number" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} domain={[0, 10]} />
                    <YAxis dataKey="asset" type="category" stroke="#ffffff40" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '16px' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="risk" radius={[0, 8, 8, 0]}>
                      {heatmapData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Real-Time Alert Timeline */}
          <div className="bg-gray-900/40 border border-white/5 rounded-[2rem] overflow-hidden mb-12">
            <div className="px-8 py-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02]">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                  Live Autonomous Security Logs
                </h3>
                <p className="text-xs text-gray-500">Self-defending anomaly engine threat detection stream.</p>
              </div>
              <div className="flex gap-2">
                {['ALL', 'HIGH', 'WARNING', 'INFO'].map(sev => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all border ${
                      severityFilter === sev 
                        ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' 
                        : 'border-transparent text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-white/5 max-h-[380px] overflow-y-auto custom-scrollbar">
              {filteredAlerts.length > 0 ? (
                filteredAlerts.map((alert, i) => {
                  const isHigh = alert.severity === 'HIGH';
                  const sevBadge = isHigh 
                    ? 'text-red-400 border-red-500/20 bg-red-500/5' 
                    : alert.severity === 'WARNING'
                    ? 'text-amber-400 border-amber-500/20 bg-amber-500/5'
                    : 'text-blue-400 border-blue-500/20 bg-blue-500/5';
                  return (
                    <div key={i} className="px-8 py-4.5 flex items-center justify-between hover:bg-white/[0.02] transition-all cursor-pointer">
                      <div className="flex items-center gap-4">
                        <span className={`text-[9px] font-black tracking-widest px-2.5 py-1 rounded border uppercase ${sevBadge}`}>
                          {alert.severity || 'INFO'}
                        </span>
                        <p className="text-sm font-semibold text-gray-300 leading-snug">{alert.event}</p>
                      </div>
                      <span className="text-xs text-gray-500 font-mono font-medium">
                        {new Date(alert.timestamp || alert.createdAt || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="px-8 py-12 text-center text-gray-500">
                  <p className="text-sm">Telemetry stable. No active anomaly warnings detected.</p>
                </div>
              )}
            </div>
          </div>

          {/* Transaction Explorer */}
          <div className="bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl mb-24">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Live Transaction Explorer</h3>
                <p className="text-xs text-gray-500 font-medium">Deep blockchain audit logging for all account events</p>
              </div>

              {/* Advanced Search & Filters & Export CSV */}
              <div className="flex flex-wrap items-center gap-3">
                <input 
                  type="text" 
                  placeholder="Search action or hash..."
                  value={searchTx}
                  onChange={(e) => setSearchTx(e.target.value)}
                  className="bg-gray-955 border border-white/10 rounded-xl px-4 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition w-48"
                />

                <div className="flex bg-gray-900 border border-white/10 rounded-xl p-1">
                  <button 
                    onClick={() => setTypeFilter('all')} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${typeFilter === 'all' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                    All Types
                  </button>
                  <button 
                    onClick={() => setTypeFilter('Supply')} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${typeFilter === 'Supply' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                    Supplies
                  </button>
                  <button 
                    onClick={() => setTypeFilter('Borrow')} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${typeFilter === 'Borrow' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                    Borrows
                  </button>
                </div>

                <button 
                  onClick={exportTransactionsCSV}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>

            {/* Event Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 pb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="py-4 px-2">Action</th>
                    <th className="py-4">From</th>
                    <th className="py-4">To</th>
                    <th className="py-4">Asset</th>
                    <th className="py-4 text-right">Amount</th>
                    <th className="py-4 text-center">Tx Hash</th>
                    <th className="py-4 text-center">Time</th>
                    <th className="py-4 text-right pr-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredTxs.length > 0 ? (
                    filteredTxs.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition duration-150">
                        <td className="py-4 px-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            tx.type === 'Supply' ? 'bg-emerald-500/20 text-emerald-400' : 
                            tx.type === 'Borrow' ? 'bg-blue-500/20 text-blue-400' : 
                            tx.type === 'Repay' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-500/20 text-gray-300'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-4 font-mono text-xs text-gray-400">
                          {activeAddress ? `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}` : 'N/A'}
                        </td>
                        <td className="py-4 text-xs text-gray-400">
                          FortiFi Contract
                        </td>
                        <td className="py-4 text-gray-300 font-bold">
                          {tx.type === 'Supply' || tx.type === 'Withdraw' ? 'LAR' : 'DAI'}
                        </td>
                        <td className="py-4 text-right font-mono font-bold text-white">
                          {tx.amount ? tx.amount.toFixed(4) : '0.0000'}
                        </td>
                        <td className="py-4 text-center">
                          <a 
                            href={`https://etherscan.io/tx/${tx.txHash}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-xs text-blue-400 font-mono hover:underline">
                            {tx.txHash ? `${tx.txHash.slice(0, 6)}...${tx.txHash.slice(-4)}` : 'N/A'}
                          </a>
                        </td>
                        <td className="py-4 text-center text-xs text-gray-500 font-mono">
                          {tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString() : 'N/A'}
                        </td>
                        <td className="py-4 text-right text-emerald-400 font-bold text-xs pr-2">
                          Confirmed
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500">
                        {isLoading ? 'Syncing cockpit logs from MongoDB...' : 'No telemetry transactions registered for this account.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Telemetry Footer */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/85 backdrop-blur-2xl border-t border-white/10 px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-4 transition duration-300 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              <div>
                <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-widest">Active Financial Identity</span>
                <span className="font-mono text-[11px] text-white font-bold tracking-tight select-all">{activeAddress}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 md:gap-10">
              <div>
                <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Live Collateral</span>
                <span className="text-emerald-400 font-mono font-bold text-xs">${tvl.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Live Debt</span>
                <span className="text-red-400 font-mono font-bold text-xs">${borrowed.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Current Risk</span>
                <span className="text-amber-400 font-mono font-bold text-xs">{currentRisk}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Identity Score</span>
                <span className="text-blue-400 font-mono font-bold text-xs">100</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Risk Assessment</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${parseFloat(solvency) < 120 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {parseFloat(solvency) < 120 ? 'High Risk' : 'Healthy'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </EnterpriseLayout>
  );
}

