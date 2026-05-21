import EnterpriseLayout from '../components/ui/EnterpriseLayout';
import { useAccount } from '../components/hooks/web3';
import { useWeb3 } from '../components/providers/web3';
import { useState } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function AttackSimulator() {
  const { account } = useAccount();
  const [running, setRunning] = useState(false);
  const [activeSim, setActiveSim] = useState(null);
  const [report, setReport] = useState(null);
  const [simHistory, setSimHistory] = useState([
    { step: 'Initialize virtual state for testnet environment...', time: '0s' }
  ]);

  const runSimulation = async (type) => {
    setRunning(true);
    setActiveSim(type);
    setReport(null);
    setSimHistory([
      { step: 'Initializing sandboxed execution frame...', time: '0.0s' },
      { step: 'Synthesizing multi-hop exploit payload...', time: '0.4s' }
    ]);

    // Simulate logs output
    setTimeout(() => {
      setSimHistory(prev => [...prev, { step: 'Bypassing local oracle validations...', time: '0.8s' }]);
    }, 500);
    setTimeout(() => {
      setSimHistory(prev => [...prev, { step: 'Injecting high-slippage arbitrage transactions...', time: '1.2s' }]);
    }, 1000);
    setTimeout(() => {
      setSimHistory(prev => [...prev, { step: 'Shield heuristics matching signature. Isolating...', time: '1.6s' }]);
    }, 1500);

    try {
      const res = await axios.post('http://localhost:5001/api/simulations/run', {
        type: type,
        userAddress: account.data || '0x45C78269C19E93f978e8364cA05562E556403C62'
      });
      
      setTimeout(() => {
        setReport(res.data);
        setSimHistory(prev => [...prev, { step: 'Threat blocked. Simulation logs published.', time: '2.0s' }]);
        setRunning(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      setRunning(false);
    }
  };

  const simulationCards = [
    { id: 'FLASH_LOAN', title: 'Flash Loan Attack', desc: 'Simulate instant high-leverage lending to manipulate and drain protocol liquidity.', icon: '⚡', severity: 'CRITICAL', color: 'border-red-500/20' },
    { id: 'ORACLE_MANIPULATION', title: 'Oracle Price Manipulation', desc: 'Tamper with asset spot price feeds to trigger artificial liquidation cascades.', icon: '🔮', severity: 'CRITICAL', color: 'border-red-500/20' },
    { id: 'SYBIL', title: 'Sybil Account Exploitation', desc: 'Spawn synchronized mock puppets to sweep protocol borrows simultaneously.', icon: '👥', severity: 'HIGH', color: 'border-amber-500/20' },
    { id: 'VELOCITY', title: 'Velocity Rate Abuse', desc: 'Force rapid micro-repayment cycles to identify smart contract interest leakage.', icon: '🌪️', severity: 'MEDIUM', color: 'border-blue-500/20' }
  ];

  // Mock charts to display telemetry disruption under stress testing
  const stressData = [
    { time: '0s', load: 10, threats: 0 },
    { time: '2s', load: running ? 85 : 12, threats: running ? 1 : 0 },
    { time: '4s', load: running ? 95 : 14, threats: running ? 3 : 0 },
    { time: '6s', load: 12, threats: 0 },
  ];

  return (
    <EnterpriseLayout title="Threat Simulator Lab">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
          Sandboxed <span className="text-red-500">Threat Simulator</span>
        </h1>
        <p className="text-gray-400">Execute secure exploit scenarios to validate real-time protocol firewall defenses.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Simulation Options */}
        <div className="lg:col-span-5 space-y-6">
          {simulationCards.map((sim) => (
            <div 
              key={sim.id} 
              className={`bg-gray-900/40 border ${sim.color} p-6 rounded-3xl backdrop-blur-xl hover:bg-white/[0.02] transition-all group`}
            >
              <div className="flex gap-4 mb-4 items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-xl">{sim.icon}</div>
                  <div>
                    <h4 className="font-bold text-white text-sm group-hover:text-red-400 transition-all">{sim.title}</h4>
                    <span className={`text-[9px] font-black tracking-wider block mt-1 uppercase ${
                      sim.severity === 'CRITICAL' ? 'text-red-400' : sim.severity === 'HIGH' ? 'text-amber-400' : 'text-blue-400'
                    }`}>
                      Severity: {sim.severity}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">{sim.desc}</p>
              
              <button
                onClick={() => runSimulation(sim.id)}
                disabled={running}
                className="w-full bg-white/5 border border-white/5 hover:bg-red-600 hover:border-transparent hover:text-white py-3 rounded-xl font-bold transition-all text-xs uppercase tracking-widest disabled:opacity-50"
              >
                {running && activeSim === sim.id ? 'EXECUTING EXPLOIT...' : 'LAUNCH SIMULATION'}
              </button>
            </div>
          ))}
        </div>

        {/* Right Side: Cyberwar Intelligence Terminal */}
        <div className="lg:col-span-7 space-y-8">
          {/* Output Terminal Console */}
          <div className="bg-[#05070A] border border-white/5 rounded-[2rem] h-[380px] flex flex-col overflow-hidden backdrop-blur-3xl shadow-2xl">
            <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${running ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`}></span>
                Virtual Firewall Defense Logs
              </h3>
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/30"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/30"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/30"></span>
              </div>
            </div>
            
            <div className="flex-1 p-6 font-mono text-xs overflow-y-auto custom-scrollbar space-y-3 bg-[#030406]">
              {simHistory.map((h, i) => (
                <div key={i} className="flex justify-between items-start gap-4">
                  <span className="text-gray-500 shrink-0 select-none">[{h.time}]</span>
                  <p className="text-gray-300 flex-1 leading-relaxed">{h.step}</p>
                </div>
              ))}

              {report && (
                <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                    <p className="text-emerald-400 font-bold mb-1">🛡️ SYSTEM MITIGATION SUCCESSFUL</p>
                    <p className="text-gray-400 text-[11px] leading-relaxed">{report.message}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-center">
                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Risk delta</span>
                      <span className="text-sm font-black text-red-400">+{report.scoreChange || 2.5}</span>
                    </div>
                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-center">
                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Mitigation state</span>
                      <span className="text-sm font-black text-emerald-400">PAUSED / ISOLATED</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stress Metric Telemetry chart */}
          <div className="bg-gray-900/40 border border-white/5 p-6 rounded-[2rem] backdrop-blur-xl">
            <h3 className="text-sm font-bold text-white mb-4">Sandboxed CPU & Oracle Threat Velocity</h3>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="time" stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff30" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="load" stroke="#ef4444" strokeWidth={2} fill="rgba(239, 68, 68, 0.05)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </EnterpriseLayout>
  );
}
