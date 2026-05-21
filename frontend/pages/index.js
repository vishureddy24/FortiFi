import Link from "next/link";
import Head from 'next/head'
import Image from 'next/image'
import {
  useAccount,
  useBorrowAssets,
  useNetwork,
  useSupplyAssets,
  useYourBorrows,
  useYourSupplies,
} from "../components/hooks/web3";
import { useWeb3 } from "../components/providers/web3";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import eth from "../assets/eth.png";
import ERC20 from "../../abis/ADE.json";
import LARToken from "../../abis/LARToken.json";
import { trackPromise } from "react-promise-tracker";
import { todp } from "../utils/todp";
import EnterpriseLayout from "../components/ui/EnterpriseLayout";
import YourSupply from "../components/ui/YourSupplies";
import YourBorrows from "../components/ui/YourBorrows";
import SupplyAsset from "../components/ui/SupplyAssets";
import BorrowAssets from "../components/ui/BorrowAssets";
import ModalSupply from "../components/ui/ModalSupply";
import ModalWithdraw from "../components/ui/ModalWithdraw";
import ModalRepay from "../components/ui/ModalRepay";
import ModalBorrow from "../components/ui/ModalBorrow";
import RowSupplyAsset from "../components/ui/RowSupplyAsset";
import RowBorrowAsset from "../components/ui/RowBorrowAsset";
import SupplyRow from "../components/ui/SupplyRow";
import BorrowRow from "../components/ui/BorrowRow";
import GlobalLoading from "../components/ui/GlobalLoading";

