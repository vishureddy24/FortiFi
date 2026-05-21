// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title RiskController
 * @dev Autonomous security controller for the DeFi protocol.
 * Handles risk scores, dynamic collateral ratios, and emergency modes.
 */
contract RiskController is Ownable, Pausable {
    
    // Mapping of user address to risk score (0-10)
    mapping(address => uint256) public userRiskScores;
    
    // Mapping of token address to dynamic LTV (Loan-To-Value)
    mapping(address => uint256) public dynamicLTV;
    
    // Emergency Mode: if true, certain actions are restricted globally
    bool public emergencyMode;

    // Mapping of blacklisted wallets
    mapping(address => bool) public blacklistedWallets;
    
    event RiskScoreUpdated(address indexed user, uint256 newScore);
    event EmergencyModeToggled(bool active);
    event WalletBlacklisted(address indexed wallet, bool blacklisted);
    event DynamicLTVUpdated(address indexed token, uint256 newLTV);

    /**
     * @dev Blacklists or unblacklists a wallet.
     */
    function setBlacklist(address wallet, bool blacklisted) external onlyOwner {
        blacklistedWallets[wallet] = blacklisted;
        emit WalletBlacklisted(wallet, blacklisted);
    }

    constructor() {
        emergencyMode = false;
    }

    /**
     * @dev Updates the risk score for a specific user. 
     * Usually called by the backend security engine.
     */
    function updateRiskScore(address user, uint256 score) external onlyOwner {
        require(score <= 10, "Score must be between 0 and 10");
        userRiskScores[user] = score;
        emit RiskScoreUpdated(user, score);
    }

    /**
     * @dev Sets the global emergency mode.
     */
    function setEmergencyMode(bool active) external onlyOwner {
        emergencyMode = active;
        if (active) {
            _pause();
        } else {
            _unpause();
        }
        emit EmergencyModeToggled(active);
    }

    /**
     * @dev Adjusts the LTV ratio for a token dynamically.
     */
    function adjustCollateralRatio(address token, uint256 newLTV) external onlyOwner {
        require(newLTV <= 1e18, "LTV cannot exceed 100%");
        dynamicLTV[token] = newLTV;
        emit DynamicLTVUpdated(token, newLTV);
    }

    /**
     * @dev Returns if a user is allowed to perform a high-risk action.
     * Restrictions apply if risk score is high or emergency mode is on.
     */
    function isActionAllowed(address user) external view returns (bool) {
        if (emergencyMode) return false;
        if (blacklistedWallets[user]) return false;
        if (userRiskScores[user] >= 7) return false; // High risk threshold
        return true;
    }

    /**
     * @dev Returns the effective LTV for a token, considering dynamic adjustments.
     */
    function getEffectiveLTV(address token, uint256 defaultLTV) external view returns (uint256) {
        if (dynamicLTV[token] > 0) {
            return dynamicLTV[token];
        }
        return defaultLTV;
    }
}
