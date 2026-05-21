import Image from "next/image";
import correct from "../../assets/correct.png";
import { todp } from "../../utils/todp";
import { useState } from "react";
import { LoadingSpinerComponent } from "../../utils/Spinner";
import { convertToDollar } from "../../utils/helpfulScripts";
import BorderLayout from "./BorderLayout";
import { usePromiseTracker } from "react-promise-tracker";

export default function ModalBorrow({
  token,
  closeModal,
  balance,
  onBorrow,
  borrowingError,
  borrowingResult,
  addBorrowedToken,
  transactionStep,
  walletCreditProfile
}) {
  const { promiseInProgress } = usePromiseTracker();

  let actualAvailable = "0.00";
  let actualAvailableInDollars = "0";

  const userTotalAmountAvailableForBorrowInDollars =
    token.userTotalAmountAvailableForBorrowInDollars;

  const tokenEquivalent =
    (userTotalAmountAvailableForBorrowInDollars /
      parseFloat(token.oneTokenToDollar));

  const tokenAvailableInContract = token.availableAmountInContract ? parseFloat(
    token.availableAmountInContract.amount
  ) : 0;
  const tokenAvailableInContractInDollars = convertToDollar(
    token,
    tokenAvailableInContract
  );

  if (tokenAvailableInContract >= tokenEquivalent) {
    actualAvailable = tokenEquivalent;
    actualAvailableInDollars = convertToDollar(token, actualAvailable);
  } else {
    actualAvailable = tokenAvailableInContract;
    actualAvailableInDollars = tokenAvailableInContractInDollars;
  }

  let creditAvailable = parseFloat(actualAvailable) || 0;
  if (token?.name === "DAI") {
    const limit = walletCreditProfile ? walletCreditProfile.availableBorrowLimit : 200;
    creditAvailable = Math.min(tokenAvailableInContract, limit);
  } else if (walletCreditProfile) {
    creditAvailable = Math.min(creditAvailable, walletCreditProfile.availableBorrowLimit);
  }

  const [value, setValue] = useState("");
  const [valueInDollars, setValueInDollars] = useState("0");

  const MIN_BORROW = token?.name === "DAI" ? 50 : 0.0001;
  const availableBorrow = token?.name === "DAI"
    ? (walletCreditProfile ? walletCreditProfile.availableBorrowLimit : 200)
    : creditAvailable;
  const effectiveAvailable = token?.name === "DAI" ? (availableBorrow || 200) : availableBorrow;

  const belowMinimum = Number(value) < MIN_BORROW;
  const exceedsLimit = Number(value) > effectiveAvailable;
  const canBorrow =
    Number(value) >= MIN_BORROW &&
    Number(value) <= effectiveAvailable &&
    !promiseInProgress;

  return (
    <BorderLayout>
      {/* <!-- Modal header --> */}
      <div className="p-5">
        <div className="flex justify-between items-center rounded-t">
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">
            {borrowingResult?.transactionHash
              ? `Sucessful`
              : `Borrow ${token?.name}`}
          </h3>
          <button
            onClick={() => {
              setValue("");
              setValueInDollars("0.00");
              closeModal();
            }}
            disabled={promiseInProgress}
            type="button"
            className={`text-gray-400 bg-transparent ${
              promiseInProgress
                ? "text-gray-200"
                : "dark:hover:bg-gray-600 dark:hover:text-white hover:bg-gray-200 hover:text-gray-900"
            }  rounded-lg text-sm p-1.5 ml-auto inline-flex items-center `}
            data-modal-toggle="small-modal"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              ></path>
            </svg>
          </button>
        </div>

        {/* <div className="p-2 mt-2 rounded-md bg-orange-200 ">
                <p className="">Wrong Network. Please switch to Kovan</p>
              </div> */}
      </div>
      {/* <!-- Modal body --> */}
      {borrowingResult?.transactionHash ? (
        <div className="flex flex-col justify-center items-center">
          <Image
            src={correct}
            width={60}
            height={60}
            layout="fixed"
            className="card-img-top"
            alt="coinimage"
          />
          <div className="font-bold mt-4">All Done!</div>
          <p>
            You borrowed {value} {token?.name}
          </p>
          <button
            onClick={() => addBorrowedToken(token)}
            className="p-1 border my-3 border-gray-800 text-sm font-medium rounded-md"
          >
            {" "}
            + Add {token?.name} to the Wallet
          </button>

          <button
            onClick={() => {
              window.open(
                `https://kovan.etherscan.io/tx/${borrowingResult.transactionHash}`,
                "_blank"
              );
            }}
            className="text-sm self-end pr-3 mt-3 text-gray-500 "
          >
            Review tx details
          </button>

          <div className="flex w-full items-center p-6 space-x-2 rounded-b border-gray-200 dark:border-gray-600">
            <button
              onClick={() => {
                setValue("");
                setValueInDollars("0.00");
                closeModal();
              }}
              data-modal-toggle="small-modal"
              type="button"
              className="text-white w-full bg-gray-800  hover:bg-gray-900 hover:text-white rounded-md p-3"
            >
              <div className="flex justify-center ">Ok, Close.</div>
              {/*  */}
            </button>
          </div>
        </div>
      ) : (
        <div>
          {" "}
          <div className="p-6 pt-1 space-y-1">
            <div className="flex justify-between items-center mb-1">
              <p className="text-base leading-relaxed text-gray-400">
                Amount
              </p>
              {walletCreditProfile && (
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest animate-pulse">
                  Borrow range: 50–{walletCreditProfile.maximumBorrowAmount} DAI
                </p>
              )}
            </div>
            <div className="flex flex-col items-center border rounded-md p-2 border-white/10 bg-black/20">
              <div className="w-full flex items-center">
                <input
                  onChange={(event) => {
                    const { value } = event.target;
                    if (isNaN(value)) {
                      return;
                    }

                    let usableValue = "0.00";
                    if (value) {
                      usableValue = parseFloat(value) * token?.oneTokenToDollar;
                    }

                    setValueInDollars(usableValue);
                    setValue(value);
                  }}
                  value={value}
                  type="text"
                  name="text"
                  id="text"
                  placeholder="0.00"
                  className="w-80 block pl-2 p-1 font-medium sm:text-lg focus:outline-none rounded-md bg-transparent text-white placeholder-gray-600"
                />
                {token && (
                  <Image
                    src={token.image}
                    width={30}
                    height={30}
                    layout="fixed"
                    className="ml-2 card-img-top"
                    alt="coinimage"
                  />
                )}

                <p className="font-medium text-sm ml-2 text-gray-300">{token?.name}</p>
              </div>

              <div className="w-full justify-between flex items-center mt-2">
                <p className="pl-2 pt-0 mt-0 font-medium text-sm text-gray-500">
                  ${todp(valueInDollars, 4)}
                </p>
                <div className="flex items-center">
                  <p className="font-medium text-sm text-gray-400">
                    Max Available: {todp(effectiveAvailable, 3)}
                  </p>
                  <button
                    onClick={() => {
                      setValue(effectiveAvailable);
                      setValueInDollars(todp(effectiveAvailable * token?.oneTokenToDollar, 3));
                    }}
                    className="font-black ml-2 text-blue-400 hover:text-blue-300 text-sm uppercase tracking-wider"
                  >
                    MAX
                  </button>
                </div>
              </div>
            </div>
            
            {/* Real-time Dynamic Warnings */}
            {walletCreditProfile && !walletCreditProfile.borrowEligibility && (
              <p className="text-xs font-bold text-red-400 mt-2 animate-bounce uppercase tracking-wider">
                ⚠️ Borrowing is suspended due to high risk index
              </p>
            )}
            {value && belowMinimum && (
              <p className="text-xs font-bold text-amber-400 mt-2 animate-pulse uppercase tracking-wider">
                ⚠️ Minimum borrow amount is 50 DAI
              </p>
            )}
            {value && exceedsLimit && (
              <p className="text-xs font-bold text-amber-400 mt-2 animate-pulse uppercase tracking-wider">
                ⚠️ Amount exceeds dynamic credit-line borrowing limit
              </p>
            )}
          </div>
          
          <div className="p-6 pt-1 ">
            <p className="text-base leading-relaxed text-gray-400">
              Borrow APY Rate
            </p>
            <div className="flex flex-col w-4/12 items-center bg-white/5 border rounded-xl p-2 border-white/5 mt-1">
              <p className="text-emerald-400 self-start text-xs font-bold uppercase tracking-wider">
                Stable: {Number(token?.borrowAPYRate * 100).toFixed(2)}%
              </p>
            </div>
            {borrowingError && (
              <div className="text-red-400 text-sm mt-5 bg-red-950/20 border border-red-500/20 rounded-md p-2 font-medium">
                {borrowingError.message}
              </div>
            )}
          </div>
          
          {/* <!-- Modal footer --> */}
          <div className="flex w-full items-center p-6 space-x-2 rounded-b">
            <button
              disabled={
                !canBorrow ||
                (walletCreditProfile && !walletCreditProfile.borrowEligibility)
              }
              onClick={() => onBorrow(token, value)}
              data-modal-toggle="small-modal"
              type="button"
              className={`${
                promiseInProgress
                  ? "bg-gray-700 cursor-wait"
                  : (walletCreditProfile && !walletCreditProfile.borrowEligibility)
                  ? "bg-red-500/10 border border-red-500/30 text-red-400 cursor-not-allowed"
                  : (value && belowMinimum) || exceedsLimit
                  ? "bg-amber-500/10 border border-amber-500/30 text-amber-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 "
              } text-white w-full rounded-2xl p-3 font-bold uppercase tracking-widest text-xs transition-all`}
            >
              <div className="flex justify-center ">
                <LoadingSpinerComponent
                  buttonText={
                    walletCreditProfile && !walletCreditProfile.borrowEligibility
                      ? "SUSPENDED"
                      : value && belowMinimum
                      ? "MINIMUM NOT MET"
                      : exceedsLimit
                      ? "EXCEEDS LIMIT"
                      : `Borrow ${token?.name}`
                  }
                  loadingMessage={transactionStep || `Borrowing ${token?.name}`}
                />
              </div>
            </button>
          </div>{" "}
        </div>
      )}
    </BorderLayout>
  );
}
