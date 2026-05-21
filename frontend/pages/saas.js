import Head from 'next/head';
import EnterpriseLayout from '../components/ui/EnterpriseLayout';
import { useAccount } from '../components/hooks/web3';
import { useState } from 'react';

export default function SaasPlatform() {
  const { account } = useAccount();
  const [apiKey, setApiKey] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateKey = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5001/api/v1/saas/generate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: account.data })
      });
      const data = await res.json();
      setApiKey(data.apiKey);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <EnterpriseLayout title="SaaS API Engine">
      <div>
        <div className="text-center mb-16">
          <h1 className="text-5xl font-black text-gray-900 mb-6 tracking-tight">
            The Security Layer for <span className="text-blue-600">Web3 Finance.</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Integrate institutional-grade risk intelligence into your DeFi protocol with a single line of code.
          </p>
        </div>

        {/* API Key Generation */}
        <div className="bg-white rounded-3xl shadow-2xl p-10 border border-gray-100 mb-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10"></div>
          <h2 className="text-2xl font-bold mb-4">Developer Portal</h2>
          <p className="text-gray-500 mb-8">Generate a sandbox API key to start building with the FortiFi Risk Engine.</p>
          
          {apiKey ? (
            <div className="bg-slate-900 rounded-xl p-6 mb-6 font-mono text-blue-400 flex justify-between items-center group">
              <span className="truncate">{apiKey}</span>
              <button onClick={() => navigator.clipboard.writeText(apiKey)} className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded hover:bg-slate-700 transition-all">Copy Key</button>
            </div>
          ) : (
            <button 
              onClick={generateKey}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg shadow-blue-200"
            >
              {loading ? 'Provisioning...' : 'Generate Sandbox Key'}
            </button>
          )}
          <p className="text-xs text-gray-400 mt-4 italic">Free tier: 10,000 requests/month included.</p>
        </div>

        {/* API Docs Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          <div>
            <h3 className="text-3xl font-extrabold text-gray-900 mb-6">Built for Developers</h3>
            <div className="space-y-6">
              {[
                { title: 'Risk Scoring', desc: 'Predictive analytics for wallet reputation and behavior.', icon: '📊' },
                { title: 'Threat Monitoring', desc: 'Real-time alerts for oracle attacks and flash loans.', icon: '🛡️' },
                { title: 'Institutional Compliance', desc: 'KYT (Know Your Transaction) ready data feeds.', icon: '⚖️' }
              ].map((feature, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">{feature.icon}</div>
                  <div>
                    <h4 className="font-bold text-gray-900">{feature.title}</h4>
                    <p className="text-gray-600">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl">
            <div className="flex gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            </div>
            <pre className="text-emerald-400 font-mono text-sm overflow-x-auto">
{`// Fetch Wallet Risk Score
const response = await fetch('https://api.fortifi.sh/v1/risk-score/0x...', {
  headers: {
    'x-api-key': 'YOUR_KEY_HERE'
  }
});

const { riskScore } = await response.json();

if (riskScore > 0.8) {
  restrictAction(); // Protect your protocol
}`}
            </pre>
          </div>
        </div>

        {/* Pricing */}
        <div className="text-center mb-16">
          <h3 className="text-3xl font-black text-gray-900 mb-12">Monetization Tiers</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Developer', price: '$0', features: ['10k requests', 'Standard Alerts', 'Community Support'], color: 'border-gray-200' },
              { name: 'Professional', price: '$299', features: ['500k requests', 'Real-time WebSockets', 'Priority Support'], color: 'border-blue-200 ring-2 ring-blue-500' },
              { name: 'Enterprise', price: 'Custom', features: ['Unlimited requests', 'Custom ML Models', 'SLA Guarantee'], color: 'border-purple-200' }
            ].map((plan, i) => (
              <div key={i} className={`bg-white p-8 rounded-3xl border ${plan.color} shadow-xl hover:scale-105 transition-all`}>
                <h4 className="text-xl font-bold mb-2">{plan.name}</h4>
                <div className="text-4xl font-black mb-6">{plan.price}<span className="text-sm font-normal text-gray-400">/mo</span></div>
                <ul className="text-left space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="text-gray-600 flex items-center gap-2">
                      <span className="text-emerald-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button className="w-full py-3 rounded-xl font-bold border-2 border-gray-100 hover:border-blue-500 hover:text-blue-500 transition-all">Get Started</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </EnterpriseLayout>
  );
}
