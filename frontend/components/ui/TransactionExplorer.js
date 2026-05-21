import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function TransactionExplorer() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await axios.get('http://localhost:5001/api/transactions');
        setTransactions(response.data);
      } catch (err) {
        console.error('Failed to fetch transactions', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 5000); // Polling every 5s
    return () => clearInterval(interval);
  }, []);

  const formatAddress = (addr) => {
    if (!addr || addr === 'Unknown') return 'Unknown';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const formatHash = (hash) => {
    if (!hash) return 'N/A';
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
  };

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-3xl overflow-hidden mt-8">
      <div className="px-8 py-6 border-b border-slate-700 flex justify-between items-center">
        <h3 className="text-xl font-bold text-white">Transaction Explorer</h3>
        <button className="text-blue-400 text-sm hover:underline font-medium">Export CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-700/50 bg-slate-800/50">
              <th className="px-8 py-4 text-xs font-semibold text-slate-400 uppercase">Action</th>
              <th className="px-8 py-4 text-xs font-semibold text-slate-400 uppercase">From</th>
              <th className="px-8 py-4 text-xs font-semibold text-slate-400 uppercase">To</th>
              <th className="px-8 py-4 text-xs font-semibold text-slate-400 uppercase">Asset</th>
              <th className="px-8 py-4 text-xs font-semibold text-slate-400 uppercase">Amount</th>
              <th className="px-8 py-4 text-xs font-semibold text-slate-400 uppercase">Tx Hash</th>
              <th className="px-8 py-4 text-xs font-semibold text-slate-400 uppercase">Time</th>
              <th className="px-8 py-4 text-xs font-semibold text-slate-400 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {loading ? (
              <tr>
                <td colSpan="8" className="px-8 py-10 text-center text-slate-500">
                  Loading telemetry...
                </td>
              </tr>
            ) : transactions.length > 0 ? (
              transactions.map((tx, i) => (
                <tr key={tx._id || i} className="hover:bg-slate-700/20 transition-all">
                  <td className="px-8 py-4 text-sm font-bold">
                    <span className={`px-2 py-1 rounded text-[10px] uppercase border ${
                      tx.actionType === 'Supply' || tx.actionType === 'Deposit' ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5' :
                      tx.actionType === 'Borrow' ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' :
                      tx.actionType === 'Repay' ? 'text-purple-400 border-purple-400/20 bg-purple-400/5' :
                      'text-amber-400 border-amber-400/20 bg-amber-400/5'
                    }`}>
                      {tx.actionType || tx.type}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-sm text-slate-300 font-mono">{formatAddress(tx.fromAddress || tx.user)}</td>
                  <td className="px-8 py-4 text-sm text-slate-300 font-mono">{formatAddress(tx.toAddress)}</td>
                  <td className="px-8 py-4 text-sm text-slate-300">{tx.tokenSymbol || 'TBD'}</td>
                  <td className="px-8 py-4 text-sm font-semibold text-white">{parseFloat(tx.amount).toFixed(4)}</td>
                  <td className="px-8 py-4 text-sm text-blue-400 hover:text-blue-300 font-mono cursor-pointer">
                    <a href={`https://kovan.etherscan.io/tx/${tx.txHash || tx.hash}`} target="_blank" rel="noreferrer">
                      {formatHash(tx.txHash || tx.hash)}
                    </a>
                  </td>
                  <td className="px-8 py-4 text-sm text-slate-500 font-mono">
                    {new Date(tx.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-8 py-4 text-sm text-emerald-400 font-bold">{tx.status || 'Confirmed'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="px-8 py-10 text-center text-slate-500">
                  No transactions found on network.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
