import ade from "../../abis/ADE.json";
import dai from "../assets/dai.svg";
import weth from "../assets/weth.svg";
import link from "../assets/chainlink.svg";
import fau from "../assets/fau_2.png";

const tokenImages = {
  DAI: dai,
  WETH: weth,
  LINK: link,
  FAU: fau,
};

const withTimeout = (promise, ms, defaultValue) => {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(defaultValue), ms))
  ]);
};

export const normalizeToken = async (web3, contract, currentToken) => {
  const fromWei = (amount) => (amount ? web3.utils.fromWei(amount.toString()) : "0");

  try {
    if (!web3 || !contract) return { name: currentToken.name, error: "Web3 not initialized" };

    // Safety check: Verify contract has code at the address
    const code = await web3.eth.getCode(contract.options.address);
    if (code === "0x" || code === "0x0") {
       throw new Error(`No contract code found at ${contract.options.address}. Please ensure contracts are deployed.`);
    }

    const accounts = await web3.eth.getAccounts();
    const account = accounts[0] || "0x0000000000000000000000000000000000000000";

    const tokenInst = new web3.eth.Contract(ade.abi, currentToken.tokenAddress);
    
    // Verify token contract code too
    const tokenCode = await web3.eth.getCode(currentToken.tokenAddress);
    if (tokenCode === "0x" || tokenCode === "0x0") {
       console.warn(`[Normalize] No code at token address ${currentToken.tokenAddress} for ${currentToken.name}`);
       return { name: currentToken.name, error: "Token not deployed" };
    }

    console.log(`[Normalize] Fetching data for ${currentToken.name}...`);

    const data = await withTimeout(
      Promise.all([
        tokenInst.methods.decimals().call().catch(() => "18"),
        tokenInst.methods.balanceOf(account).call().catch(() => "0"),
        contract.methods.getTotalTokenSupplied(currentToken.tokenAddress).call(),
        contract.methods.getTotalTokenBorrowed(currentToken.tokenAddress).call(),
        contract.methods.tokensBorrowedAmount(currentToken.tokenAddress, account).call(),
        contract.methods.tokensLentAmount(currentToken.tokenAddress, account).call(),
        contract.methods.getTokenAvailableToWithdraw(account).call(),
        contract.methods.getUserTotalAmountAvailableForBorrowInDollars(account).call(),
        contract.methods.oneTokenEqualsHowManyDollars(currentToken.tokenAddress).call()
      ]),
      8000,
      null
    );

    if (!data) {
      return { name: currentToken.name, error: "Timeout" };
    }

    const [
      decimals, walletBalance, totalSupplied, totalBorrowed, 
      userBorrowed, userLent, availToWithdraw, availToBorrow, 
      priceResult
    ] = data;

    const utilizationRate = totalSupplied !== "0" 
      ? (Number(totalBorrowed) * 100) / Number(totalSupplied) 
      : 0;

    const price = priceResult ? (priceResult[0] || "0") : "0";
    const decimal = priceResult ? (priceResult[1] || "18") : "18";
    const oneTokenToDollar = parseFloat(price) / (10 ** parseInt(decimal));

    return {
      name: currentToken.name,
      image: tokenImages[currentToken.name],
      tokenAddress: currentToken.tokenAddress,
      userTotalAmountAvailableToWithdrawInDollars: fromWei(availToWithdraw),
      userTotalAmountAvailableForBorrowInDollars: fromWei(availToBorrow),
      walletBalance: {
        amount: fromWei(walletBalance),
        inDollars: (parseFloat(fromWei(walletBalance)) * oneTokenToDollar).toString(),
      },
      totalSuppliedInContract: {
        amount: fromWei(totalSupplied),
        inDollars: (parseFloat(fromWei(totalSupplied)) * oneTokenToDollar).toString(),
      },
      totalBorrowedInContract: {
        amount: fromWei(totalBorrowed),
        inDollars: (parseFloat(fromWei(totalBorrowed)) * oneTokenToDollar).toString(),
      },
      availableAmountInContract: {
        amount: fromWei((BigInt(totalSupplied || "0") - BigInt(totalBorrowed || "0")).toString()),
        inDollars: ((parseFloat(fromWei(totalSupplied)) - parseFloat(fromWei(totalBorrowed))) * oneTokenToDollar).toString(),
      },
      userTokenBorrowedAmount: {
        amount: fromWei(userBorrowed),
        inDollars: (parseFloat(fromWei(userBorrowed)) * oneTokenToDollar).toString(),
      },
      userTokenLentAmount: {
        amount: fromWei(userLent),
        inDollars: (parseFloat(fromWei(userLent)) * oneTokenToDollar).toString(),
      },
      LTV: web3.utils.fromWei(currentToken.LTV || "0"),
      borrowAPYRate: web3.utils.fromWei(currentToken.stableRate || "0"),
      utilizationRate,
      oneTokenToDollar,
      decimals
    };
  } catch (err) {
    console.error(`[Normalize Error] ${currentToken.name}:`, err.message);
    throw err; // Re-throw to trigger SWR error state
  }
};
