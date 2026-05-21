import useSWR from "swr";
import { useWeb3 } from "../index";
import { normalizeToken } from "../../../../utils/normalize"
import { SUPPORTED_NETWORKS, TARGET_NETWORK_ID } from "../../../../utils/network";

export const handler = () => {
  const { web3, contract } = useWeb3();

  const { data, error, mutate, ...rest } = useSWR(
    () => (web3 && contract ? "web3/your_borrows" : null),
    async () => {
      const accounts = await web3.eth.getAccounts();
      const account = accounts[0];
      if (!account) return { yourBorrows: [], yourBalance: 0 };

      const noOfTokensBorrowed = await contract.methods.noOfTokensBorrowed().call();
      const yourBorrows = [];
      let yourBalance = 0;

      if (Number(noOfTokensBorrowed) > 0) {
        const fetchPromises = [];
        for (let i = 0; i < Number(noOfTokensBorrowed); i++) {
          fetchPromises.push(contract.methods.tokensBorrowed(i, account).call());
        }

        const addresses = await Promise.all(fetchPromises);
        const uniqueAddresses = [...new Set(addresses.filter(addr => addr !== "0x0000000000000000000000000000000000000000"))];

        const tokens = await Promise.all(uniqueAddresses.map(addr => contract.methods.getTokenFrom(addr).call()));
        const normalizedTokens = await Promise.all(tokens.map(t => normalizeToken(web3, contract, t)));

        normalizedTokens.forEach(normalized => {
          if (!normalized.error && parseFloat(normalized.userTokenBorrowedAmount.amount) > 0) {
            yourBorrows.push(normalized);
            yourBalance += parseFloat(normalized.userTokenBorrowedAmount.inDollars);
          }
        });
      }
      return { yourBorrows, yourBalance };
    }
  );

  const targetNetwork = SUPPORTED_NETWORKS[TARGET_NETWORK_ID];

  return {
    data: data || { yourBorrows: [], yourBalance: 0 },
    error,
    mutate,
    ...rest,
    target: targetNetwork,
    isSupported: !!data,
  };
};
