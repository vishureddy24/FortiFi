import { useWeb3 } from "../../providers/web3";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { handler as createAccountHook } from "../../providers/web3/hooks/useAccount";
import { handler as createNetworkHook } from "../../providers/web3/hooks/useNetwork";
import { handler as createSupplyAssetsHook } from "../../providers/web3/hooks/useSupplyAssets";
import { handler as createBorrowAssetsHook } from "../../providers/web3/hooks/useBorrowAssets";
import { handler as createYourSuppliesHook } from "../../providers/web3/hooks/useYourSupplies";
import { handler as createYourBorrowsHook } from "../../providers/web3/hooks/useYourBorrows";

const _isEmpty = (data) => {
  return (
    data == null ||
    data === "" ||
    (Array.isArray(data) && data.length === 0) ||
    (data.constructor === Object && Object.keys(data).length === 0)
  );
};

const enhanceHook = (swrRes) => {
  const data = swrRes?.data;
  const error = swrRes?.error;

  const hasInitialResponse = !!(data || error);

  return {
    ...swrRes,
    hasInitialResponse,
    isEmpty: hasInitialResponse && _isEmpty(data),
  };
};

export const useAccount = () => {
  const swrRes = enhanceHook(createAccountHook());
  return {
    account: {
      ...swrRes,
      data: swrRes.data?.address,
      balance: swrRes.data?.balance,
      riskScore: swrRes.data?.riskScore,
      isAdmin: swrRes.data?.isAdmin,
      isBlacklisted: swrRes.data?.isBlacklisted,
    }
  };
};

export const useSupplyAssets = () => {
  return {
    tokens: enhanceHook(createSupplyAssetsHook()),
  };
};

export const useBorrowAssets = () => {
  return {
    tokensForBorrow: enhanceHook(createBorrowAssetsHook()),
  };
};

export const useYourSupplies = () => {
  return {
    yourSupplies: enhanceHook(createYourSuppliesHook()),
  };
};

export const useYourBorrows = () => {
  return {
    yourBorrows: enhanceHook(createYourBorrowsHook()),
  };
};

export const useNetwork = () => {
  return {
    network: enhanceHook(createNetworkHook()),
  };
};

export const useAdmin = ({ redirectTo }) => {
  const { account } = useAccount();
  const { requireInstall } = useWeb3();
  const router = useRouter();

  useEffect(() => {
    if (
      requireInstall ||
      (account.hasInitialResponse && !account.isAdmin) ||
      account.isEmpty
    ) {
      router.push(redirectTo);
    }
  }, [account, requireInstall, router, redirectTo]);

  return { account };
};

export const useWalletInfo = () => {
  const { network } = useNetwork();
  const { account } = useAccount();
  const hasConnectedWallet = !!(account.data && network.isSupported);
  const isConnecting =
    !account.hasInitialResponse && !network.hasInitialResponse;

  return {
    network,
    account,
    hasConnectedWallet,
    isConnecting,
  };
};
