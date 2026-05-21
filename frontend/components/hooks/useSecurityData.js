import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5001/api';

const MOCK_ALERTS = [
  { _id: 'mock1', severity: 'Low', message: 'System integrity verified. Scanning for anomalies...', createdAt: new Date(), metadata: { user: '0x000...000' } },
  { _id: 'mock2', severity: 'Low', message: 'Liquidity pools monitored. Healthy ratios detected.', createdAt: new Date(Date.now() - 3600000), metadata: { user: '0x000...000' } }
];

export const useSecurityData = (account) => {
  const [alerts, setAlerts] = useState([]);
  const [riskScores, setRiskScores] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [userScore, setUserScore] = useState(null);
  const [protocolScore, setProtocolScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const fetchData = async () => {
    try {
      console.log("[useSecurityData] Fetching intelligence data...");
      
      const [alertsRes, simsRes, scoresRes] = await Promise.all([
        fetch(`${API_BASE}/alerts`).catch(() => null),
        fetch(`${API_BASE}/simulations`).catch(() => null),
        fetch(`${API_BASE}/risk-scores`).catch(() => null)
      ]);

      if (!alertsRes || !scoresRes) {
        console.warn("[useSecurityData] Backend unreachable. Entering Demo Mode.");
        setIsDemoMode(true);
        setAlerts(MOCK_ALERTS);
        setProtocolScore({ address: 'protocol', score: 1.2, trend: -5 });
        setLoading(false);
        return;
      }

      const [alertsData, simsData, scoresData] = await Promise.all([
        alertsRes.json(),
        simsRes ? simsRes.json() : [],
        scoresRes.json()
      ]);

      setAlerts(alertsData);
      setSimulations(simsData);
      setRiskScores(scoresData);
      setIsDemoMode(false);

      const protocol = scoresData.find(s => s.address === 'protocol');
      setProtocolScore(protocol || { address: 'protocol', score: 0 });

      if (account) {
        const user = scoresData.find(s => s.address.toLowerCase() === account.toLowerCase());
        setUserScore(user || { score: 0 });
      }

      setLoading(false);
    } catch (err) {
      console.error('[useSecurityData] Fetch Error:', err);
      setIsDemoMode(true);
      setAlerts(MOCK_ALERTS);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [account]);

  return { alerts, riskScores, simulations, userScore, protocolScore, loading, isDemoMode, refresh: fetchData };
};
