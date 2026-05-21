import { useEffect, useState } from 'react';
import { useEnterpriseRealtime } from './useEnterpriseRealtime';

export function useWalletEnterprise() {
  const [activeAddress, setActiveAddress] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check for mock parameter in query string for testing/browser verification
    const urlParams = new URLSearchParams(window.location.search);
    const mock = urlParams.get('mock');
    if (mock) {
      const mockAddr = mock === 'true' ? '0x89dd2533675d6192801e0bf9ae33c0000000fbda' : mock.toLowerCase();
      setActiveAddress(mockAddr);
      console.log('[useWalletEnterprise] Mock active address set:', mockAddr);
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
          console.error('[useWalletEnterprise] Error fetching eth_accounts:', err);
        }
      }
    };

    getConnectedAccount();

    const handleAccountsChanged = (accounts) => {
      console.log('[useWalletEnterprise] Accounts changed:', accounts);
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

  const realtimeData = useEnterpriseRealtime(activeAddress);

  return {
    activeAddress,
    ...realtimeData
  };
}
