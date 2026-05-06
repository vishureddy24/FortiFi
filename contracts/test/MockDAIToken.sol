// SPDX-License-Identifier: MIT

pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockDAIToken is ERC20{
    constructor() ERC20("DAI Token", "DAI"){
        _mint(msg.sender, 1000000 * 10**18);
    }

    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}