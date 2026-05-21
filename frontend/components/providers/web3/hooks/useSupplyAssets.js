import useSWR from "swr";
import { useWeb3 } from "../index";
import { normalizeToken } from "../../../../utils/normalize"
import { SUPPORTED_NETWORKS, TARGET_NETWORK_ID } from "../../../../utils/network";

export const handler = () => {
  const { web3, contract } = useWeb3();

  const { data, error, mutate, ...rest } = useSWR(
    () => (web3 && contract ? "web3/supply_assets" : null),
    async () => {
      const tokens = await contract.methods.getTokensForLendingArray().call()
      const supplyAssets = await Promise.all(
        tokens.map(token => normalizeToken(web3, contract, token))
      )
      return supplyAssets.filter(token => !token.error)
    }
  );

  const targetNetwork = SUPPORTED_NETWORKS[TARGET_NETWORK_ID];

  return {
    data: data || [],
    error,
    mutate,
    ...rest,
    target: targetNetwork,
    isSupported: data && data.length > 0,
  };
};
