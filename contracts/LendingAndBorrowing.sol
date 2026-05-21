// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
import "./LendingHelper.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./RiskController.sol";

contract LendingAndBorrowing is Ownable, Pausable, ReentrancyGuard {
    using LendingHelper for address;

    address[] public lenders;
    address[] public borrowers;

    // {tokenAddres: {userAddr : amount}}
    mapping(address => mapping(address => uint256)) public tokensLentAmount;
    mapping(address => mapping(address => uint256)) public tokensBorrowedAmount;

    // {noOfTokensLent[1,2,3,4]: {userAddr: tokenAddres}}
    mapping(uint256 => mapping(address => address)) public tokensLent;
    mapping(uint256 => mapping(address => address)) public tokensBorrowed;

    mapping(address => address) public tokenToPriceFeed;

    uint256 public growthStep = 100 * 10**18;
    uint256 public maxLimit = 1000 * 10**18;

    // Layer 6: Transaction Nonce/Request Protection
    mapping(bytes32 => bool) public processedRequests;
    event RequestProcessed(bytes32 indexed requestId, address indexed user);

    struct AccountBorrowProfile {
        uint256 totalBorrowLimit;
        uint256 availableBorrowLimit;
        uint256 borrowedOutstanding;
        uint256 repaymentCount;
        uint256 trustScore;
        uint256 riskScore;
        uint256 accountTier;
        uint256 minimumBorrowAmount;
        uint256 maximumBorrowAmount;
        bool borrowEligibility;
    }

    mapping(address => AccountBorrowProfile) public accountBorrowProfiles;

    event CreditProfileUpdated(
        address indexed user,
        uint256 totalBorrowLimit,
        uint256 availableBorrowLimit,
        uint256 borrowedOutstanding,
        uint256 repaymentCount,
        uint256 trustScore,
        uint256 riskScore,
        uint256 accountTier,
        bool borrowEligibility
    );

    event Withdraw(
        address indexed protocol,
        address indexed user,
        address asset,
        uint256 amount,
        uint256 timestamp
    );
    event Repay(
        address indexed payer,
        address indexed protocol,
        address asset,
        uint256 amount,
        uint256 timestamp
    );
    event Borrow(
        address indexed borrower,
        address indexed lenderPool,
        address asset,
        uint256 amount,
        uint256 timestamp
    );
    event Supply(
        address indexed from,
        address indexed to,
        address asset,
        uint256 amount,
        uint256 timestamp
    );
    event WithdrawTesting(address sender,uint256 tokentoWithdrawInDollars,uint256 availableToWithdraw);
    event BorrowTesting1(address sender,uint256 amountInDollars,uint256 totalAmountAvailableForBorrowInDollars);
    event BorrowTesting2(address sender, uint256 balance, uint256 amount);
    event RepayTesting1(address sender, int256 index);
    event RepayTesting2(address sender, uint256 tokenBorrowed);

    struct Token {
        address tokenAddress;
        uint256 LTV;
        uint256 stableRate;
        string name;
    }

    //Array of Struct Token [Dai, Weth, Fau, Link]
    Token[] public tokensForLending;
    Token[] public tokensForBorrowing;

    IERC20 public larToken;
    RiskController public riskController;

    uint256 public noOfTokensLent = 0;
    uint256 public noOfTokensBorrowed = 0;

    constructor(address _token, address _riskController) {
        larToken = IERC20(_token);
        riskController = RiskController(_riskController);
    }

    function addTokensForLending(
        string memory name,
        address tokenAddress,
        uint256 LTV,
        uint256 borrowStableRate
    ) external onlyOwner {
        Token memory token = Token(tokenAddress, LTV, borrowStableRate, name);

        if (!tokenIsAlreadyThere(token,tokensForLending)) {
            tokensForLending.push(token);
        }
    }

    function addTokensForBorrowing(
        string memory name,
        address tokenAddress,
        uint256 LTV,
        uint256 borrowStableRate
    ) external onlyOwner {
        Token memory token = Token(tokenAddress, LTV, borrowStableRate, name);

        if (!tokenIsAlreadyThere(token,tokensForBorrowing)) {
            tokensForBorrowing.push(token);
        }
    }

    function addTokenToPriceFeedMapping(address tokenAddress, address tokenToUsdPriceFeed) external onlyOwner {
        tokenToPriceFeed[tokenAddress] = tokenToUsdPriceFeed;
    }

    function setRiskController(address _riskController) external onlyOwner {
        riskController = RiskController(_riskController);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getLendersArray() public view returns (address[] memory) {
        return lenders;
    }

    function getBorrowersArray() public view returns (address[] memory) {
        return borrowers;
    }

    function getTokensForLendingArray() public view returns (Token[] memory) {
        return tokensForLending;
    }

    function getTokensForBorrowingArray() public view returns (Token[] memory) {
        return tokensForBorrowing;
    }

    function lend(address tokenAddress, uint256 amount, bytes32 requestId) external payable whenNotPaused nonReentrant {
        require(!processedRequests[requestId], "Duplicate request");
        require(riskController.isActionAllowed(msg.sender), "Action restricted by Risk Controller");
        require(tokenIsAllowed(tokenAddress, tokensForLending));
        require(amount > 0);

        processedRequests[requestId] = true;
        emit RequestProcessed(requestId, msg.sender);

        IERC20 token = IERC20(tokenAddress);
        require(token.balanceOf(msg.sender) >= amount);
        token.transferFrom(msg.sender, address(this), amount);

        (bool userPresent, int256 userIndex) = msg.sender.isUserPresentIn(lenders);

        if (userPresent) {
            updateUserTokensBorrowedOrLent(tokenAddress,amount,userIndex,"lenders");
        } else {
            lenders.push(msg.sender);
            tokensLentAmount[tokenAddress][msg.sender] = amount;
            tokensLent[noOfTokensLent++][msg.sender] = tokenAddress;
        }

         // Send some tokens to the user equivalent to the token amount lent.
        larToken.transfer(msg.sender, getAmountInDollars(amount, tokenAddress));

        emit Supply(msg.sender, address(this), tokenAddress, amount, block.timestamp);
    }

    function borrow(uint256 amount, address tokenAddress, bytes32 requestId) external whenNotPaused nonReentrant {
        require(!processedRequests[requestId], "Duplicate request");
        require(riskController.isActionAllowed(msg.sender), "Action restricted by Risk Controller");
        require(tokenIsAllowed(tokenAddress, tokensForBorrowing));
        require(amount > 0);

        processedRequests[requestId] = true;
        emit RequestProcessed(requestId, msg.sender);

        uint256 totalAmountAvailableForBorrowInDollars = getUserTotalAmountAvailableForBorrowInDollars(msg.sender);
        uint256 amountInDollars = getAmountInDollars(amount, tokenAddress);

        emit BorrowTesting1(msg.sender,amountInDollars,totalAmountAvailableForBorrowInDollars);

        // Dynamic Credit-Line Validation for DAI
        Token memory tokenObj = getTokenFrom(tokenAddress);
        if (keccak256(abi.encodePacked(tokenObj.name)) != keccak256(abi.encodePacked("DAI"))) {
            require(amountInDollars <= totalAmountAvailableForBorrowInDollars, "Insufficient collateral");
        } else {
            // Rule 1: Minimum borrow amount is 50 DAI
            require(amount >= 50 * 10**18, "Minimum borrow amount is 50 DAI");

            // Initialize profile if not already done
            if (accountBorrowProfiles[msg.sender].totalBorrowLimit == 0) {
                accountBorrowProfiles[msg.sender].totalBorrowLimit = 200 * 10**18;
                accountBorrowProfiles[msg.sender].availableBorrowLimit = 200 * 10**18;
                accountBorrowProfiles[msg.sender].trustScore = 100;
                accountBorrowProfiles[msg.sender].accountTier = 1;
                accountBorrowProfiles[msg.sender].minimumBorrowAmount = 50 * 10**18;
                accountBorrowProfiles[msg.sender].maximumBorrowAmount = 200 * 10**18;
                accountBorrowProfiles[msg.sender].borrowEligibility = true;
            }

            // Rule 2: Eligibility check
            require(accountBorrowProfiles[msg.sender].borrowEligibility, "Borrowing is suspended due to high risk index");

            // Rule 3: Available limit check
            require(
                accountBorrowProfiles[msg.sender].borrowedOutstanding + amount <= accountBorrowProfiles[msg.sender].totalBorrowLimit,
                "Borrow limit reached"
            );

            // Update credit profile
            accountBorrowProfiles[msg.sender].borrowedOutstanding += amount;
            if (accountBorrowProfiles[msg.sender].totalBorrowLimit > accountBorrowProfiles[msg.sender].borrowedOutstanding) {
                accountBorrowProfiles[msg.sender].availableBorrowLimit = accountBorrowProfiles[msg.sender].totalBorrowLimit - accountBorrowProfiles[msg.sender].borrowedOutstanding;
            } else {
                accountBorrowProfiles[msg.sender].availableBorrowLimit = 0;
            }

            emit CreditProfileUpdated(
                msg.sender,
                accountBorrowProfiles[msg.sender].totalBorrowLimit,
                accountBorrowProfiles[msg.sender].availableBorrowLimit,
                accountBorrowProfiles[msg.sender].borrowedOutstanding,
                accountBorrowProfiles[msg.sender].repaymentCount,
                accountBorrowProfiles[msg.sender].trustScore,
                accountBorrowProfiles[msg.sender].riskScore,
                accountBorrowProfiles[msg.sender].accountTier,
                accountBorrowProfiles[msg.sender].borrowEligibility
            );
        }

        IERC20 token = IERC20(tokenAddress);

        emit BorrowTesting2(msg.sender, token.balanceOf(address(this)), amount);

        require(token.balanceOf(address(this)) >= amount,"Insufficient Token");

        token.transfer(msg.sender, amount);

        //Library function isUserPresentIn
        (bool userPresent, int256 userIndex) = msg.sender.isUserPresentIn(borrowers);

        if (userPresent) {
          updateUserTokensBorrowedOrLent(tokenAddress,amount,userIndex,"borrowers");
        } else {
            borrowers.push(msg.sender);
            tokensBorrowedAmount[tokenAddress][msg.sender] = amount;
            tokensBorrowed[noOfTokensBorrowed++][msg.sender] = tokenAddress;
        }

        emit Borrow(msg.sender, address(this), tokenAddress, amount, block.timestamp);
    }

    function payDebt(address tokenAddress, uint256 amount, bytes32 requestId) external nonReentrant {
        require(!processedRequests[requestId], "Duplicate request");
        require(amount > 0);

        processedRequests[requestId] = true;
        emit RequestProcessed(requestId, msg.sender);

        int256 index = msg.sender.indexOf(borrowers);

        emit RepayTesting1(msg.sender, index);
        require(index >= 0);

        uint256 tokenBorrowed = tokensBorrowedAmount[tokenAddress][msg.sender];

        emit RepayTesting2(msg.sender, tokenBorrowed);

        require(tokenBorrowed > 0);
        IERC20 token = IERC20(tokenAddress);

        token.transferFrom(msg.sender,address(this),amount + interest(tokenAddress, tokenBorrowed));

        tokensBorrowedAmount[tokenAddress][msg.sender] -= amount;

        // Dynamic Credit-Line Updates for DAI
        Token memory tokenObj = getTokenFrom(tokenAddress);
        if (keccak256(abi.encodePacked(tokenObj.name)) == keccak256(abi.encodePacked("DAI"))) {
            if (accountBorrowProfiles[msg.sender].totalBorrowLimit == 0) {
                accountBorrowProfiles[msg.sender].totalBorrowLimit = 200 * 10**18;
                accountBorrowProfiles[msg.sender].availableBorrowLimit = 200 * 10**18;
                accountBorrowProfiles[msg.sender].trustScore = 100;
                accountBorrowProfiles[msg.sender].accountTier = 1;
                accountBorrowProfiles[msg.sender].minimumBorrowAmount = 50 * 10**18;
                accountBorrowProfiles[msg.sender].maximumBorrowAmount = 200 * 10**18;
                accountBorrowProfiles[msg.sender].borrowEligibility = true;
            }

            if (accountBorrowProfiles[msg.sender].borrowedOutstanding >= amount) {
                accountBorrowProfiles[msg.sender].borrowedOutstanding -= amount;
            } else {
                accountBorrowProfiles[msg.sender].borrowedOutstanding = 0;
            }

            accountBorrowProfiles[msg.sender].repaymentCount += 1;
            accountBorrowProfiles[msg.sender].trustScore += 10;

            if (accountBorrowProfiles[msg.sender].repaymentCount >= 5 && accountBorrowProfiles[msg.sender].trustScore >= 130) {
                accountBorrowProfiles[msg.sender].accountTier = 3;
            } else if (accountBorrowProfiles[msg.sender].repaymentCount >= 2 && accountBorrowProfiles[msg.sender].trustScore >= 110) {
                accountBorrowProfiles[msg.sender].accountTier = 2;
            } else {
                accountBorrowProfiles[msg.sender].accountTier = 1;
            }

            if (accountBorrowProfiles[msg.sender].borrowedOutstanding == 0) {
                uint256 nextLimit = accountBorrowProfiles[msg.sender].totalBorrowLimit + growthStep;
                if (nextLimit > maxLimit) {
                    nextLimit = maxLimit;
                }
                accountBorrowProfiles[msg.sender].totalBorrowLimit = nextLimit;
                accountBorrowProfiles[msg.sender].maximumBorrowAmount = nextLimit;
            }

            if (accountBorrowProfiles[msg.sender].totalBorrowLimit > accountBorrowProfiles[msg.sender].borrowedOutstanding) {
                accountBorrowProfiles[msg.sender].availableBorrowLimit = accountBorrowProfiles[msg.sender].totalBorrowLimit - accountBorrowProfiles[msg.sender].borrowedOutstanding;
            } else {
                accountBorrowProfiles[msg.sender].availableBorrowLimit = 0;
            }

            emit CreditProfileUpdated(
                msg.sender,
                accountBorrowProfiles[msg.sender].totalBorrowLimit,
                accountBorrowProfiles[msg.sender].availableBorrowLimit,
                accountBorrowProfiles[msg.sender].borrowedOutstanding,
                accountBorrowProfiles[msg.sender].repaymentCount,
                accountBorrowProfiles[msg.sender].trustScore,
                accountBorrowProfiles[msg.sender].riskScore,
                accountBorrowProfiles[msg.sender].accountTier,
                accountBorrowProfiles[msg.sender].borrowEligibility
            );
        }

        // Checking if all total amount borrowed by a user = 0, then remove the user from borrowers list;
        if (getTotalAmountBorrowedInDollars(msg.sender) == 0) {
            borrowers[uint256(index)] = borrowers[borrowers.length - 1];
            borrowers.pop();
        }

        emit Repay(msg.sender, address(this), tokenAddress, amount, block.timestamp);
    }

    function syncAccountBorrowProfile(
        address user,
        uint256 totalBorrowLimit,
        uint256 availableBorrowLimit,
        uint256 borrowedOutstanding,
        uint256 repaymentCount,
        uint256 trustScore,
        uint256 riskScore,
        uint256 accountTier,
        bool borrowEligibility
    ) external onlyOwner {
        accountBorrowProfiles[user] = AccountBorrowProfile(
            totalBorrowLimit,
            availableBorrowLimit,
            borrowedOutstanding,
            repaymentCount,
            trustScore,
            riskScore,
            accountTier,
            50 * 10**18, // minimumBorrowAmount
            totalBorrowLimit, // maximumBorrowAmount
            borrowEligibility
        );
        emit CreditProfileUpdated(
            user,
            totalBorrowLimit,
            availableBorrowLimit,
            borrowedOutstanding,
            repaymentCount,
            trustScore,
            riskScore,
            accountTier,
            borrowEligibility
        );
    }

    function withdraw(address tokenAddress, uint256 amount, bytes32 requestId) external whenNotPaused nonReentrant {
        require(!processedRequests[requestId], "Duplicate request");
        require(riskController.isActionAllowed(msg.sender), "Action restricted by Risk Controller");
        require(amount > 0);

        processedRequests[requestId] = true;
        emit RequestProcessed(requestId, msg.sender);

        require(msg.sender.indexOf(lenders) >= 0);

        IERC20 token = IERC20(tokenAddress);

        uint256 tokenToWithdrawInDollars = getAmountInDollars(amount,tokenAddress);
        uint256 availableToWithdraw = getTokenAvailableToWithdraw(msg.sender);

        uint totalTokenSuppliedInContract = getTotalTokenSupplied(tokenAddress);
        uint totalTokenBorrowedInContract = getTotalTokenBorrowed(tokenAddress);

        require(amount <= (totalTokenSuppliedInContract - totalTokenBorrowedInContract));

        emit WithdrawTesting(msg.sender,tokenToWithdrawInDollars,availableToWithdraw);

        require(tokenToWithdrawInDollars <= availableToWithdraw);

        // Withdrawal directly returns user's supplied collateral
        // No ERC20 transferFrom or allowance check is required here.

        token.transfer(msg.sender, amount);

        tokensLentAmount[tokenAddress][msg.sender] -= amount;

        emit Withdraw(address(this), msg.sender, tokenAddress, amount, block.timestamp);

        if (getTotalAmountLentInDollars(msg.sender) <= 0) {
            lenders[uint256(msg.sender.indexOf(lenders))] = lenders[lenders.length - 1];
            lenders.pop();
        }
    }

    function getTokenAvailableToWithdraw(address user)public view returns (uint256){

        uint256 totalAmountBorrowedInDollars = getTotalAmountBorrowedInDollars(user);

        uint remainingCollateral = 0;

        if (totalAmountBorrowedInDollars > 0 ){
            remainingCollateral = getRemainingCollateral(user);
        }else{
            remainingCollateral = getTotalAmountLentInDollars(user);
        }

        if (remainingCollateral < totalAmountBorrowedInDollars){return 0;}

        return remainingCollateral - totalAmountBorrowedInDollars;
    }

    function getRemainingCollateral(address user)public view returns (uint256){
           uint256 remainingCollateral = 0;
           for (uint256 i = 0; i < noOfTokensLent; i++)
           {
               address userLentTokenAddressFound = tokensLent[i][user];

               if (userLentTokenAddressFound !=0x0000000000000000000000000000000000000000)
               {
                 uint256 tokenAmountLentInDollars = getAmountInDollars(
                   tokensLentAmount[userLentTokenAddressFound][user],
                   userLentTokenAddressFound);

                 uint256 ltv = riskController.getEffectiveLTV(userLentTokenAddressFound, getTokenFrom(userLentTokenAddressFound).LTV);
                 remainingCollateral += (tokenAmountLentInDollars * ltv) / 10 ** 18;
               }
           }
           return remainingCollateral;
       }

       function getTotalAmountBorrowedInDollars(address user) public view returns (uint256){
           uint256 totalAmountBorrowed = 0;

           for (uint256 i = 0; i < noOfTokensBorrowed; i++) {
               address userBorrowedTokenAddressFound = tokensBorrowed[i][user];

               if (userBorrowedTokenAddressFound != 0x0000000000000000000000000000000000000000)
               {
                  ///tokenAmountBorrowed is tokensBorrowedAmount[userBorrowedTokenAddressFound][user];

                   uint256 tokenAmountBorrowedInDollars = getAmountInDollars(
                       tokensBorrowedAmount[userBorrowedTokenAddressFound][user],
                       userBorrowedTokenAddressFound
                   );

                   totalAmountBorrowed += tokenAmountBorrowedInDollars;
               }
           }
           return totalAmountBorrowed;
       }

       function getTotalAmountLentInDollars(address user) public view returns (uint256){
           uint256 totalAmountLent = 0;
           for (uint256 i = 0; i < noOfTokensLent; i++) {
               if (tokensLent[i][user] !=0x0000000000000000000000000000000000000000)
               {
                   uint256 tokenAmountLent = tokensLentAmount[tokensLent[i][user]][user];

                   uint256 tokenAmountLentInDollars = getAmountInDollars(tokenAmountLent,tokensLent[i][user]);

                   totalAmountLent += tokenAmountLentInDollars;
               }
           }
           return totalAmountLent;
       }

       function getUtilizationRate(address tokenAddress) public view returns (uint256) {
           uint256 totalBorrowed = getTotalTokenBorrowed(tokenAddress);
           uint256 totalSupplied = getTotalTokenSupplied(tokenAddress);
           if (totalSupplied == 0) return 0;
           return (totalBorrowed * 10**18) / totalSupplied; // 1e18 = 100%
       }

       function getBorrowRate(address tokenAddress) public view returns (uint256) {
           uint256 utilization = getUtilizationRate(tokenAddress);
           uint256 baseRate = getTokenFrom(tokenAddress).stableRate; 
           uint256 multiplier = 2 * 10**17; // 20% multiplier at 100% utilization
           return baseRate + ((utilization * multiplier) / 10**18);
       }

       function getSupplyRate(address tokenAddress) public view returns (uint256) {
           uint256 utilization = getUtilizationRate(tokenAddress);
           uint256 borrowRate = getBorrowRate(tokenAddress);
           // Supply APY = Borrow APY * Utilization
           return (borrowRate * utilization) / 10**18;
       }

       function interest(address tokenAddress, uint256 tokenBorrowed) public view returns (uint256){
           return (tokenBorrowed * getBorrowRate(tokenAddress)) / 10**18;
       }

       function getHealthFactor(address user) public view returns (uint256) {
           uint256 totalBorrowedDollars = getTotalAmountBorrowedInDollars(user);
           if (totalBorrowedDollars == 0) return type(uint256).max; // Infinite health

           uint256 totalCollateralDollars = 0;
           for (uint256 i = 0; i < noOfTokensLent; i++) {
               address tokenAddress = tokensLent[i][user];
               if (tokenAddress != address(0)) {
                   uint256 amountInDollars = getAmountInDollars(tokensLentAmount[tokenAddress][user], tokenAddress);
                   uint256 liquidationThreshold = 85 * 10**16; // 85% Liquidation Threshold
                   totalCollateralDollars += (amountInDollars * liquidationThreshold) / 10**18;
               }
           }
           
           return (totalCollateralDollars * 10**18) / totalBorrowedDollars; // < 1e18 means liquidatable
       }

       function getTokenFrom(address tokenAddress) public view returns (Token memory){
           Token memory token;
           for (uint256 i = 0; i < tokensForBorrowing.length; i++) {
               if (tokensForBorrowing[i].tokenAddress == tokenAddress) {
                   token = tokensForBorrowing[i];
                   break;
               }
           }
           return token;
       }

       function getUserTotalAmountAvailableForBorrowInDollars(address user) public view returns (uint256){
          // uint256 totalAvailableToBorrow = 0;

          uint256 userTotalCollateralToBorrow = 0;
          uint256 userTotalCollateralAlreadyBorrowed = 0;

          for (uint256 i = 0; i < lenders.length; i++) {
              address currentLender = lenders[i];
              if (currentLender == user) {
                  for (uint256 j = 0; j < tokensForLending.length; j++) {
                      Token memory currentTokenForLending = tokensForLending[j];
                      uint256 currentTokenLentAmount = tokensLentAmount[currentTokenForLending.tokenAddress][user];
                      uint256 currentTokenLentAmountInDollar = getAmountInDollars(
                          currentTokenLentAmount,
                          currentTokenForLending.tokenAddress
                      );
                      uint256 ltv = riskController.getEffectiveLTV(currentTokenForLending.tokenAddress, currentTokenForLending.LTV);
                      uint256 availableInDollar = (currentTokenLentAmountInDollar * ltv) / 10**18;
                      userTotalCollateralToBorrow += availableInDollar;
                  }
              }
          }

          for (uint256 i = 0; i < borrowers.length; i++) {
              address currentBorrower = borrowers[i];
              if (currentBorrower == user) {
                  for (uint256 j = 0; j < tokensForBorrowing.length; j++) {
                      Token memory currentTokenForBorrowing = tokensForBorrowing[j];
                      uint256 currentTokenBorrowedAmount = tokensBorrowedAmount[currentTokenForBorrowing.tokenAddress][user];
                      uint256 currentTokenBorrowedAmountInDollar = getAmountInDollars(
                              (currentTokenBorrowedAmount),
                              currentTokenForBorrowing.tokenAddress
                          );

                      userTotalCollateralAlreadyBorrowed += currentTokenBorrowedAmountInDollar;
                  }
              }
          }

           if (userTotalCollateralToBorrow > userTotalCollateralAlreadyBorrowed) {
               return userTotalCollateralToBorrow - userTotalCollateralAlreadyBorrowed;
           } else {
               return 0;
           }
       }


       function tokenIsAllowed(address tokenAddress, Token[] memory tokenArray) private pure returns (bool){
           if (tokenArray.length > 0) {
               for (uint256 i = 0; i < tokenArray.length; i++) {
                   if (tokenArray[i].tokenAddress == tokenAddress) {
                       return true;
                   }
               }
           }
           return false;
       }

       function tokenIsAlreadyThere(Token memory token, Token[] memory tokenArray) private pure returns (bool){
           if (tokenArray.length > 0) {
               for (uint256 i = 0; i < tokenArray.length; i++) {
                   if (tokenArray[i].tokenAddress == token.tokenAddress) {
                       return true;
                   }
               }
           }
           return false;
       }

       function getAmountInDollars(uint256 amount, address tokenAddress) public view returns (uint256){
          (uint256 dollarPerToken,uint256 decimals) = oneTokenEqualsHowManyDollars(tokenAddress);
          uint256 totalAmountInDollars = (amount * dollarPerToken) / (10**decimals);
          return totalAmountInDollars;
        }

      function oneTokenEqualsHowManyDollars(address tokenAddress) public view returns (uint256, uint256){
            address tokenToUsd = tokenToPriceFeed[tokenAddress];
            AggregatorV3Interface priceFeed = AggregatorV3Interface(tokenToUsd);

            (, int256 price, , , ) = priceFeed.latestRoundData();

            uint256 decimals = priceFeed.decimals();

            return (uint256(price), decimals);
        }

       function updateUserTokensBorrowedOrLent(
         address tokenAddress,
         uint256 amount,
         int256 userIndex,
         string memory lendersOrBorrowers)
         private {
           if ( keccak256(abi.encodePacked(lendersOrBorrowers)) == keccak256(abi.encodePacked("lenders"))) {
               address currentUser = lenders[uint256(userIndex)];

               if (hasLentOrBorrowedToken(currentUser, tokenAddress, noOfTokensLent,"tokensLent")) {
                   tokensLentAmount[tokenAddress][currentUser] += amount;
               } else {
                   tokensLent[noOfTokensLent++][currentUser] = tokenAddress;
                   tokensLentAmount[tokenAddress][currentUser] = amount;
               }
           } else if (keccak256(abi.encodePacked(lendersOrBorrowers)) == keccak256(abi.encodePacked("borrowers"))) {
               address currentUser = borrowers[uint256(userIndex)];

               if (hasLentOrBorrowedToken(currentUser,tokenAddress,noOfTokensBorrowed,"tokensBorrowed")) {
                   tokensBorrowedAmount[tokenAddress][currentUser] += amount;
               } else {
                   tokensBorrowed[noOfTokensBorrowed++][currentUser] = tokenAddress;
                   tokensBorrowedAmount[tokenAddress][currentUser] = amount;
               }
           }
       }

       function hasLentOrBorrowedToken(
           address currentUser,
           address tokenAddress,
           uint256 noOfTokenslentOrBorrowed,
           string memory _tokensLentOrBorrowed
       ) public view returns (bool) {
           if (noOfTokenslentOrBorrowed > 0) {
               if (keccak256(abi.encodePacked(_tokensLentOrBorrowed)) == keccak256(abi.encodePacked("tokensLent"))) {
                   for (uint256 i = 0; i < noOfTokensLent; i++) {
                       address tokenAddressFound = tokensLent[i][currentUser];
                       if (tokenAddressFound == tokenAddress) {
                           return true;
                       }
                   }
               } else if (keccak256(abi.encodePacked(_tokensLentOrBorrowed)) == keccak256(abi.encodePacked("tokensBorrowed"))) {
                   for (uint256 i = 0; i < noOfTokensBorrowed; i++) {
                       address tokenAddressFound = tokensBorrowed[i][currentUser];
                       if (tokenAddressFound == tokenAddress) {
                           return true;
                       }
                   }
               }
           }
           return false;
       }



       function getTotalTokenSupplied(address tokenAddres) public view returns (uint256){
           uint256 totalTokenSupplied = 0;
           if (lenders.length > 0) {
               for (uint256 i = 0; i < lenders.length; i++) {
                   totalTokenSupplied += tokensLentAmount[tokenAddres][lenders[i]];
               }
           }

           return totalTokenSupplied;
       }

       function getTotalTokenBorrowed(address tokenAddress) public view returns (uint256){
           uint256 totalTokenBorrowed = 0;
           if (borrowers.length > 0) {
               for (uint256 i = 0; i < borrowers.length; i++) {
                   totalTokenBorrowed += tokensBorrowedAmount[tokenAddress][borrowers[i]];
               }
           }
           return totalTokenBorrowed;
       }

    function getOutstandingDebt(address wallet) external view returns (uint256) {
        return accountBorrowProfiles[wallet].borrowedOutstanding;
    }

    function getCreditLimit(address wallet) external view returns (uint256) {
        if (accountBorrowProfiles[wallet].totalBorrowLimit == 0) {
            return 200 * 10**18;
        }
        return accountBorrowProfiles[wallet].totalBorrowLimit;
    }

    function getAvailableBorrow(address wallet) external view returns (uint256) {
        uint256 limit = accountBorrowProfiles[wallet].totalBorrowLimit == 0 ? 200 * 10**18 : accountBorrowProfiles[wallet].totalBorrowLimit;
        uint256 debt = accountBorrowProfiles[wallet].borrowedOutstanding;
        if (limit > debt) {
            return limit - debt;
        }
        return 0;
    }

}
