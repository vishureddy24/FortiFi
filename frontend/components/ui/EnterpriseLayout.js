import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAccount, useNetwork } from '../../components/hooks/web3';
import { useSocket } from '../hooks/useSocket';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function EnterpriseLayout({ children, title }) {
  const router = useRouter();
  const { account } = useAccount();
  const { network } = useNetwork();
  const { alerts } = useSocket();
  
  const [globalScore, setGlobalScore] = useState(1.4);
  const [latestAlert, setLatestAlert] = useState(null);

  // Sync Global Risk Score from backend
  useEffect(() => {
    const fetchGlobalState = async () => {
      try {
        const response = await axios.get('http://localhost:5001/api/v1/risk-stats').catch(() => ({ data: { globalRiskScore: 1.4 }}));
        setGlobalScore(response.data.globalRiskScore || 1.4);
      } catch (e) {
        console.error(e);
      }
    };
    fetchGlobalState();
    
    // Poll for global score updates every 10s
    const interval = setInterval(fetchGlobalState, 10000);
    return () => clearInterval(interval);
  }, []);

  // Listen to new socket alerts for premium toast notifications
  useEffect(() => {
    if (alerts && alerts.length > 0) {
      setLatestAlert(alerts[0]);
      const timer = setTimeout(() => setLatestAlert(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [alerts]);

  const navItems = [
    { name: 'Dashboard', href: '/', icon: '📊' },
    { name: 'Portfolio', href: '/portfolio', icon: '💼' },
    { name: 'Telemetry', href: '/enterprise', icon: '🏢' },
    { name: 'Exploit Lab', href: '/simulator', icon: '⚡' },
    { name: 'Shield Center', href: '/security', icon: '🛡️' },
    { name: 'SaaS Engine', href: '/saas', icon: '🔌' },
    { name: 'Governance', href: '/governance', icon: '🏛️' }
  ];

  // Dynamic colors for risk severity
  const isHealthy = globalScore <= 4.0;
  const isWarning = globalScore > 4.0 && globalScore <= 7.0;
  const statusColor = isHealthy ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : isWarning ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' : 'text-red-400 border-red-500/20 bg-red-500/5';
  const statusGlow = isHealthy ? 'shadow-emerald-500/10' : isWarning ? 'shadow-amber-500/10' : 'shadow-red-500/10';

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white selection:bg-blue-500/30 font-sans flex overflow-hidden">
      <Head>
        <title>{title} | FortiFi Risk Engine</title>
      </Head>

      {/* Futuristic Left Sidebar */}
      <aside className="w-64 bg-[#0E131A]/90 border-r border-white/5 flex flex-col justify-between backdrop-blur-xl shrink-0 z-30">
        <div>
          {/* Brand header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <Link href="/">
              <a className="flex items-center gap-3">
                <span className="text-2xl">🛡️</span>
                <span className="font-black text-lg tracking-wider bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">FORTIFI</span>
              </a>
            </Link>
            <span className="text-[9px] bg-blue-500/10 text-blue-400 font-extrabold px-2 py-0.5 rounded-full border border-blue-500/20 tracking-wider">v2.0</span>
          </div>

          {/* Navigation Menu */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const isActive = router.pathname === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <a className={`flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold tracking-wide transition-all duration-300 ${
                    isActive 
                      ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                      : 'border border-transparent text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-base">{item.icon}</span>
                      <span>{item.name}</span>
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_8px_#3b82f6]"></div>}
                  </a>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User wallet panel at sidebar bottom */}
        <div className="p-4 border-t border-white/5 bg-[#0A0B14]/40">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center font-bold text-xs">
              {account.data ? account.data.slice(2, 4).toUpperCase() : 'FF'}
            </div>
            <div className="overflow-hidden">
              <span className="text-[10px] text-gray-500 font-bold block uppercase tracking-wider">Active Wallet</span>
              <span className="text-xs font-mono font-bold text-gray-300 block truncate">
                {account.data ? `${account.data.slice(0, 6)}...${account.data.slice(-4)}` : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative custom-scrollbar">
        {/* Top Active Telemetry HUD Banner */}
        <header className="h-20 border-b border-white/5 bg-[#0B0F14]/75 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live Telemetry active</span>
            </div>
            
            <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg ${statusColor} ${statusGlow}`}>
               <span>System:</span>
               <span>{isHealthy ? 'Stable' : isWarning ? 'Stress Alert' : 'Critical Hazard'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-4 py-1.5 bg-white/5 rounded-xl border border-white/5 text-xs text-gray-400 font-bold uppercase tracking-widest">
               Net: <span className="text-white font-mono">{network.data || 'Ganache'}</span>
            </div>
          </div>
        </header>

        {/* Client View Panel */}
        <main className="p-8 pb-20 max-w-7xl w-full mx-auto flex-1">
          {children}
        </main>

        {/* Premium Socket.io Toast Notification HUD */}
        {latestAlert && (
          <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-[#121820]/95 border-l-4 border-red-500 shadow-2xl rounded-2xl p-4 backdrop-blur-xl animate-bounce">
             <div className="flex gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                   <p className="text-xs font-black uppercase text-red-400 tracking-wider mb-1">Threat Blocked Successfully</p>
                   <p className="text-sm font-semibold text-white leading-snug">{latestAlert.message}</p>
                   <span className="text-[9px] font-mono text-gray-500 block mt-2">{new Date(latestAlert.createdAt).toLocaleTimeString()}</span>
                </div>
             </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        body {
          background-color: #0B0F14;
          background-image: radial-gradient(circle at 80% 20%, #1e1b4b08 0%, #0B0F14 100%);
          color: #ffffff;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        /* Ultimate Institutional Dark Theme Skin Overrides */
        .bg-white {
          background-color: rgba(14, 19, 26, 0.6) !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          backdrop-filter: blur(20px);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3) !important;
          border-radius: 24px !important;
          color: #ffffff !important;
        }
        .bg-gray-100 {
          background-color: #0B0F14 !important;
        }
        .bg-gray-700 {
          background-color: rgba(14, 19, 26, 0.7) !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          border-radius: 24px !important;
        }
        .bg-blueGray-50 {
          background-color: rgba(255, 255, 255, 0.02) !important;
        }
        .text-gray-800, .text-gray-900, .text-blueGray-600, .text-blueGray-700, .text-slate-800 {
          color: #f3f4f6 !important;
        }
        .text-gray-600, .text-gray-500, .text-blueGray-500, .text-blueGray-400, .text-slate-500 {
          color: #9ca3af !important;
        }
        .border-blueGray-100, .border-gray-300, .border-gray-200 {
          border-color: rgba(255, 255, 255, 0.05) !important;
        }
        /* Buttons */
        .bg-gray-700.text-white {
          background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          font-size: 11px !important;
          border-radius: 12px !important;
          border: none !important;
          transition: all 0.3s ease !important;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2) !important;
        }
        .bg-gray-700.text-white:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4) !important;
        }
        .border-gray-400 {
          border-color: rgba(255, 255, 255, 0.1) !important;
          background-color: rgba(255, 255, 255, 0.03) !important;
          color: #e5e7eb !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          font-size: 11px !important;
          border-radius: 12px !important;
          transition: all 0.3s ease !important;
        }
        .border-gray-400:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: #ffffff !important;
        }
        /* Header Banner overrides */
        .bg-gray-700.md\\:pt-32 {
          background: transparent !important;
          border: none !important;
          padding-top: 2rem !important;
          padding-bottom: 2rem !important;
        }
        /* Modals style integration */
        .rounded-lg.shadow {
          background-color: #0E131A !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5) !important;
        }
      `}</style>
    </div>
  );
}
