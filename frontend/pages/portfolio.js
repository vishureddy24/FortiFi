import Head from 'next/head';
import Navbar from '../components/ui/Navbar';
import Footer from '../components/ui/Footer';
import EnterpriseLayout from '../components/ui/EnterpriseLayout';
import { useWalletPortfolio } from '../hooks/useWalletPortfolio';
import { useWeb3 } from '../components/providers/web3';
import { useAccount, useNetwork } from '../components/hooks/web3';
import { useEffect, useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

const getRiskColorClass = (score) => {
  const s = parseFloat(score) || 0;
  if (s >= 9) return 'text-red-500 font-bold';
  if (s >= 6) return 'text-orange-500 font-bold';
  if (s >= 3) return 'text-yellow-500 font-bold';
  return 'text-emerald-400 font-bold';
};

const getRiskBadgeClass = (score) => {
  const s = parseFloat(score) || 0;
  if (s >= 9) return 'bg-red-500/20 text-red-400 border border-red-500/30';
  if (s >= 6) return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
  if (s >= 3) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
};

const getRiskStatusLabel = (score) => {
  const s = parseFloat(score) || 0;
  if (s >= 9) return 'Critical Threat';
  if (s >= 6) return 'Elevated Risk';
  if (s >= 3) return 'Moderate Risk';
  return 'Healthy Position';
};

export default function PortfolioDashboard() {
  const {
    activeAddress,
    profile,
    snapshots,
    transactions,
    alerts,
    isConnected,
    isLoading
  } = useWalletPortfolio();

  const { contract, web3 } = useWeb3();
  const { account } = useAccount();
  const { network } = useNetwork();

  const isWalletConnected = Boolean(account.data);
  const isChainConnected = network.isSupported;
  const isSocketConnected = isConnected;

  let statusText = "Disconnected";
  let statusColor = "bg-gray-500";

  if (!isWalletConnected) {
    statusText = "Disconnected";
    statusColor = "bg-gray-500";
  } else if (isWalletConnected && !isSocketConnected) {
    statusText = "Syncing";
    statusColor = "bg-yellow-500 animate-pulse";
  } else if (isWalletConnected && isSocketConnected) {
    statusText = "Live";
    statusColor = "bg-emerald-400 animate-pulse";
  }

  // Filters and Search for Transaction Explorer (Handled in-memory for speed and efficiency)
  const [timeFilter, setTimeFilter] = useState('all'); 
  const [typeFilter, setTypeFilter] = useState('all'); 
  const [highRiskFilter, setHighRiskFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Derived metrics with secure fallbacks
  const totalCollateral = profile?.suppliedCollateral || profile?.totalCollateral || 0;
  const totalDebt = profile?.outstandingDebt || profile?.totalDebt || 0;
  const healthFactor = profile?.healthFactor !== undefined ? Number(profile.healthFactor).toFixed(2) : "100.00";
  const borrowUtilization = profile?.borrowUtilization !== undefined ? Number(profile.borrowUtilization).toFixed(1) : "0.0";
  const walletRiskScore = profile?.riskScore !== undefined ? Number(profile.riskScore).toFixed(1) : "0.0";
  const trustScore = profile?.trustIdentityScore || profile?.trustScore || 100;
  const accountTier = profile?.accountTier || "Tier 1";
  const creditLimit = profile?.dynamicCreditLimit || profile?.totalBorrowLimit || 200;
  const availableBorrow = profile?.borrowCapacity || profile?.availableBorrowLimit || 200;
  const liquidationBuffer = profile?.liquidationBuffer || Math.max(0, totalCollateral - totalDebt);

  // In-Memory Filtered transactions for Explorer Search & Filters
  const filteredTransactions = transactions.filter(tx => {
    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchHash = tx.txHash && tx.txHash.toLowerCase().includes(q);
      const matchAsset = tx.asset && tx.asset.toLowerCase().includes(q);
      const matchType = tx.type && tx.type.toLowerCase().includes(q);
      if (!matchHash && !matchAsset && !matchType) return false;
    }

    // Time filter
    if (timeFilter === 'hour') {
      const txTime = new Date(tx.timestamp);
      if (Date.now() - txTime > 60 * 60 * 1000) return false;
    } else if (timeFilter === 'today') {
      const txTime = new Date(tx.timestamp);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      if (txTime < startOfToday) return false;
    }

    // Type filter
    if (typeFilter !== 'all') {
      if (tx.type !== typeFilter) return false;
    }

    // High Risk filter
    if (highRiskFilter) {
      const txRisk = tx.riskScore !== undefined ? tx.riskScore : (tx.walletRiskScore !== undefined ? tx.walletRiskScore : (tx.riskScoreSnapshot !== undefined ? tx.riskScoreSnapshot : 0));
      if (Number(txRisk) < 4) return false;
    }

    return true;
  });

  // Export to CSV Functionality
  const exportToCSV = () => {
    if (filteredTransactions.length === 0) return alert('No transaction logs to export.');
    
    const headers = ['Timestamp', 'Event Type', 'Asset', 'Amount', 'Gas Used', 'Risk Score', 'Debt After', 'Utilization', 'Tx Hash'];
    const rows = filteredTransactions.map(tx => {
      const txRisk = tx.riskScore !== undefined ? tx.riskScore : (tx.walletRiskScore !== undefined ? tx.walletRiskScore : (tx.riskScoreSnapshot !== undefined ? tx.riskScoreSnapshot : 0));
      return [
        tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'N/A',
        tx.type || 'N/A',
        tx.asset || 'DAI',
        tx.amount || '0',
        tx.gasUsed || '0',
        Number(txRisk).toFixed(1),
        tx.debtAfter !== undefined ? Number(tx.debtAfter).toFixed(2) : '0.00',
        tx.utilization !== undefined ? Number(tx.utilization).toFixed(1) + '%' : '0.0%',
        tx.txHash || 'N/A'
      ];
    });
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(",") + "\n";
    rows.forEach(row => {
      csvContent += row.join(",") + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `fortifi_explorer_export_${activeAddress}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPortfolioReport = (format) => {
    if (!activeAddress) return;
    const url = `http://localhost:5001/api/portfolio/download/${activeAddress}?format=${format}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `portfolio_report_${activeAddress}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Convert snapshots for AreaChart (retaining last 100 items from hooks)
  const chartData = snapshots.map((s, idx) => ({
    time: s.timestamp ? new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `T-${snapshots.length - idx}`,
    hf: s.healthFactor || 100,
    util: s.utilization || 0
  }));

  const displayChartData = chartData.length > 0 ? chartData : [
    { time: '10:00', hf: 100 },
    { time: '11:00', hf: 100 },
    { time: '12:00', hf: 100 }
  ];

  return (
    <EnterpriseLayout title="Institutional Portfolio Management">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            Institutional <span className="text-blue-500">Portfolio</span>
          </h1>
          <p className="text-gray-400 font-medium">Advanced position monitoring, risk modeling, and liquidation buffers.</p>
        </div>
        {activeAddress && (
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
               <button onClick={() => downloadPortfolioReport('csv')} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition">
                 Download CSV
               </button>
               <button onClick={() => downloadPortfolioReport('json')} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition">
                 Download JSON
               </button>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-3 bg-gray-900/60 border border-white/10 px-4 py-2 rounded-2xl">
              <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
              <span className="font-mono text-xs text-gray-300 select-all">
                {activeAddress.slice(0, 8)}...{activeAddress.slice(-8)}
              </span>
              <span className="text-[10px] text-gray-500 font-bold ml-1 uppercase">
                {statusText}
              </span>
            </div>
          </div>
        )}
      </div>

      {!activeAddress ? (
        <div className="flex flex-col items-center justify-center p-16 bg-gray-900/30 border border-white/5 rounded-3xl backdrop-blur-md">
          <svg className="w-16 h-16 text-gray-500 mb-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 className="text-lg font-bold text-white mb-2">Portfolio Authentication Required</h3>
          <p className="text-gray-500 text-sm">Please connect your MetaMask institutional account to load secure statistics.</p>
        </div>
      ) : (
        <>
          {/* CORE METRICS LAYER */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-900/40 border border-white/5 p-6 rounded-3xl backdrop-blur-xl hover:border-blue-500/20 transition duration-300">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Health Factor</p>
              <div className="flex items-end gap-3">
                <h3 className={`text-4xl font-black ${parseFloat(healthFactor) >= 1.5 ? 'text-emerald-400' : parseFloat(healthFactor) > 1.1 ? 'text-amber-400' : 'text-red-500'}`}>
                  {healthFactor}
                </h3>
              </div>
              <p className="text-xs text-gray-400 mt-2">Liquidation threshold is &lt; 1.00</p>
            </div>

            <div className="bg-gray-900/40 border border-white/5 p-6 rounded-3xl backdrop-blur-xl hover:border-blue-500/20 transition duration-300">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Borrow Utilization</p>
              <div className="flex items-end gap-3">
                <h3 className="text-4xl font-black text-white">{borrowUtilization}%</h3>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 mt-4 overflow-hidden">
                <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${Math.min(parseFloat(borrowUtilization), 100)}%` }}></div>
              </div>
            </div>

            <div className="bg-gray-900/40 border border-white/5 p-6 rounded-3xl backdrop-blur-xl hover:border-blue-500/20 transition duration-300">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Wallet Risk Score</p>
              <div className="flex items-end gap-3">
                <h3 className="text-4xl font-black text-white">{walletRiskScore}</h3>
                <span className="text-sm text-gray-400 mb-1">/ 10.0</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Status: <span className={getRiskColorClass(walletRiskScore)}>
                  {getRiskStatusLabel(walletRiskScore)}
                </span>
              </p>
            </div>

            <div className="bg-gradient-to-br from-indigo-950/40 to-blue-950/40 border border-blue-500/20 p-6 rounded-3xl backdrop-blur-xl">
              <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest mb-2">Trust Identity Score</p>
              <div className="flex items-end gap-3">
                <h3 className="text-4xl font-black text-white">{trustScore}</h3>
                <span className="text-xs px-2.5 py-0.5 bg-blue-500/20 border border-blue-400/30 rounded-full text-blue-300 font-bold mb-1">
                  {accountTier}
                </span>
              </div>
              <p className="text-xs text-blue-200/60 mt-2">Supplying increases identity tier limits</p>
            </div>
          </div>



          {/* DYNAMIC SNAPSHOT CHART AND POSITION LIMITS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
            <div className="lg:col-span-8 bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl">
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white">Health Factor Trajectory</h3>
                  <p className="text-xs text-gray-500">Live portfolio snapshots recorded on MongoDB</p>
                </div>
                <span className="px-3 py-1 bg-white/5 rounded-full text-xs text-gray-400 font-bold tracking-widest uppercase animate-pulse">
                  {isConnected ? 'Real-Time Connected' : 'Syncing'}
                </span>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayChartData}>
                    <defs>
                      <linearGradient id="colorHf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="time" stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} domain={[0, 110]} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="hf" name="Health Factor" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorHf)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-4 bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-6">Financial Capacity</h3>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm border-b border-white/5 pb-2">
                    <span className="text-gray-400">Supplied Collateral</span>
                    <span className="text-emerald-400 font-mono font-bold">${totalCollateral.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-white/5 pb-2">
                    <span className="text-gray-400">Total Outstanding Debt</span>
                    <span className="text-red-400 font-mono font-bold">${totalDebt.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-white/5 pb-2">
                    <span className="text-gray-400">Dynamic Credit Limit</span>
                    <span className="text-indigo-400 font-mono font-bold">${creditLimit.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-white/5 pb-2">
                    <span className="text-gray-400">Borrow Capacity</span>
                    <span className="text-blue-400 font-mono font-bold">${availableBorrow.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Liquidation Buffer</span>
                    <span className="text-white font-mono font-bold">
                      {totalDebt === 0 ? "Infinite" : `$${liquidationBuffer.toFixed(2)} USD`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                <p className="text-[10px] text-blue-300 font-bold uppercase tracking-wider mb-1">Institutional Audit Ready</p>
                <p className="text-xs text-blue-200/60 leading-relaxed">This secure environment utilizes on-chain contract events synced into MongoDB indexes for perfect financial reconciliation.</p>
              </div>
            </div>
          </div>

          {/* ASSET ALLOCATION AND RISK TIMELINE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl">
              <h3 className="text-lg font-bold text-white mb-6">Asset Allocation Balances</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-xs">
                      LAR
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">LAR Token</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Active supplied collateral</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-mono font-bold">${totalCollateral.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400 font-mono">LAR pool asset</p>
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 text-xs">
                      DAI
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">DAI Stablecoin</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Outstanding Credit Debt</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-mono font-bold">${totalDebt.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400 font-mono">Zero-collateral asset</p>
                  </div>
                </div>
              </div>
            </div>

            {/* LIVE ALERT & THREAT INTELLIGENCE STREAM */}
            <div className="bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4">Security Auditing Timeline</h3>
              <div className="flex-1 overflow-y-auto max-h-[220px] space-y-3 pr-2 scrollbar-thin">
                {alerts.length > 0 ? (
                  alerts.map((al, idx) => (
                    <div key={idx} className="p-3 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 animate-pulse"></span>
                      <div>
                        <p className="text-white font-bold text-xs">{al.title || "Alert Triggered"}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{al.message || "Threat details under review."}</p>
                        <span className="text-[9px] text-red-400 font-mono mt-1 block">
                          Severity: {al.severity || "Warning"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center py-10 text-center border border-dashed border-gray-800 rounded-2xl">
                    <svg className="w-8 h-8 text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <p className="text-xs text-gray-500 font-bold">Identity Sandbox Secure</p>
                    <p className="text-[10px] text-gray-600">Zero active exploit logs reported for this wallet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TRANSACTION EXPLORER */}
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
                  placeholder="Search hash or asset..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-950 border border-white/10 rounded-xl px-4 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition w-48"
                />

                <div className="flex bg-gray-900 border border-white/10 rounded-xl p-1">
                  <button 
                    onClick={() => setTimeFilter('all')} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${timeFilter === 'all' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                    All Time
                  </button>
                  <button 
                    onClick={() => setTimeFilter('today')} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${timeFilter === 'today' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                    Today
                  </button>
                  <button 
                    onClick={() => setTimeFilter('hour')} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${timeFilter === 'hour' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                    1 Hour
                  </button>
                </div>

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
                  onClick={() => setHighRiskFilter(prev => !prev)} 
                  className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition flex items-center gap-2 ${highRiskFilter ? 'bg-red-500/20 border-red-500 text-red-300' : 'border-white/10 text-gray-400 hover:text-white'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${highRiskFilter ? 'bg-red-500' : 'bg-gray-500'}`}></span>
                  High Risk only
                </button>

                <button 
                  onClick={exportToCSV}
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
                    <th className="py-4 px-2">Precision Timestamp</th>
                    <th className="py-4">Event Type</th>
                    <th className="py-4">Asset</th>
                    <th className="py-4 text-right">Amount</th>
                    <th className="py-4 text-center">Gas Limit</th>
                    <th className="py-4 text-center">Risk Score</th>
                    <th className="py-4 text-right pr-2">Tx Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition duration-150">
                        <td className="py-4 px-2 text-xs text-gray-400 font-mono">
                          {tx.timestamp ? new Date(tx.timestamp).toLocaleString(undefined, { fractionDigits: 3 }) : 'N/A'}
                        </td>
                        <td className="py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            tx.type === 'Supply' ? 'bg-emerald-500/20 text-emerald-400' : 
                            tx.type === 'Borrow' ? 'bg-blue-500/20 text-blue-400' : 
                            tx.type === 'Repay' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-500/20 text-gray-300'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-4 text-gray-300 font-bold">{tx.asset || 'DAI'}</td>
                        <td className="py-4 text-right font-mono font-bold text-white">
                          {tx.amount ? tx.amount.toFixed(4) : '0.0000'}
                        </td>
                        <td className="py-4 text-center font-mono text-xs text-gray-400">
                          {tx.gasUsed ? tx.gasUsed.toLocaleString() : '0'}
                        </td>
                        <td className="py-4 text-center">
                          {(() => {
                            const txRisk = tx.riskScore !== undefined ? tx.riskScore : (tx.walletRiskScore !== undefined ? tx.walletRiskScore : (tx.riskScoreSnapshot !== undefined ? tx.riskScoreSnapshot : 0));
                            return (
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getRiskBadgeClass(txRisk)}`}>
                                {Number(txRisk).toFixed(1)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-4 text-right pr-2">
                          <a 
                            href={`https://etherscan.io/tx/${tx.txHash}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-xs text-blue-400 font-mono hover:underline">
                            {tx.txHash ? `${tx.txHash.slice(0, 6)}...${tx.txHash.slice(-4)}` : 'N/A'}
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-500">
                        {isLoading ? 'Fetching transaction logs from MongoDB...' : 'No historical transactions match selected filters for this wallet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* LIVE OVERLAY TELEMETRY FOOTER PANEL */}
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
                <span className="text-emerald-400 font-mono font-bold text-xs">${totalCollateral.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Live Debt</span>
                <span className="text-red-400 font-mono font-bold text-xs">${totalDebt.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Current Risk</span>
                <span className={`font-mono font-bold text-xs ${getRiskColorClass(walletRiskScore)}`}>{walletRiskScore}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Identity Score</span>
                <span className="text-blue-400 font-mono font-bold text-xs">{trustScore}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 block uppercase font-semibold tracking-wider">Risk Assessment</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${getRiskBadgeClass(walletRiskScore)}`}>
                  {getRiskStatusLabel(walletRiskScore)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </EnterpriseLayout>
  );
}

