import EnterpriseLayout from '../components/ui/EnterpriseLayout';
import { useAccount } from '../components/hooks/web3';
import { useWeb3 } from '../components/providers/web3';
import { useState, useEffect } from 'react';

export default function GovernancePage() {
  const { account } = useAccount();
  const [proposals, setProposals] = useState([
    { id: 1, title: 'Update WETH LTV to 85%', status: 'Active', votesFor: '1.2M', votesAgainst: '240K', endTime: '2 days left' },
    { id: 2, title: 'Integrate Polygon Chainlink Feeds', status: 'Passed', votesFor: '4.5M', votesAgainst: '12K', endTime: 'Executed' }
  ]);

  return (
    <EnterpriseLayout title="Governance">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            Decentralized <span className="text-blue-500">Governance</span>
          </h1>
          <p className="text-gray-400 mt-2">Shape the future of FortiFi autonomous security.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-2xl transition-all shadow-lg shadow-blue-500/20 uppercase tracking-widest text-sm">
          Create Proposal
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Proposals List */}
        <div className="lg:col-span-8 space-y-6">
           {proposals.map((prop) => (
             <div key={prop.id} className="bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl hover:border-white/10 transition-all group">
                <div className="flex justify-between items-start mb-4">
                   <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${prop.status === 'Active' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {prop.status}
                   </span>
                   <span className="text-xs text-gray-500 font-mono">{prop.endTime}</span>
                </div>
                <h3 className="text-2xl font-bold mb-6 text-gray-100 group-hover:text-white transition-all">{prop.title}</h3>
                
                <div className="space-y-4">
                   <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Votes For: <span className="text-white font-bold">{prop.votesFor}</span></span>
                      <span className="text-gray-400">Votes Against: <span className="text-white font-bold">{prop.votesAgainst}</span></span>
                   </div>
                   <div className="w-full bg-gray-800 rounded-full h-2 flex overflow-hidden">
                      <div className="bg-blue-500 h-full" style={{ width: '82%' }}></div>
                      <div className="bg-red-500/40 h-full" style={{ width: '18%' }}></div>
                   </div>
                </div>

                <div className="mt-8 flex gap-3">
                   <button className="flex-1 bg-white/5 hover:bg-blue-600 hover:text-white py-3 rounded-xl font-bold transition-all text-sm">VOTE FOR</button>
                   <button className="flex-1 bg-white/5 hover:bg-red-600 hover:text-white py-3 rounded-xl font-bold transition-all text-sm">VOTE AGAINST</button>
                </div>
             </div>
           ))}
        </div>

        {/* Governance Stats */}
        <div className="lg:col-span-4 space-y-8">
           <div className="bg-gray-900/40 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl">
              <h3 className="text-lg font-bold mb-6">Voting Power</h3>
              <div className="text-center py-8 border-b border-white/5 mb-6">
                 <h4 className="text-5xl font-black text-white mb-2">250K</h4>
                 <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">vLAR Tokens</p>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Delegated to</span>
                    <span className="text-white font-bold">Self</span>
                 </div>
                 <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Proposals</span>
                    <span className="text-white font-bold">42</span>
                 </div>
              </div>
           </div>

           <div className="bg-gradient-to-br from-indigo-900/40 to-blue-900/40 border border-white/10 p-8 rounded-[2rem] backdrop-blur-xl">
              <h3 className="text-lg font-bold mb-4">Timelock Status</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-6">All approved proposals are subject to a 72-hour timelock period for security verification.</p>
              <div className="bg-white/5 p-4 rounded-2xl flex items-center gap-4">
                 <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400">⏳</div>
                 <div>
                    <span className="text-[10px] text-gray-500 block uppercase">Currently Queued</span>
                    <span className="text-sm font-bold text-white">0 Proposals</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </EnterpriseLayout>
  );
}
