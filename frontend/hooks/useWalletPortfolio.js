import { useEffect, useState } from 'react';
import { usePortfolioRealtime } from './usePortfolioRealtime';

export function useWalletPortfolio() {
  const [activeAddress, setActiveAddress] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check for mock parameter in query string for verification / testing
    const urlParams = new URLSearchParams(window.location.search);
    const mock = urlParams.get('mock');
    if (mock) {
      const mockAddr = mock === 'true' ? '0x89dd2533675d6192801e0bf9ae33c0000000fbda' : mock.toLowerCase();
      setActiveAddress(mockAddr);
      console.log('[useWalletPortfolio] Mock address enabled:', mockAddr);
      return;
    }

    const getConnectedAccount = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setActiveAddress(accounts[0].toLowerCase());
          }
        } catch (err) {
          console.error('[useWalletPortfolio] Error fetching eth_accounts:', err);
        }
      }
    };

    getConnectedAccount();

    const handleAccountsChanged = (accounts) => {
      console.log('[useWalletPortfolio] Accounts changed:', accounts);
      if (accounts && accounts.length > 0) {
        setActiveAddress(accounts[0].toLowerCase());
      } else {
        setActiveAddress(null);
      }
    };

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }

    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  const realtimeData = usePortfolioRealtime(activeAddress);

  return {
    activeAddress,
    ...realtimeData
  };
}
