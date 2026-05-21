import useSWR from "swr";
import { useWeb3 } from "../index";
import { SUPPORTED_NETWORKS, TARGET_NETWORK_ID } from "../../../../utils/network";

export const handler = () => {
  const { web3, status } = useWeb3();

  const { data, error, mutate, ...rest } = useSWR(
    () => (web3 ? "web3/network" : null),
    async () => {
      const chainId = await web3.eth.getChainId();
      if (!chainId) {
        throw new Error("Cannot retrieve network.");
      }
      return SUPPORTED_NETWORKS[chainId] || "Unknown Network";
    },
    { revalidateOnFocus: false }
  );

  const targetNetwork = SUPPORTED_NETWORKS[TARGET_NETWORK_ID];

  return {
    data: data || (status === 'LOADING' ? null : "Unknown"),
    error,
    mutate,
    ...rest,
    target: targetNetwork,
    isSupported: data === targetNetwork,
  };
};
