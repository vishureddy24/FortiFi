import { useEffect } from "react";
import useSWR from "swr";
import { useWeb3 } from "../index";

export const handler = () => {
  const { web3, provider, riskController } = useWeb3();

  const { mutate, data, error, ...rest } = useSWR(
    () => (web3 ? "web3/accounts" : null),
    async () => {
      const accounts = await web3.eth.getAccounts();
      const account = accounts[0];

      if (!account) {
        throw new Error("Failed to detect Account. Please connect MetaMask.");
      }

      // Fetch balance
      const balanceWei = await web3.eth.getBalance(account);
      const balance = web3.utils.fromWei(balanceWei, "ether");

      // Fetch risk metadata if contract is available
      let riskScore = 0;
      let isAdmin = false;
      let isBlacklisted = false;

      if (riskController) {
        try {
          riskScore = await riskController.methods.userRiskScores(account).call();
          const owner = await riskController.methods.owner().call();
          isAdmin = account.toLowerCase() === owner.toLowerCase();
          isBlacklisted = await riskController.methods.blacklistedWallets(account).call();
        } catch (e) {
          console.warn("[useAccount] Failed to fetch risk metadata:", e.message);
        }
      }

      return {
        address: account,
        balance: parseFloat(balance).toFixed(4),
        riskScore: parseInt(riskScore),
        isAdmin,
        isBlacklisted
      };
    },
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    const mutator = () => mutate();
    provider?.on("accountsChanged", mutator);
    return () => provider?.removeListener("accountsChanged", mutator);
  }, [provider, mutate]);

  return {
    mutate,
    data,
    error,
    ...rest,
  };
};
