import useSWR from "swr";
import { useWeb3 } from "../index";
import { normalizeToken } from "../../../../utils/normalize"
import { SUPPORTED_NETWORKS, TARGET_NETWORK_ID } from "../../../../utils/network";

export const handler = () => {
  const { web3, contract } = useWeb3();

  const { data, error, mutate, ...rest } = useSWR(
    () => (web3 && contract ? "web3/your_supplies" : null),
    async () => {
      const accounts = await web3.eth.getAccounts();
      const account = accounts[0];
      if (!account) return { yourSupplies: [], yourBalance: 0 };

      const noOfTokensLent = await contract.methods.noOfTokensLent().call();
      const yourSupplies = [];
      let yourBalance = 0;

      if (Number(noOfTokensLent) > 0) {
        const fetchPromises = [];
        for (let i = 0; i < Number(noOfTokensLent); i++) {
          fetchPromises.push(contract.methods.tokensLent(i, account).call());
        }

        const addresses = await Promise.all(fetchPromises);
        const uniqueAddresses = [...new Set(addresses.filter(addr => addr !== "0x0000000000000000000000000000000000000000"))];

        const tokens = await Promise.all(uniqueAddresses.map(addr => contract.methods.getTokenFrom(addr).call()));
        const normalizedTokens = await Promise.all(tokens.map(t => normalizeToken(web3, contract, t)));

        normalizedTokens.forEach(normalized => {
          if (!normalized.error && parseFloat(normalized.userTokenLentAmount.inDollars) > 0.000001) {
            yourSupplies.push(normalized);
            yourBalance += parseFloat(normalized.userTokenLentAmount.inDollars);
          }
        });
      }
      return { yourSupplies, yourBalance };
    }
  );

  const targetNetwork = SUPPORTED_NETWORKS[TARGET_NETWORK_ID];

  return {
    data: data || { yourSupplies: [], yourBalance: 0 },
    error,
    mutate,
    ...rest,
    target: targetNetwork,
    isSupported: !!data,
  };
};
