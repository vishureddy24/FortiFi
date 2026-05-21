import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import detectEthereumProvider from "@metamask/detect-provider";
import Web3 from "web3";
import { loadContract } from "../../../utils/loadContract";

const Web3Context = createContext(null);

export const STATE = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  ONLINE: 'ONLINE',
  DEGRADED: 'DEGRADED',
  OFFLINE: 'OFFLINE',
  WRONG_NETWORK: 'WRONG_NETWORK'
};

const DEFAULT_API = {
  web3: null,
  provider: null,
  contract: null,
  riskController: null,
  larToken: null,
  isLoading: true,
  status: STATE.IDLE,
  error: null,
  providerType: null
};

export default function Web3Provider({ children }) {
  const [web3Api, setWeb3Api] = useState(DEFAULT_API);

  const initializeWeb3 = useCallback(async () => {
    console.log("[FortiFi Web3] Initializing resilient provider layer...");
    setWeb3Api(prev => ({ ...prev, isLoading: true, error: null, status: STATE.LOADING }));

    try {
      const metamaskProvider = await Promise.race([
        detectEthereumProvider(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("MetaMask detection timeout")), 3000))
      ]).catch(() => null);

      if (metamaskProvider) {
        const web3 = new Web3(metamaskProvider);
        try {
          const networkId = await web3.eth.net.getId();
          const [contract, riskController, larToken] = await Promise.all([
            loadContract("LendingAndBorrowing", web3),
            loadContract("RiskController", web3),
            loadContract("LARToken", web3)
          ]);

          if (contract) {
            // Verify contract code exists
            const code = await web3.eth.getCode(contract.options.address);
            if (code === "0x" || code === "0x0") {
               throw new Error(`Contract artifacts found for network ${networkId}, but no code at ${contract.options.address}. Please redeploy or restart Ganache.`);
            }

            setWeb3Api({
              web3,
              provider: metamaskProvider,
              contract,
              riskController,
              larToken,
              isLoading: false,
              error: null,
              status: STATE.ONLINE,
              providerType: 'metamask',
            });

            metamaskProvider.on("accountsChanged", (accounts) => {
              const newAccount = accounts[0];
              web3.eth.defaultAccount = newAccount;
              if (window.location.pathname === '/portfolio' || window.location.pathname === '/portfolio/') {
                console.log("[FortiFi Web3] accountsChanged: Bypass reload for Portfolio page");
              } else {
                window.location.reload();
              }
            });
            
            // Set initial default account
            const accounts = await web3.eth.getAccounts();
            if (accounts[0]) {
              web3.eth.defaultAccount = accounts[0];
              console.log("[FortiFi Web3] Default account synchronized:", accounts[0]);
            }

            metamaskProvider.on("chainChanged", () => {
              if (window.location.pathname === '/portfolio' || window.location.pathname === '/portfolio/') {
                console.log("[FortiFi Web3] chainChanged: Bypass reload for Portfolio page");
              } else {
                window.location.reload();
              }
            });
            return;
          }
        } catch (err) {
          console.error("[FortiFi Web3] MetaMask initialization failed:", err.message);
          // Don't return, try fallback
        }
      }

      const fallbackUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:7545";
      const fallbackProvider = new Web3.providers.HttpProvider(fallbackUrl, { timeout: 5000 });
      const web3Fallback = new Web3(fallbackProvider);
      
      try {
        await web3Fallback.eth.getBlockNumber();
        const [contractF, riskF, larF] = await Promise.all([
          loadContract("LendingAndBorrowing", web3Fallback),
          loadContract("RiskController", web3Fallback),
          loadContract("LARToken", web3Fallback)
        ]);
        
        if (contractF) {
           const code = await web3Fallback.eth.getCode(contractF.options.address);
           if (code === "0x" || code === "0x0") {
              throw new Error("Ganache is running, but LendingAndBorrowing is not deployed.");
           }
        }

        setWeb3Api({
          web3: web3Fallback,
          provider: metamaskProvider || null, // Preserve metamask provider if it exists
          contract: contractF,
          riskController: riskF,
          larToken: larF,
          isLoading: false,
          status: contractF ? STATE.DEGRADED : STATE.OFFLINE,
          error: contractF ? "Secure Read-Only Mode. Connect MetaMask for transactions." : "Contracts not deployed on local chain.",
          providerType: 'fallback',
        });
      } catch (fallbackErr) {
        setWeb3Api({
          ...DEFAULT_API,
          isLoading: false,
          status: STATE.OFFLINE,
          error: fallbackErr.message.includes("not deployed") ? fallbackErr.message : "Blockchain unreachable. Please ensure Ganache is running at 127.0.0.1:7545",
        });
      }
    } catch (err) {
      setWeb3Api(prev => ({ ...prev, isLoading: false, status: STATE.OFFLINE, error: err.message }));
    }
  }, []);

  useEffect(() => {
    initializeWeb3();
  }, [initializeWeb3]);

  const contextValue = useMemo(() => {
    return {
      ...web3Api,
      isReadOnly: web3Api.status === STATE.DEGRADED,
      isOffline: web3Api.status === STATE.OFFLINE,
      reconnect: async () => {
        try {
          if (window.ethereum) {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
          }
          await initializeWeb3();
        } catch (err) {
          console.error("Reconnect failed:", err);
          await initializeWeb3();
        }
      },
      connect: async () => {
        try {
          if (window.ethereum) {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            await initializeWeb3();
          }
        } catch (err) {
          console.error("Failed to connect to MetaMask", err);
        }
      }
    };
  }, [web3Api, initializeWeb3]);

  return (
    <Web3Context.Provider value={contextValue}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) throw new Error("useWeb3 must be used within a Web3Provider");
  return context;
}
