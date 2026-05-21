import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

export function useRealtimePortfolio(walletAddress) {
  const [profile, setProfile] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Cache snapshots up to 100 items
  const snapshotsCache = useRef([]);

  useEffect(() => {
    if (!walletAddress) {
      setProfile(null);
      setSnapshots([]);
      setTransactions([]);
      setAlerts([]);
      setIsLoading(false);
      return;
    }

    const address = walletAddress.toLowerCase();
    setIsLoading(true);

    const fetchInitialData = async () => {
      try {
        const [portfolioRes, historyRes, txRes, alertsRes] = await Promise.all([
          fetch(`http://localhost:5001/api/portfolio/${address}`).then(res => res.json()),
          fetch(`http://localhost:5001/api/portfolio/history/${address}`).then(res => res.json()),
          fetch(`http://localhost:5001/api/portfolio/transactions/${address}`).then(res => res.json()),
          fetch(`http://localhost:5001/api/alerts/live/${address}`).then(res => res.json()).catch(() => [])
        ]);

        if (portfolioRes) {
          setProfile(portfolioRes.profile || portfolioRes);
        }
        if (historyRes) {
          const formattedHistory = Array.isArray(historyRes) ? historyRes : [];
          // Keep chronological order for charts
          const sortedHistory = [...formattedHistory].reverse();
          snapshotsCache.current = sortedHistory.slice(-100);
          setSnapshots(snapshotsCache.current);
        }
        if (txRes) {
          setTransactions(Array.isArray(txRes) ? txRes.slice(0, 100) : []);
        }
        if (alertsRes) {
          setAlerts(Array.isArray(alertsRes) ? alertsRes : []);
        }
      } catch (err) {
        console.error('[useRealtimePortfolio] Error fetching initial data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();

    // Setup Socket connection
    const socket = io('http://localhost:5001', {
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[useRealtimePortfolio] Connected. Joining portfolio room:', address);
      socket.emit('join_portfolio', address);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[useRealtimePortfolio] Disconnected from server');
    });

    // Handle real-time updates
    socket.on('portfolioUpdate', (data) => {
      const dataWallet = data.wallet || data.walletAddress;
      if (dataWallet && dataWallet.toLowerCase() === address) {
        console.log('[useRealtimePortfolio] Real-time portfolio update:', data);
        setProfile(data.profile);
        
        if (data.snapshot) {
          const updated = [...snapshotsCache.current, data.snapshot];
          if (updated.length > 100) updated.shift();
          snapshotsCache.current = updated;
          setSnapshots(updated);
        }
      }
    });

    socket.on('portfolio:update', (data) => {
      const dataWallet = data.wallet || data.walletAddress;
      if (dataWallet && dataWallet.toLowerCase() === address) {
        console.log('[useRealtimePortfolio] Real-time portfolio:update:', data);
        setProfile(data.profile);
        
        if (data.snapshot) {
          const updated = [...snapshotsCache.current, data.snapshot];
          if (updated.length > 100) updated.shift();
          snapshotsCache.current = updated;
          setSnapshots(updated);
        }
      }
    });

    socket.on('risk:update', (data) => {
      if (data.wallet && data.wallet.toLowerCase() === address) {
        console.log('[useRealtimePortfolio] Real-time risk:update:', data);
        setProfile(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            riskScore: data.score,
            walletRiskScore: data.score,
            totalDebt: data.debt,
            borrowedOutstanding: data.debt,
            totalCollateral: data.collateral,
            borrowUtilization: data.utilization
          };
        });
      }
    });

    socket.on('transactionUpdate', (tx) => {
      if (tx.wallet.toLowerCase() === address) {
        console.log('[useRealtimePortfolio] Real-time transaction update:', tx);
        setTransactions(prev => {
          const exists = prev.some(t => t.txHash === tx.txHash && t.type === tx.type);
          if (exists) return prev;
          return [tx, ...prev].slice(0, 100);
        });
      }
    });

    socket.on('transactionHistoryUpdate', (data) => {
      if (data.walletAddress && data.walletAddress.toLowerCase() === address) {
        console.log('[useRealtimePortfolio] Real-time transaction history update:', data);
        const tx = {
          txHash: data.transaction.txHash,
          type: data.transaction.eventType,
          asset: data.transaction.token,
          amount: data.transaction.amount,
          gasUsed: data.transaction.gasUsed,
          timestamp: data.transaction.timestamp,
          riskScore: data.transaction.riskScoreSnapshot,
          utilization: data.transaction.utilization || 0,
          debtAfter: data.transaction.debtAfter || 0
        };
        setTransactions(prev => {
          const exists = prev.some(t => t.txHash === tx.txHash && t.type === tx.type);
          if (exists) return prev;
          return [tx, ...prev].slice(0, 100);
        });
      }
    });

    socket.on('alertUpdate', (alert) => {
      if (alert.wallet.toLowerCase() === address) {
        console.log('[useRealtimePortfolio] Real-time alert update:', alert);
        setAlerts(prev => [alert, ...prev]);
      }
    });

    return () => {
      socket.emit('leave_portfolio', address);
      socket.disconnect();
    };
  }, [walletAddress]);

  const triggerOptimisticUpdate = (type, data) => {
    if (type === 'transaction') {
      setTransactions(prev => [data, ...prev].slice(0, 100));
    } else if (type === 'profile') {
      setProfile(prev => ({ ...prev, ...data }));
    }
  };

  return {
    profile,
    snapshots,
    transactions,
    alerts,
    isConnected,
    isLoading,
    triggerOptimisticUpdate
  };
}
