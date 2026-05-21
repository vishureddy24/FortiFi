import EnterpriseLayout from '../components/ui/EnterpriseLayout';
import { useAccount } from '../components/hooks/web3';
import { useWeb3 } from '../components/providers/web3';
import { useState } from 'react';

export default function AdminConsole() {
  const { account } = useAccount();
  const { contract } = useWeb3();
  const [blacklistAddress, setBlacklistAddress] = useState('');

  const toggleEmergency = async (active) => {
    try {
      // Assuming RiskController address is stored or fetched
      alert(`Toggling Emergency Mode: ${active}`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <EnterpriseLayout title="Admin Console">
      <div className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
          Admin <span className="text-emerald-500">Console</span>
        </h1>
        <p className="text-gray-400">Manage protocol-wide security parameters and institutional overrides.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Global Controls */}
        <div className="bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl">
           <h3 className="text-lg font-bold mb-6">Global Circuit Breaker</h3>
           <div className="space-y-4">
              <button 
                onClick={() => toggleEmergency(true)}
                className="w-full bg-red-600/10 border border-red-500/20 text-red-500 py-4 rounded-2xl font-bold hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest text-xs"
              >
                Activate Emergency Pause
              </button>
              <button 
                onClick={() => toggleEmergency(false)}
                className="w-full bg-emerald-600/10 border border-emerald-500/20 text-emerald-500 py-4 rounded-2xl font-bold hover:bg-emerald-600 hover:text-white transition-all uppercase tracking-widest text-xs"
              >
                Disable Emergency Pause
              </button>
           </div>
        </div>

        {/* Blacklist Management */}
        <div className="bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl lg:col-span-2">
           <h3 className="text-lg font-bold mb-6">Wallet Isolation (Blacklist)</h3>
           <div className="flex gap-4">
              <input 
                type="text" 
                placeholder="0x... address"
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all"
                value={blacklistAddress}
                onChange={(e) => setBlacklistAddress(e.target.value)}
              />
              <button className="bg-blue-600 px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all">BLACKLIST</button>
              <button className="bg-white/5 px-6 py-3 rounded-xl font-bold text-sm hover:bg-white/10 transition-all">REMOVE</button>
           </div>
           <p className="text-[10px] text-gray-500 mt-4 italic font-bold uppercase tracking-wider">Warning: Blacklisted wallets are restricted from all protocol interactions.</p>
        </div>
      </div>

      {/* API Usage & Analytics (Placeholder) */}
      <div className="bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl">
         <h3 className="text-xl font-bold mb-8">SaaS Usage Analytics</h3>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Active API Keys', value: '1,420' },
              { label: 'Total API Requests', value: '12.4M' },
              { label: 'Enterprise Clients', value: '42' },
              { label: 'Monthly Revenue', value: '$240K' }
            ].map((stat, i) => (
              <div key={i} className="bg-white/5 p-6 rounded-2xl">
                 <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                 <h4 className="text-2xl font-black text-white">{stat.value}</h4>
              </div>
            ))}
         </div>
      </div>
    </EnterpriseLayout>
  );
}