export default function Home() {
  const { network } = useNetwork();
  const { requireInstall, isLoading, isReadOnly, isOffline, connect, reconnect, contract, web3, error } = useWeb3();
  const { account } = useAccount();
  const { tokens } = useSupplyAssets();
  const { tokensForBorrow } = useBorrowAssets();
  const { yourSupplies } = useYourSupplies();
  const { yourBorrows } = useYourBorrows();

  const IMAGES = {
    DAI: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSllrF9PNBf88kIx9USP5g73XDYjkMyRBaDig&usqp=CAU",
    WETH: "https://staging.aave.com/icons/tokens/weth.svg",
    LINK: "https://staging.aave.com/icons/tokens/link.svg",
    FAU: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT5qUPi3Ar2dQZ2m9K5opr_h9QaQz4_G5HVYA&usqp=CAU",
    LAR: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSqZs8PLHRLaGd4QfIvOYmCg30svx5dHp0y6A&usqp=CAU",
  };

  const [selectedTokenToSupply, setSelectedTokenToSupply] = useState(null);
  const [selectedTokenToBorrow, setSelectedTokenToBorrow] = useState(null);
  const [selectedTokenToWithdraw, setSelectedTokenToWithdraw] = useState(null);
  const [selectedTokenToRepay, setSelectedTokenToRepay] = useState(null);
  const [transactionHash, setTransactionHash] = useState(null);
  const [newSupply, setNewSupply] = useState(true);
  const [supplyError, setSupplyError] = useState(null);
  const [supplyResult, setSupplyResult] = useState(null);
  const [borrowingError, setBorrowingError] = useState(null);
  const [borrowingResult, setBorrowingResult] = useState(null);
  const [WithdrawError, setWithdrawError] = useState(null);
  const [WithdrawResult, setWithdrawResult] = useState(null);
  const [repayError, setRepayError] = useState(null);
  const [repayResult, setRepayResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionStep, setTransactionStep] = useState(null);
  const [walletCreditProfile, setWalletCreditProfile] = useState(null);

  const fetchWalletProfile = async (address) => {
    if (!address) return;
    try {
      const res = await fetch(`http://localhost:5001/api/wallet-profile/${address}`);
      const data = await res.json();
      setWalletCreditProfile(data);
    } catch (err) {
      console.warn("Failed to fetch wallet credit profile:", err.message);
    }
  };

  useEffect(() => {
    if (account.data?.address) {
      fetchWalletProfile(account.data.address);
    } else {
      setWalletCreditProfile(null);
    }
  }, [account.data?.address]);

  useEffect(() => {
    const socket = io("http://localhost:5001");
    socket.on("creditProfileUpdate", (data) => {
      if (account.data?.address && data.address === account.data.address.toLowerCase()) {
        setWalletCreditProfile(data.profile);
      }
    });
    return () => socket.disconnect();
  }, [account.data?.address]);

  const toWei = (value) => web3.utils.toWei(value.toString());

  const handleCloseModal = () => {
    setSupplyError(null); setSupplyResult(null); setBorrowingError(null); setBorrowingResult(null);
    setWithdrawError(null); setWithdrawResult(null); setRepayError(null); setRepayResult(null);
    setSelectedTokenToSupply(null); setSelectedTokenToBorrow(null); setSelectedTokenToWithdraw(null);
    setSelectedTokenToRepay(null); setTransactionHash(null); setTransactionStep(null);
  };

  const supplyToken = async (token, value) => {
    if (isProcessing) return;
    if (!account.data) return setSupplyError(new Error("Please connect your wallet first."));
    console.log("[FortiFi TX] Supplying", value, token.name, "from:", account.data);
    setIsProcessing(true);
    
    let NETWORK_ID = await web3.eth.net.getId();
    const tokenInst = new web3.eth.Contract(ERC20.abi, token.tokenAddress);
    const larToken = new web3.eth.Contract(ERC20.abi, LARToken.networks[NETWORK_ID].address);
    let requestId = web3.utils.soliditySha3(
      { t: 'address', v: account.data },
      { t: 'uint256', v: Date.now() },
      { t: 'uint256', v: Math.floor(Math.random() * 1000000000) }
    );
    if (!requestId) {
      requestId = web3.utils.sha3(account.data + Date.now() + Math.random());
    }

    try {
      const currentAllowance = await tokenInst.methods.allowance(account.data, contract.options.address).call();
      if (Number(currentAllowance) < Number(toWei(value))) {
        setTransactionStep(`Approving ${token.name}...`);
        await trackPromise(tokenInst.methods.approve(contract.options.address, toWei(value)).send({ from: account.data }));
      }
      
      setTransactionStep(`Supplying ${token.name}...`);
      const supplyResult = await trackPromise(contract.methods.lend(tokenInst.options.address, toWei(value), requestId).send({ from: account.data }));
      
      setSupplyResult(supplyResult);
      // Notify backend to record transaction and trigger portfolio/risk update
      try {
        await fetch('http://localhost:5001/api/portfolio/notify-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: account.data.toLowerCase(),
            txHash: supplyResult.transactionHash || supplyResult.txHash || requestId,
            type: 'Supply',
            asset: token.name || 'LAR',
            amount: Number(value),
            gasUsed: supplyResult.gasUsed || 0
          })
        }).catch(err => console.warn('notify-transaction failed', err));
      } catch (e) { /* swallow notify errors */ }
    } catch (err) { setSupplyError(err); } finally { setIsProcessing(false); }
  };

  const borrowToken = async (token, value) => {
    if (isProcessing) return;
    if (!account.data) return setBorrowingError(new Error("Please connect your wallet first."));
    console.log("[FortiFi TX] Borrowing", value, token.name, "from:", account.data);
    setIsProcessing(true);
    let requestId = web3.utils.soliditySha3(
      { t: 'address', v: account.data },
      { t: 'uint256', v: Date.now() },
      { t: 'string', v: "borrow" },
      { t: 'uint256', v: Math.floor(Math.random() * 1000000000) }
    );
    if (!requestId) {
      requestId = web3.utils.sha3(account.data + Date.now() + "borrow" + Math.random());
    }
    try {
      setTransactionStep(`Borrowing ${token.name}...`);
      const borrowingResult = await trackPromise(contract.methods.borrow(toWei(value), token.tokenAddress, requestId).send({ from: account.data }));
      setBorrowingResult(borrowingResult);
      // Notify backend to record transaction and trigger portfolio/risk update
      try {
        await fetch('http://localhost:5001/api/portfolio/notify-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: account.data.toLowerCase(),
            txHash: borrowingResult.transactionHash || borrowingResult.txHash || requestId,
            type: 'Borrow',
            asset: token.name || 'DAI',
            amount: Number(value),
            gasUsed: borrowingResult.gasUsed || 0
          })
        }).catch(err => console.warn('notify-transaction failed', err));
      } catch (e) { /* swallow notify errors */ }
    } catch (err) { setBorrowingError(err); } finally { setIsProcessing(false); }
  };

  const withdrawToken = async (token, value) => {
    if (isProcessing) return;
    if (!account.data) return setWithdrawError(new Error("Please connect your wallet first."));
    console.log("[FortiFi TX] Withdrawing", value, token.name, "from:", account.data);
    setIsProcessing(true);
    let requestId = web3.utils.soliditySha3(
      { t: 'address', v: account.data },
      { t: 'uint256', v: Date.now() },
      { t: 'string', v: "withdraw" },
      { t: 'uint256', v: Math.floor(Math.random() * 1000000000) }
    );
    if (!requestId) {
      requestId = web3.utils.sha3(account.data + Date.now() + "withdraw" + Math.random());
    }
    try {
      setTransactionStep(`Withdrawing ${token.name}...`);
      const withdrawResult = await trackPromise(contract.methods.withdraw(token.tokenAddress, toWei(value), requestId).send({ from: account.data }));
      setWithdrawResult(withdrawResult);
      // Notify backend to record transaction and trigger portfolio/risk update
      try {
        await fetch('http://localhost:5001/api/portfolio/notify-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: account.data.toLowerCase(),
            txHash: withdrawResult.transactionHash || withdrawResult.txHash || requestId,
            type: 'Withdraw',
            asset: token.name || 'DAI',
            amount: Number(value),
            gasUsed: withdrawResult.gasUsed || 0
          })
        }).catch(err => console.warn('notify-transaction failed', err));
        // optimistic refresh
        fetchWalletProfile(account.data.address);
      } catch (e) { /* swallow notify errors */ }
    } catch (err) { setWithdrawError(err); } finally { setIsProcessing(false); }
  };

  const repayToken = async (token, value) => {
    if (isProcessing) return;
    if (!account.data) return setRepayError(new Error("Please connect your wallet first."));
    console.log("[FortiFi TX] Repaying", value, token.name, "from:", account.data);
    setIsProcessing(true);
    const tokenToRepay = new web3.eth.Contract(ERC20.abi, token.tokenAddress);
    const interest = Number(token.borrowAPYRate) * Number(toWei(value));
    const amountToPayBack = (Number(toWei(value)) + interest).toString();
    let requestId = web3.utils.soliditySha3(
      { t: 'address', v: account.data },
      { t: 'uint256', v: Date.now() },
      { t: 'string', v: "repay" },
      { t: 'uint256', v: Math.floor(Math.random() * 1000000000) }
    );
    if (!requestId) {
      requestId = web3.utils.sha3(account.data + Date.now() + "repay" + Math.random());
    }
    try {
      const currentAllowance = await tokenToRepay.methods.allowance(account.data, contract.options.address).call();
      if (Number(currentAllowance) < Number(toWei(amountToPayBack))) {
        setTransactionStep(`Approving ${token.name}...`);
        await trackPromise(tokenToRepay.methods.approve(contract.options.address, toWei(amountToPayBack)).send({ from: account.data }));
      }
      
      setTransactionStep(`Repaying ${token.name}...`);
      const repayResult = await trackPromise(contract.methods.payDebt(token.tokenAddress, toWei(value), requestId).send({ from: account.data }));
      setRepayResult(repayResult);
      // Notify backend to record transaction and trigger portfolio/risk update
      try {
        await fetch('http://localhost:5001/api/portfolio/notify-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: account.data.toLowerCase(),
            txHash: repayResult.transactionHash || repayResult.txHash || requestId,
            type: 'Repay',
            asset: token.name || 'DAI',
            amount: Number(value),
            gasUsed: repayResult.gasUsed || 0
          })
        }).catch(err => console.warn('notify-transaction failed', err));
        // optimistic refresh
        fetchWalletProfile(account.data.address);
      } catch (e) { /* swallow notify errors */ }
    } catch (err) { setRepayError(err); } finally { setIsProcessing(false); }
  };

  // Metamask Utility Methods
  const addTokenToMetamask = async (token) => {
    try {
      await ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: token.tokenAddress,
            symbol: token.name,
            decimals: token.decimals,
            image: IMAGES[token.name],
          },
        },
      });
    } catch (error) { console.log(error); }
  };

  const addLAR = async (token) => {
    let NETWORK_ID = await web3.eth.net.getId();
    try {
      await ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: LARToken.networks[NETWORK_ID].address,
            symbol: "LAR",
            decimals: 18,
            image: IMAGES["LAR"],
          },
        },
      });
    } catch (error) { console.log(error); }
  };

  if (isLoading) return <GlobalLoading error={error} />;

  return (
    <EnterpriseLayout title="Lending Workspace">
      {/* Connection Status Banners */}
      {(isOffline || isReadOnly || error) && (
        <div className={`py-3 px-6 mb-8 rounded-2xl flex items-center justify-between gap-3 ${isOffline ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-2.5 w-2.5 rounded-full animate-pulse ${isOffline ? 'bg-red-500' : 'bg-amber-500'}`}></span>
            <p className={`text-xs font-bold uppercase tracking-wider ${isOffline ? 'text-red-400' : 'text-amber-400'}`}>
              {isOffline ? "Local Blockchain Offline — Analytics Mode Active" : error}
              {isReadOnly && " | Connect MetaMask for full protocol interaction."}
            </p>
          </div>
          {isOffline ? (
            <button onClick={() => reconnect()} className="text-[10px] bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-xl transition-all font-black uppercase tracking-wider">
              Retry Connection
            </button>
          ) : isReadOnly ? (
            <button onClick={() => connect()} className="text-[10px] bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-xl transition-all font-black uppercase tracking-wider">
              Connect Wallet
            </button>
          ) : null}
        </div>
      )}

      {/* Header and Networth Metrics */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Lending <span className="text-blue-500">Workspace</span>
          </h1>
          <p className="mt-2 text-gray-400">Institutional capital pooling and dynamic liquidity operations.</p>
        </div>

        <div className="flex gap-4 items-center">
          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-xl">💰</div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-black block">Net Worth</span>
              <span className="text-lg font-black text-white">
                ${isNaN(yourSupplies.data?.yourBalance - yourBorrows.data?.yourBalance) ? "0.00" : todp(yourSupplies.data?.yourBalance - yourBorrows.data?.yourBalance, 2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Credit Line Status Card */}
      {account.data?.address && walletCreditProfile && (
        <div className="mb-10 p-6 bg-gradient-to-r from-blue-950/40 to-slate-900/60 border border-blue-500/20 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden animate-fade-in">
          {/* Subtle Background Glows */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-500/20">
                  Decentralized Credit Profile
                </span>
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">
                  {walletCreditProfile.accountTier}
                </span>
                {!walletCreditProfile.borrowEligibility && (
                  <span className="px-3 py-1 bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-red-500/20 animate-bounce">
                    BORROWING SUSPENDED
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Adaptive Borrowing Credit-Line</h2>
              <p className="text-xs text-gray-400 max-w-xl">
                Decentralized credit limits dynamically restore upon debt repayments, and scale dynamically as you build positive transaction history and trust metrics.
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto shrink-0">
              <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                <span className="text-[10px] text-gray-500 uppercase font-black block">Credit Limit</span>
                <span className="text-lg font-black text-white">{walletCreditProfile.totalBorrowLimit} DAI</span>
              </div>
              <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                <span className="text-[10px] text-blue-400 uppercase font-black block">Available Credit</span>
                <span className="text-lg font-black text-blue-400">{walletCreditProfile.availableBorrowLimit?.toFixed(2)} DAI</span>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                <span className="text-[10px] text-gray-500 uppercase font-black block">Active Debt</span>
                <span className="text-lg font-black text-amber-500">{walletCreditProfile.borrowedOutstanding?.toFixed(2)} DAI</span>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                <span className="text-[10px] text-gray-500 uppercase font-black block">Trust Score</span>
                <span className="text-lg font-black text-emerald-400">{walletCreditProfile.trustScore} pts</span>
              </div>
            </div>
          </div>
          
          {/* Progress / Credit Utilization Meter */}
          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-400 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Credit Range:</span>
              <span className="px-2 py-0.5 bg-white/5 rounded text-gray-300 font-mono">Min: {walletCreditProfile.minimumBorrowAmount} DAI</span>
              <span className="text-gray-600">—</span>
              <span className="px-2 py-0.5 bg-white/5 rounded text-gray-300 font-mono">Max: {walletCreditProfile.maximumBorrowAmount} DAI</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Repayments: <strong className="text-emerald-400">{walletCreditProfile.repaymentCount}</strong></span>
              <span className="text-gray-600">|</span>
              <span>Risk Index: <strong className={walletCreditProfile.riskScore > 40 ? "text-amber-400" : "text-emerald-400"}>{walletCreditProfile.riskScore}%</strong></span>
            </div>
          </div>
        </div>
      )}

      <div className="w-full">
            <div className="flex flex-wrap mt-4">
              <div className="w-full xl:w-6/12 xl:mb-0 px-2">
                <YourSupply tokens={yourSupplies.data?.yourSupplies} balance={yourSupplies.data?.yourBalance}>
                  {(token) => (
                    <SupplyRow key={token.tokenAddress} token={token} 
                      Withdraw={() => <button onClick={() => setSelectedTokenToWithdraw(token)} className="bg-gray-700 text-base text-white p-2 rounded-md">Withdraw</button>}
                      Supply={() => <button onClick={() => setSelectedTokenToSupply(token)} className="ml-2 border border-gray-400 text-base font-medium text-gray-800 p-2 rounded-md">Supply</button>}
                    />
                  )}
                </YourSupply>
              </div>
              <div className="w-full xl:w-6/12 px-2">
                <YourBorrows tokens={yourBorrows.data?.yourBorrows} balance={yourBorrows.data?.yourBalance}>
                  {(token) => (
                    <BorrowRow token={token} key={token.tokenAddress}
                      Repay={() => <button onClick={() => setSelectedTokenToRepay(token)} className="bg-gray-700 text-base text-white p-2 rounded-md">Repay</button>}
                      Borrow={() => <button onClick={() => setSelectedTokenToBorrow(token)} className="ml-2 border border-gray-400 text-base font-medium text-gray-800 p-2 rounded-md">Borrow</button>}
                    />
                  )}
                </YourBorrows>
              </div>
            </div>

            <div className="flex flex-wrap mt-4">
              <div className="w-full xl:w-6/12 px-2">
                <SupplyAsset tokens={tokens.data}>
                  {(token) => (
                    <RowSupplyAsset token={token} key={token.tokenAddress}
                      Supply={() => <button onClick={() => setSelectedTokenToSupply(token)} className="bg-gray-700 text-base text-white p-2 rounded-md">Supply</button>}
                      Details={() => web3 && contract && (
                        <Link href={{ pathname: `/reserve-overview/${token.name}`, query: { ...token, userTotalSupplyBalance: yourSupplies.data?.yourBalance } }}>
                          <a className="ml-2 border border-gray-400 text-base font-medium text-gray-800 p-2 rounded-md">Details</a>
                        </Link>
                      )}
                    />
                  )}
                </SupplyAsset>
              </div>
              <div className="w-full xl:w-6/12 px-2">
                <BorrowAssets tokens={tokensForBorrow.data}>
                  {(token) => (
                    <RowBorrowAsset token={token} key={token.tokenAddress} balance={yourSupplies.data?.yourBalance}
                      Borrow={() => <button onClick={() => setSelectedTokenToBorrow(token)} className="bg-gray-700 text-base text-white p-2 rounded-md">Borrow</button>}
                      Details={() => (
                        <Link href={{ pathname: `/reserve-overview/${token.name}`, query: { ...token, userTotalSupplyBalance: yourSupplies.data?.yourBalance } }}>
                          <a className="ml-2 border border-gray-400 text-base font-medium text-gray-800 p-2 rounded-md">Details</a>
                        </Link>
                      )}
                    />
                  )}
                </BorrowAssets>
              </div>
            </div>
          </div>

      {/* Modals */}
      <div className="flex justify-center text-center sm:block sm:p-0 mt-2">
        {selectedTokenToSupply && <ModalSupply token={selectedTokenToSupply} supplyError={supplyError} supplyResult={supplyResult} transactionHash={transactionHash} addLAR={addLAR} closeModal={handleCloseModal} onSupply={supplyToken} transactionStep={transactionStep} />}
        {selectedTokenToBorrow && <ModalBorrow token={selectedTokenToBorrow} closeModal={handleCloseModal} balance={yourSupplies.data?.yourBalance} onBorrow={borrowToken} borrowingError={borrowingError} borrowingResult={borrowingResult} addBorrowedToken={addTokenToMetamask} transactionStep={transactionStep} walletCreditProfile={walletCreditProfile} />}
        {selectedTokenToWithdraw && <ModalWithdraw token={selectedTokenToWithdraw} closeModal={handleCloseModal} onWithdraw={withdrawToken} withdrawError={WithdrawError} withdrawResult={WithdrawResult} addTokenToMetamask={addTokenToMetamask} contract={contract} web3={web3} transactionStep={transactionStep} />}
        {selectedTokenToRepay && web3 && <ModalRepay token={selectedTokenToRepay} closeModal={handleCloseModal} onRepay={repayToken} repayError={repayError} repayResult={repayResult} web3={web3} transactionStep={transactionStep} />}
      </div>
    </EnterpriseLayout>
  );
}
