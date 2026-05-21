import LendingAndBorrowing from '../../abis/LendingAndBorrowing.json'
import RiskController from '../../abis/RiskController.json'
import LARToken from '../../abis/LARToken.json'
import MockDAI from '../../abis/MockDAIToken.json'

const ARTIFACTS = {
  "LendingAndBorrowing": LendingAndBorrowing,
  "RiskController": RiskController,
  "LARToken": LARToken,
  "MockDAI": MockDAI
};

export const loadContract = async (contractName, web3) => {
  try {
    const NETWORK_ID = await web3.eth.net.getId();
    const Artifact = ARTIFACTS[contractName] || LendingAndBorrowing;
    const networkData = Artifact.networks[NETWORK_ID];

    if (!networkData) {
      console.warn(`[Web3] Contract [${contractName}] not found on network ${NETWORK_ID}.`);
      return null;
    }

    const contract = new web3.eth.Contract(
      Artifact.abi,
      networkData.address
    );

    console.log(`[Web3] Loaded ${contractName} at ${networkData.address}`);
    return contract;
  } catch (err) {
    console.error(`[Web3 Error] Failed to load ${contractName}:`, err.message);
    return null;
  }
};
