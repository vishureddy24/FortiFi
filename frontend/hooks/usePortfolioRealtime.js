import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

export function usePortfolioRealtime(walletAddress) {
  const [profile, setProfile] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Keep snapshot cache to format data chronologically for charts
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
        console.log(`[usePortfolioRealtime] STATE_UPDATED: Loading data for ${address}`);
        const [portfolioRes, historyRes, txRes, alertsRes] = await Promise.all([
          fetch(`http://localhost:5001/api/portfolio/${address}`).then(res => res.json()),
          fetch(`http://localhost:5001/api/portfolio/history/${address}`).then(res => res.json()),
          fetch(`http://localhost:5001/api/portfolio/transactions/${address}`).then(res => res.json()),
          fetch(`http://localhost:5001/api/alerts/live/${address}`).then(res => res.json()).catch(() => [])
        ]);

        if (portfolioRes) {
          // Route returns { profile, snapshot } — profile is already normalised.
          // Guard against old shape where profile was the raw metrics object.
          const rawProfile = portfolioRes.profile || portfolioRes;
          const normProfile = {
            ...rawProfile,
            // Ensure both field-name variants are present so the page can use either
            totalCollateral: rawProfile.totalCollateral ?? rawProfile.suppliedCollateral ?? 0,
            suppliedCollateral: rawProfile.suppliedCollateral ?? rawProfile.totalCollateral ?? 0,
            totalDebt: rawProfile.totalDebt ?? rawProfile.outstandingDebt ?? 0,
            outstandingDebt: rawProfile.outstandingDebt ?? rawProfile.totalDebt ?? 0,
            healthFactor: rawProfile.healthFactor ?? 100,
            borrowUtilization: rawProfile.borrowUtilization ?? 0,
            riskScore: rawProfile.riskScore ?? 0,
            trustScore: rawProfile.trustScore ?? rawProfile.trustIdentityScore ?? 100,
            trustIdentityScore: rawProfile.trustIdentityScore ?? rawProfile.trustScore ?? 100
          };
          setProfile(normProfile);
        }
        if (historyRes) {
          const formattedHistory = Array.isArray(historyRes) ? historyRes : [];
          // History comes back newest-first from the route; reverse for chronological chart display
          const sortedHistory = [...formattedHistory].reverse();
          snapshotsCache.current = sortedHistory.slice(-100);
          setSnapshots(snapshotsCache.current);
        }
        if (txRes) {
          setTransactions(Array.isArray(txRes) ? txRes.slice(0, 100) : []);
        }
        if (alertsRes) {
          const formattedAlerts = Array.isArray(alertsRes) ? alertsRes.map(a => ({
            _id: a._id,
            title: a.title || `Security Alert: ${a.threatType}`,
            message: a.message || 'Threat pattern detected',
            severity: a.severity || 'INFO',
            timestamp: a.timestamp,
            txHash: a.txHash
          })) : [];
          setAlerts(formattedAlerts);
        }
      } catch (err) {
        console.error('[usePortfolioRealtime] Error loading initial portfolio metrics:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();

    // Establish socket connection
    const socket = io('http://localhost:5001', {
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000
    });

    const roomName = `wallet:${address}`;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log(`[usePortfolioRealtime] SOCKET_EMITTED: join -> ${roomName}`);
      socket.emit('join', roomName);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[usePortfolioRealtime] Socket disconnected');
    });

    // 1. portfolio:update
    socket.on('portfolio:update', (payload) => {
      console.log('[usePortfolioRealtime] EVENT_RECEIVED: portfolio:update', payload);
      if (payload.walletAddress && payload.walletAddress.toLowerCase() === address) {
        const rawProfile = payload.profile || {};
        const normProfile = {
          ...rawProfile,
          totalCollateral: rawProfile.totalCollateral ?? rawProfile.suppliedCollateral ?? 0,
          suppliedCollateral: rawProfile.suppliedCollateral ?? rawProfile.totalCollateral ?? 0,
          totalDebt: rawProfile.totalDebt ?? rawProfile.outstandingDebt ?? 0,
          outstandingDebt: rawProfile.outstandingDebt ?? rawProfile.totalDebt ?? 0,
          healthFactor: rawProfile.healthFactor ?? 100,
          borrowUtilization: rawProfile.borrowUtilization ?? 0,
          riskScore: rawProfile.riskScore ?? 0,
          trustScore: rawProfile.trustScore ?? rawProfile.trustIdentityScore ?? 100,
          trustIdentityScore: rawProfile.trustIdentityScore ?? rawProfile.trustScore ?? 100
        };
        setProfile(normProfile);
        if (payload.snapshot) {
          const updated = [...snapshotsCache.current, payload.snapshot];
          if (updated.length > 100) updated.shift();
          snapshotsCache.current = updated;
          setSnapshots([...updated]);
        }
        console.log('[usePortfolioRealtime] STATE_UPDATED: profile & snapshots updated');
      }
    });

    // 2. tx:new
    socket.on('tx:new', (incomingTx) => {
      console.log('[usePortfolioRealtime] EVENT_RECEIVED: tx:new', incomingTx);
      const formattedTx = {
        _id: incomingTx._id || Math.random().toString(),
        txHash: incomingTx.txHash,
        type: incomingTx.type,
        asset: incomingTx.asset,
        amount: incomingTx.amount,
        gasUsed: incomingTx.gasUsed,
        riskScore: incomingTx.riskScore,
        utilization: incomingTx.utilization,
        debtAfter: incomingTx.debtAfter,
        timestamp: incomingTx.timestamp || new Date()
      };

      setTransactions(prev => {
        const exists = prev.some(t => t.txHash === formattedTx.txHash);
        if (exists) return prev;
        const newTxList = [formattedTx, ...prev].slice(0, 100);
        console.log('[usePortfolioRealtime] STATE_UPDATED: transactions explorer updated');
        return newTxList;
      });
    });

    // 3. security:update
    socket.on('security:update', (incomingLog) => {
      console.log('[usePortfolioRealtime] EVENT_RECEIVED: security:update', incomingLog);
      const formattedLog = {
        _id: incomingLog._id || Math.random().toString(),
        title: incomingLog.title || `Security Alert: ${incomingLog.threatType}`,
        message: incomingLog.message || 'Threat pattern detected',
        severity: incomingLog.severity || 'INFO',
        timestamp: incomingLog.timestamp || new Date(),
        txHash: incomingLog.txHash
      };

      setAlerts(prev => {
        // Dedup by txHash+title (threatType may not be present in formatted log)
        const exists = prev.some(l =>
          l.txHash && formattedLog.txHash
            ? l.txHash === formattedLog.txHash
            : l.title === formattedLog.title && l.timestamp === formattedLog.timestamp
        );
        if (exists) return prev;
        const newLogList = [formattedLog, ...prev];
        console.log('[usePortfolioRealtime] STATE_UPDATED: security timeline updated');
        return newLogList;
      });
    });

    // 4. portfolioUpdate — legacy event from portfolioService.js
    socket.on('portfolioUpdate', (payload) => {
      console.log('[usePortfolioRealtime] EVENT_RECEIVED: portfolioUpdate', payload);
      if (payload.profile) {
        const rawProfile = payload.profile;
        const normProfile = {
          ...rawProfile,
          totalCollateral: rawProfile.totalCollateral ?? rawProfile.suppliedCollateral ?? 0,
          suppliedCollateral: rawProfile.suppliedCollateral ?? rawProfile.totalCollateral ?? 0,
          totalDebt: rawProfile.totalDebt ?? rawProfile.outstandingDebt ?? 0,
          outstandingDebt: rawProfile.outstandingDebt ?? rawProfile.totalDebt ?? 0,
          healthFactor: rawProfile.healthFactor ?? 100,
          borrowUtilization: rawProfile.borrowUtilization ?? 0,
          riskScore: rawProfile.riskScore ?? 0,
          trustScore: rawProfile.trustScore ?? rawProfile.trustIdentityScore ?? 100,
          trustIdentityScore: rawProfile.trustIdentityScore ?? rawProfile.trustScore ?? 100
        };
        setProfile(normProfile);
        console.log('[usePortfolioRealtime] STATE_UPDATED: profile updated via portfolioUpdate');
      }
      if (payload.snapshot) {
        const updated = [...snapshotsCache.current, payload.snapshot];
        if (updated.length > 100) updated.shift();
        snapshotsCache.current = updated;
        setSnapshots([...updated]);
      }
    });

    // 5. transactionUpdate — legacy event from portfolioService.js
    socket.on('transactionUpdate', (incomingTx) => {
      console.log('[usePortfolioRealtime] EVENT_RECEIVED: transactionUpdate', incomingTx);
      const formattedTx = {
        _id: incomingTx._id || Math.random().toString(),
        txHash: incomingTx.txHash,
        type: incomingTx.type,
        asset: incomingTx.asset,
        amount: incomingTx.amount,
        gasUsed: incomingTx.gasUsed,
        riskScore: incomingTx.riskScore,
        utilization: incomingTx.utilization,
        debtAfter: incomingTx.debtAfter,
        timestamp: incomingTx.timestamp || new Date()
      };
      setTransactions(prev => {
        const exists = prev.some(t => t.txHash === formattedTx.txHash);
        if (exists) return prev;
        const newTxList = [formattedTx, ...prev].slice(0, 100);
        console.log('[usePortfolioRealtime] STATE_UPDATED: transactions updated via transactionUpdate');
        return newTxList;
      });
    });

    // 6. alertUpdate — legacy event from portfolioService.js
    socket.on('alertUpdate', (incomingAlert) => {
      console.log('[usePortfolioRealtime] EVENT_RECEIVED: alertUpdate', incomingAlert);
      const formattedAlert = {
        _id: incomingAlert._id || Math.random().toString(),
        title: incomingAlert.title || 'Portfolio Alert',
        message: incomingAlert.message || '',
        severity: incomingAlert.severity || 'INFO',
        timestamp: incomingAlert.timestamp || new Date(),
        txHash: incomingAlert.txHash
      };
      setAlerts(prev => {
        const exists = prev.some(l => l._id === formattedAlert._id);
        if (exists) return prev;
        const newList = [formattedAlert, ...prev];
        console.log('[usePortfolioRealtime] STATE_UPDATED: alerts updated via alertUpdate');
        return newList;
      });
    });

    // 7. risk:update — update profile risk fields
    socket.on('risk:update', (payload) => {
      console.log('[usePortfolioRealtime] EVENT_RECEIVED: risk:update', payload);
      if (payload.wallet && payload.wallet.toLowerCase() === address) {
        setProfile(prev => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            riskScore: payload.score ?? prev.riskScore,
            totalDebt: payload.debt ?? prev.totalDebt,
            totalCollateral: payload.collateral ?? prev.totalCollateral,
            borrowUtilization: payload.utilization ?? prev.borrowUtilization
          };
          console.log('[usePortfolioRealtime] STATE_UPDATED: profile risk fields updated');
          return updated;
        });
      }
    });

    return () => {
      console.log(`[usePortfolioRealtime] SOCKET_EMITTED: leave -> ${roomName}`);
      socket.emit('leave', roomName);
      socket.disconnect();
    };
  }, [walletAddress]);

  return {
    profile,
    snapshots,
    transactions,
    alerts,
    isConnected,
    isLoading
  };
}
