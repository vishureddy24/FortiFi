import EnterpriseLayout from '../components/ui/EnterpriseLayout';
import { useAccount } from '../components/hooks/web3';
import { useWeb3 } from '../components/providers/web3';
import { useState, useEffect } from 'react';
import { Bar, Line } from 'react-chartjs-2';

export default function UserDashboard() {
  const { account } = useAccount();
  const [stats, setStats] = useState({
    supplied: 12500,
    borrowed: 4200,
    healthFactor: 2.8,
    riskScore: 1.4
  });

  return (
    <EnterpriseLayout title="Dashboard">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
            Welcome back, <span className="text-blue-500">{account.data?.slice(0, 6)}...</span>
          </h1>
          <p className="text-gray-400 mt-2">Your autonomous security engine is protecting your assets.</p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest block">Security Status</span>
            <span className="text-sm font-bold text-emerald-500">AUTONOMOUS PROTECTION ON</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Total Supplied', value: `$${stats.supplied.toLocaleString()}`, color: 'text-white' },
          { label: 'Total Borrowed', value: `$${stats.borrowed.toLocaleString()}`, color: 'text-gray-400' },
          { label: 'Health Factor', value: stats.healthFactor, color: 'text-emerald-400' },
          { label: 'Risk Rating', value: 'LOW', color: 'text-blue-400' }
        ].map((item, i) => (
          <div key={i} className="bg-gray-900/40 border border-white/5 p-6 rounded-3xl backdrop-blur-xl">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">{item.label}</p>
            <h3 className={`text-3xl font-black ${item.color}`}>{item.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Market Overview */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold">Portfolio Performance</h3>
                <div className="flex gap-2">
                   <button className="bg-white/5 px-3 py-1 rounded-lg text-xs font-bold">1W</button>
                   <button className="bg-blue-600 px-3 py-1 rounded-lg text-xs font-bold">1M</button>
                </div>
             </div>
             <div className="h-64 flex items-end gap-1">
                {Array.from({length: 20}).map((_, i) => (
                  <div 
                    key={i} 
                    style={{ height: `${Math.random() * 80 + 20}%` }} 
                    className="flex-1 bg-gradient-to-t from-blue-600/20 to-blue-500/60 rounded-t-lg hover:to-blue-400 transition-all cursor-pointer"
                  ></div>
                ))}
             </div>
          </div>

          <div className="bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl">
             <h3 className="text-xl font-bold mb-6">Active Positions</h3>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead>
                      <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/5">
                         <th className="pb-4">Asset</th>
                         <th className="pb-4">Balance</th>
                         <th className="pb-4">APY</th>
                         <th className="pb-4">Collateral</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                      {[
                        { asset: 'DAI', balance: '5,000.00', apy: '4.2%', collateral: 'YES' },
                        { asset: 'WETH', balance: '2.45', apy: '1.8%', collateral: 'YES' }
                      ].map((pos, i) => (
                        <tr key={i} className="group">
                           <td className="py-4 font-bold">{pos.asset}</td>
                           <td className="py-4 font-mono">{pos.balance}</td>
                           <td className="py-4 text-emerald-400 font-bold">{pos.apy}</td>
                           <td className="py-4">
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full font-bold">ACTIVE</span>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </div>

        {/* Right: Security Center Quick View */}
        <div className="lg:col-span-4 space-y-8">
           <div className="bg-blue-600 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-500/20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full -mr-10 -mt-10 blur-2xl"></div>
              <h3 className="text-2xl font-black mb-2">FortiFi Pro</h3>
              <p className="text-blue-100 text-sm mb-6">Upgrade to Enterprise for advanced whale tracking and institutional analytics.</p>
              <button className="bg-white text-blue-600 font-black py-3 px-6 rounded-2xl hover:bg-gray-100 transition-all text-sm uppercase tracking-widest shadow-xl">Upgrade Now</button>
           </div>

           <div className="bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                 <span className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></span>
                 Security Feed
              </h3>
              <div className="space-y-6">
                 {[
                   { type: 'SHIELD', msg: 'Whale monitor: No high-slippage threats.', time: '2m' },
                   { type: 'INFO', msg: 'System integrity verified successfully.', time: '14m' },
                   { type: 'CHECK', msg: 'LTV ratios optimized for current market.', time: '1h' }
                 ].map((log, i) => (
                   <div key={i} className="flex gap-4 items-start">
                      <div className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-[10px] font-bold text-gray-500">{log.time}</div>
                      <p className="text-xs text-gray-400 font-medium leading-relaxed">{log.msg}</p>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </EnterpriseLayout>
  );
}
