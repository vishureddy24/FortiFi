const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');

async function test() {
    try {
        const accounts = await web3.eth.getAccounts();
        console.log('Connected! Accounts:', accounts);
    } catch (e) {
        console.error('Failed to connect:', e);
    }
}

test();
