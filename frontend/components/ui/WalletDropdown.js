import React, { useState, useRef, useEffect } from "react";
import { createPopper } from "@popperjs/core";
import { useAccount, useNetwork } from "../hooks/web3";
import { useWeb3 } from "../providers/web3";

const WalletDropdown = () => {
  const { account } = useAccount();
  const { network } = useNetwork();
  const { web3, connect, isReadOnly } = useWeb3();
  const [dropdownPopoverShow, setDropdownPopoverShow] = useState(false);
  const btnDropdownRef = useRef();
  const popoverDropdownRef = useRef();

  const openDropdownPopover = () => {
    createPopper(btnDropdownRef.current, popoverDropdownRef.current, {
      placement: "bottom-end",
    });
    setDropdownPopoverShow(true);
  };

  const closeDropdownPopover = () => {
    setDropdownPopoverShow(false);
  };

  const copyAddress = () => {
    if (account.data) {
      navigator.clipboard.writeText(account.data);
      alert("Address copied to clipboard!");
    }
  };

  const switchAccount = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (error) {
        console.error("User denied account switch");
      }
    }
  };

  const refreshWallet = () => {
    window.location.reload();
  };

  // Helper to shorten address
  const shortAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getRoleBadge = () => {
    if (account.isAdmin) return { label: "Admin", color: "bg-purple-600" };
    if (account.isBlacklisted) return { label: "Blacklisted", color: "bg-red-600" };
    if (account.riskScore >= 7) return { label: "High Risk", color: "bg-orange-600" };
    return { label: "User", color: "bg-green-600" };
  };

  const badge = getRoleBadge();

  return (
    <>
      <div className="flex items-center">
        <button
          className="flex items-center bg-gray-800 border border-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-all duration-200"
          ref={btnDropdownRef}
          onClick={(e) => {
            e.preventDefault();
            dropdownPopoverShow ? closeDropdownPopover() : openDropdownPopover();
          }}
        >
          <div className="flex flex-col items-end mr-2">
            <span className="text-xs font-bold text-gray-400">
              {network.data || "Unknown Network"}
            </span>
            <span className="text-sm font-mono">
              {account.data ? shortAddress(account.data) : "Not Connected"}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center border border-gray-500 shadow-lg">
            <span className="text-xs font-bold">W</span>
          </div>
        </button>

        <div
          ref={popoverDropdownRef}
          className={
            (dropdownPopoverShow ? "block " : "hidden ") +
            "bg-gray-900 border border-gray-700 text-white z-50 float-left py-2 list-none text-left rounded-xl shadow-2xl mt-1 min-w-[240px]"
          }
        >
          {/* Wallet Header */}
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Current Wallet</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full text-white font-bold ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            <div className="text-sm font-mono text-blue-400 mb-2 truncate">
              {account.data || "0x..."}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-gray-800 p-2 rounded-lg border border-gray-700">
                <div className="text-[9px] text-gray-500 font-bold uppercase">Balance</div>
                <div className="text-xs font-bold">{account.balance || "0.00"} ETH</div>
              </div>
              <div className="bg-gray-800 p-2 rounded-lg border border-gray-700">
                <div className="text-[9px] text-gray-500 font-bold uppercase">Risk Score</div>
                <div className="text-xs font-bold text-orange-400">{account.riskScore || "0"}/10</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              onClick={switchAccount}
              className="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
            >
              <span className="mr-2">🔄</span> Switch Account
            </button>
            <button
              onClick={copyAddress}
              className="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
            >
              <span className="mr-2">📋</span> Copy Address
            </button>
            <button
              onClick={refreshWallet}
              className="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
            >
              <span className="mr-2">⌛</span> Refresh Wallet
            </button>
          </div>

          <div className="h-px bg-gray-800 my-1" />

          <div className="py-1">
            {account.isAdmin && (
              <a
                href="/security"
                className="flex items-center w-full text-left px-4 py-2 text-sm text-purple-400 hover:bg-gray-800 transition-colors font-bold"
              >
                <span className="mr-2">🛡️</span> Governance Panel
              </a>
            )}
            <button
              onClick={() => window.location.href = "/profile"}
              className="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
            >
              <span className="mr-2">👤</span> View Profile
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-800 transition-colors"
            >
              <span className="mr-2">🔌</span> Disconnect
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default WalletDropdown;
