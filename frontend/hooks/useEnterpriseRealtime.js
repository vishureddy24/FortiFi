import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

export function useEnterpriseRealtime(walletAddress) {
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const socketRef = useRef(null);

  useEffect(() => {
    if (!walletAddress) {
      setMetrics(null);
      setHistory([]);
      setSecurityLogs([]);
      setTransactions([]);
      return;
    }

    const wallet = walletAddress.toLowerCase();
    setIsLoading(true);

    // Fetch baseline Cockpit datasets
    const fetchCockpitData = async () => {
      try {
        const res = await axios.get(`http://localhost:5001/api/enterprise/cockpit/${wallet}`);
        if (res.data) {
          setMetrics(res.data.metrics);
          setHistory(res.data.history || []);
          setSecurityLogs(res.data.securityLogs || []);
          setTransactions(res.data.transactions || []);
        }
      } catch (err) {
        console.error('[useEnterpriseRealtime] Error loading baseline data:', err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCockpitData();

    // Subscribe to WebSockets channels
    const socket = io('http://localhost:5001');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[useEnterpriseRealtime] Connected. Subscribing to wallet channel:', wallet);
      setIsConnected(true);
      socket.emit('join_enterprise_wallet', wallet);
    });

    // Debounce / Deduplication logic to avoid duplicate events
    const processedEvents = new Set();

    socket.on('enterprise:update', (data) => {
      if (!data || data.wallet.toLowerCase() !== wallet) return;
      
      const eventKey = `metric-${data._id || data.timestamp}`;
      if (processedEvents.has(eventKey)) return;
      processedEvents.add(eventKey);

      setMetrics(data);
      setHistory(prev => {
        const next = [...prev, data];
        if (next.length > 50) next.shift(); // Keep last 50 solvency points
        return next;
      });
    });

    socket.on(`tx:${wallet}`, (data) => {
      if (!data || data.wallet.toLowerCase() !== wallet) return;

      const eventKey = `tx-${data.txHash || data._id}`;
      if (processedEvents.has(eventKey)) return;
      processedEvents.add(eventKey);

      setTransactions(prev => {
        const next = [data, ...prev];
        if (next.length > 100) next.pop(); // Cache latest 100 records
        return next;
      });
    });

    socket.on(`security:${wallet}`, (data) => {
      if (!data || data.wallet.toLowerCase() !== wallet) return;

      const eventKey = `sec-${data._id || data.timestamp}`;
      if (processedEvents.has(eventKey)) return;
      processedEvents.add(eventKey);

      setSecurityLogs(prev => [data, ...prev]);
    });

    socket.on('disconnect', () => {
      console.log('[useEnterpriseRealtime] Disconnected');
      setIsConnected(false);
    });

    return () => {
      console.log('[useEnterpriseRealtime] Cleaning up subscription for:', wallet);
      socket.emit('leave_enterprise_wallet', wallet);
      socket.disconnect();
    };
  }, [walletAddress]);

  // Optimistic UI support
  const triggerOptimisticUpdate = (type, payload) => {
    if (type === 'metric') {
      setMetrics(prev => ({ ...prev, ...payload }));
    } else if (type === 'transaction') {
      setTransactions(prev => [payload, ...prev]);
    }
  };

  return {
    metrics,
    history,
    securityLogs,
    transactions,
    isConnected,
    isLoading,
    triggerOptimisticUpdate
  };
}
