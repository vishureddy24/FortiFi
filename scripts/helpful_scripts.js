const MockV3Aggregator = artifacts.require('MockV3Aggregator')
const MockDAIToken = artifacts.require('MockDAIToken')
const Web3 = require("web3");
const web3 = new Web3();
// var Eth = require('web3-eth');
// var eth = new Eth(Eth.givenProvider || 'ws://some.local-or-remote.node:8546');

let deployed = false;
let tokenDai = {} ;
let mockV3 = {};

const token_address = {
    // Sepolia Testnet Addresses
    "sepolia": {
        "dai_usd_price_feed_address": "0x14866185B13f97D05116812221f471f4350a7bb3",
        "eth_usd_price_feed_address": "0x694AA1769357215DE4FAC081bf1f309aDC325306",
        "link_usd_price_feed_address": "0xc59E3633BA51D3701b5E674f4b932BA335606132",
        "fau_usd_price_feed_address": "0x14866185B13f97D05116812221f471f4350a7bb3", // Using DAI as proxy for FAU
        "dai_token_address": "0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6", // Mock DAI on Sepolia
        "weth_token_address": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", // WETH on Sepolia
        "link_token_address": "0x779877A7B0D9E8603169DdbD7836e478b4624789", // LINK on Sepolia
        "fau_token_address": "0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6",
    },
    // Default (Kovan/Legacy)
    "default": {
        "dai_usd_price_feed_address": '0x777A68032a88E5A84678A77Af2CD65A7b3c0775a',
        "eth_usd_price_feed_address": '0x9326BFA02ADD2366b30bacB125260Af641031331',
        "link_usd_price_feed_address": '0x396c5E36DD0a0F5a5D33dae44368D4193f69a1F0',
        "fau_usd_price_feed_address": '0x777A68032a88E5A84678A77Af2CD65A7b3c0775a',
        "dai_token_address": '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD',
        "weth_token_address": '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
        "link_token_address": '0xa36085F69e2889c224210F603D836748e7dC0088',
        "fau_token_address": '0xFab46E002BbF0b4509813474841E0716E6730136',
    }
}

function toWei(amount){
  return web3.utils.toWei(amount, "ether")
}

const contract_to_mock = {
    "dai_usd_price_feed_address": MockV3Aggregator,
    "dapp_usd_price_feed_address": MockV3Aggregator,
    "eth_usd_price_feed_address": MockV3Aggregator,
    "link_usd_price_feed_address": MockV3Aggregator,
    "fau_usd_price_feed_address": MockV3Aggregator,
    "dai_token_address": MockDAIToken,
    "weth_token_address": MockDAIToken,
    "link_token_address": MockDAIToken,
    "fau_token_address": MockDAIToken,
    "dapp_token_address": MockDAIToken
}

const deploy_mocks = async(deployer) =>{
  await deployer.deploy(MockDAIToken)
  await deployer.deploy(MockV3Aggregator, 8, 2 * 10**8)
  tokenDai = await MockDAIToken.deployed()
  mockV3 = await MockV3Aggregator.deployed()
  deployed = true;
  return [tokenDai.address,mockV3._address]
}


const get_contract = async(contract_name, current_network, current_deployer)=>{
    let contract_addr;
    let contract_type = contract_to_mock[contract_name]
    
    if(current_network == "development"){
        if (deployed) {
          contract_addr = contract_type["contractName"] == "MockDAIToken" ? tokenDai.address : mockV3.address
        } else {
          var token = await deploy_mocks(current_deployer)
          contract_addr = contract_type["contractName"] == "MockDAIToken" ? token[0]: token[1]
        }
    } else {
        const network_config = token_address[current_network] || token_address["default"];
        const address = network_config[contract_name];
        
        if (!address) {
            throw new Error(`Address for ${contract_name} not found on network ${current_network}`);
        }
        
        contract_addr = address;
    }
    return contract_addr
}

module.exports = { get_contract, deploy_mocks, contract_to_mock, toWei }
