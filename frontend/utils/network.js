export const SUPPORTED_NETWORKS = {
  1: "Ethereum Main Network",
  3: "Ropsten Test Network",
  4: "Rinkeby Test Network",
  5: "Goerli Test Network",
  11155111: "Sepolia Test Network",
  1337: "Ganache",
  5777: "Ganache",
};

export const TARGET_NETWORK_ID = process.env.NEXT_PUBLIC_TARGET_NETWORK_ID || "1337";
