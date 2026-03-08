import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

describe("NomoLend Protocol", function () {
  let owner, lender, borrower, treasury, liquidator;
  let usdc, collateralToken;
  let protocolConfig, tokenValidator, priceOracle, riskEngine;
  let collateralManager, liquidationEngine, orderBook, loanManager;
  let mockChainlinkFeed, mockSwapRouter;

  const USDC_DECIMALS = 6;
  const TOKEN_DECIMALS = 18;
  const ONE_USDC = ethers.parseUnits("1", USDC_DECIMALS);
  const ONE_TOKEN = ethers.parseUnits("1", TOKEN_DECIMALS);

  // Token price: $10 USDC per token
  const TOKEN_PRICE_USDC = 10n * ONE_USDC; // 10_000_000 (6 decimals)
  const TOKEN_PRICE_CL = 10n * 10n ** 8n;  // $10 in 8 decimals (Chainlink)

  beforeEach(async function () {
    [owner, lender, borrower, treasury, liquidator] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("USD Coin", "USDC", USDC_DECIMALS);
    collateralToken = await MockERC20.deploy("Test Token", "TEST", TOKEN_DECIMALS);

    // Deploy mock Chainlink feed ($10 per token, 8 decimals)
    const MockChainlinkFeed = await ethers.getContractFactory("MockChainlinkFeed");
    mockChainlinkFeed = await MockChainlinkFeed.deploy(TOKEN_PRICE_CL, 8);

    // Deploy mock swap router
    const MockSwapRouter = await ethers.getContractFactory("MockSwapRouter");
    mockSwapRouter = await MockSwapRouter.deploy();

    // Deploy protocol contracts
    const ProtocolConfig = await ethers.getContractFactory("ProtocolConfig");
    protocolConfig = await ProtocolConfig.deploy(await usdc.getAddress(), treasury.address);

    const TokenValidator = await ethers.getContractFactory("TokenValidator");
    tokenValidator = await TokenValidator.deploy();

    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy();

    const RiskEngine = await ethers.getContractFactory("RiskEngine");
    riskEngine = await RiskEngine.deploy(await priceOracle.getAddress(), await tokenValidator.getAddress());

    const CollateralManager = await ethers.getContractFactory("CollateralManager");
    collateralManager = await CollateralManager.deploy();

    const LiquidationEngine = await ethers.getContractFactory("LiquidationEngine");
    liquidationEngine = await LiquidationEngine.deploy(await usdc.getAddress());

    const OrderBook = await ethers.getContractFactory("OrderBook");
    orderBook = await OrderBook.deploy(await usdc.getAddress());

    const LoanManager = await ethers.getContractFactory("LoanManager");
    loanManager = await LoanManager.deploy(
      await protocolConfig.getAddress(),
      await orderBook.getAddress(),
      await collateralManager.getAddress(),
      await riskEngine.getAddress(),
      await liquidationEngine.getAddress(),
      await priceOracle.getAddress()
    );

    // Setup roles
    const LOAN_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LOAN_MANAGER_ROLE"));
    const RISK_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RISK_MANAGER_ROLE"));
    const LIQUIDATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("LIQUIDATOR_ROLE"));

    await collateralManager.grantRole(LOAN_MANAGER_ROLE, await loanManager.getAddress());
    await orderBook.grantRole(LOAN_MANAGER_ROLE, await loanManager.getAddress());
    await loanManager.grantRole(LIQUIDATOR_ROLE, liquidator.address);
    await riskEngine.grantRole(RISK_MANAGER_ROLE, await loanManager.getAddress());

    // Setup liquidation engine
    await liquidationEngine.grantRole(LIQUIDATOR_ROLE, await loanManager.getAddress());
    await liquidationEngine.setPrimaryRouter(await mockSwapRouter.getAddress());

    // Configure token
    await tokenValidator.whitelistToken(await collateralToken.getAddress());
    await priceOracle.setPriceFeed(await collateralToken.getAddress(), await mockChainlinkFeed.getAddress(), TOKEN_DECIMALS);

    // Risk params: LTV 40%, Liquidation 60%, Max exposure 1M USDC
    await riskEngine.setTokenRiskParams(
      await collateralToken.getAddress(),
      4000, // 40% LTV
      6000, // 60% liquidation threshold
      ethers.parseUnits("1000000", USDC_DECIMALS)
    );

    // Mint tokens
    await usdc.mint(lender.address, ethers.parseUnits("100000", USDC_DECIMALS));
    await usdc.mint(borrower.address, ethers.parseUnits("10000", USDC_DECIMALS));
    await collateralToken.mint(borrower.address, ethers.parseUnits("10000", TOKEN_DECIMALS));

    // Mint USDC to swap router for liquidation tests
    await usdc.mint(await mockSwapRouter.getAddress(), ethers.parseUnits("100000", USDC_DECIMALS));

    // Set exchange rate: 1 TEST = 10 USDC (in 6 decimals per 1e18 tokens)
    // rate = 10 * 1e6 = 10_000_000 per 1e18 input -> need to adjust
    // amountOut = amountIn * rate / 1e18
    // For 1e18 tokenIn -> 10e6 USDC out -> rate = 10e6
    await mockSwapRouter.setExchangeRate(
      await collateralToken.getAddress(),
      await usdc.getAddress(),
      10n * ONE_USDC // 10_000_000
    );
  });

  // ============================================================
  //                    INTEREST CALCULATOR
  // ============================================================

  describe("Interest Calculator", function () {
    it("should charge 2% for 7-day loan", async function () {
      // Borrow 1000 USDC for 7 days -> 2% = 20 USDC interest
      const principal = ethers.parseUnits("1000", USDC_DECIMALS);
      const expectedInterest = ethers.parseUnits("20", USDC_DECIMALS);

      // Setup: create lending order
      await usdc.connect(lender).approve(await orderBook.getAddress(), principal);
      await orderBook.connect(lender).createLendingOrder(principal, 0); // SEVEN_DAYS

      // Borrower takes loan with collateral
      // Need: 1000 USDC / 40% LTV = 2500 USDC worth of collateral
      // At $10/token = 250 tokens
      const collateralAmount = ethers.parseUnits("300", TOKEN_DECIMALS); // Extra margin
      await collateralToken.connect(borrower).approve(await collateralManager.getAddress(), collateralAmount);
      await loanManager.connect(borrower).takeLoan(0, principal, await collateralToken.getAddress(), collateralAmount);

      // Advance 5 days and repay
      await time.increase(5 * 24 * 3600);

      const totalRepay = principal + expectedInterest;
      await usdc.mint(borrower.address, expectedInterest); // Give borrower enough for interest
      await usdc.connect(borrower).approve(await loanManager.getAddress(), totalRepay);
      await loanManager.connect(borrower).repayLoan(0);

      const loan = await loanManager.getLoan(0);
      expect(loan.status).to.equal(1); // REPAID
      expect(loan.interestPaid).to.equal(expectedInterest);
    });

    it("should charge 4% for 30-day loan repaid after 10 days", async function () {
      const principal = ethers.parseUnits("1000", USDC_DECIMALS);
      const expectedInterest = ethers.parseUnits("40", USDC_DECIMALS); // 4%

      await usdc.connect(lender).approve(await orderBook.getAddress(), principal);
      await orderBook.connect(lender).createLendingOrder(principal, 2); // THIRTY_DAYS

      const collateralAmount = ethers.parseUnits("300", TOKEN_DECIMALS);
      await collateralToken.connect(borrower).approve(await collateralManager.getAddress(), collateralAmount);
      await loanManager.connect(borrower).takeLoan(0, principal, await collateralToken.getAddress(), collateralAmount);

      await time.increase(10 * 24 * 3600); // 10 days -> bracket 2 = 4%

      const totalRepay = principal + expectedInterest;
      await usdc.mint(borrower.address, expectedInterest);
      await usdc.connect(borrower).approve(await loanManager.getAddress(), totalRepay);
      await loanManager.connect(borrower).repayLoan(0);

      const loan = await loanManager.getLoan(0);
      expect(loan.interestPaid).to.equal(expectedInterest);
    });

    it("should charge 8% for 30-day loan repaid after 20 days", async function () {
      const principal = ethers.parseUnits("1000", USDC_DECIMALS);
      const expectedInterest = ethers.parseUnits("80", USDC_DECIMALS); // 8%

      await usdc.connect(lender).approve(await orderBook.getAddress(), principal);
      await orderBook.connect(lender).createLendingOrder(principal, 2); // THIRTY_DAYS

      const collateralAmount = ethers.parseUnits("300", TOKEN_DECIMALS);
      await collateralToken.connect(borrower).approve(await collateralManager.getAddress(), collateralAmount);
      await loanManager.connect(borrower).takeLoan(0, principal, await collateralToken.getAddress(), collateralAmount);

      await time.increase(20 * 24 * 3600); // 20 days -> bracket 3 = 8%

      const totalRepay = principal + expectedInterest;
      await usdc.mint(borrower.address, expectedInterest);
      await usdc.connect(borrower).approve(await loanManager.getAddress(), totalRepay);
      await loanManager.connect(borrower).repayLoan(0);

      const loan = await loanManager.getLoan(0);
      expect(loan.interestPaid).to.equal(expectedInterest);
    });
  });

  // ============================================================
  //                       ORDER BOOK
  // ============================================================

  describe("OrderBook", function () {
    it("should create and cancel a lending order", async function () {
      const amount = ethers.parseUnits("1000", USDC_DECIMALS);
      await usdc.connect(lender).approve(await orderBook.getAddress(), amount);
      await orderBook.connect(lender).createLendingOrder(amount, 0);

      let order = await orderBook.getLendingOrder(0);
      expect(order.lender).to.equal(lender.address);
      expect(order.totalAmount).to.equal(amount);
      expect(order.status).to.equal(0); // OPEN

      const balBefore = await usdc.balanceOf(lender.address);
      await orderBook.connect(lender).cancelLendingOrder(0);
      const balAfter = await usdc.balanceOf(lender.address);
      expect(balAfter - balBefore).to.equal(amount);

      order = await orderBook.getLendingOrder(0);
      expect(order.status).to.equal(2); // CANCELLED
    });

    it("should create and cancel a borrow request", async function () {
      const requestAmount = ethers.parseUnits("500", USDC_DECIMALS);
      const collateralAmount = ethers.parseUnits("200", TOKEN_DECIMALS);

      await collateralToken.connect(borrower).approve(await orderBook.getAddress(), collateralAmount);
      await orderBook.connect(borrower).createBorrowRequest(
        requestAmount,
        await collateralToken.getAddress(),
        collateralAmount,
        1 // FOURTEEN_DAYS
      );

      let request = await orderBook.getBorrowRequest(0);
      expect(request.borrower).to.equal(borrower.address);
      expect(request.status).to.equal(0); // OPEN

      const balBefore = await collateralToken.balanceOf(borrower.address);
      await orderBook.connect(borrower).cancelBorrowRequest(0);
      const balAfter = await collateralToken.balanceOf(borrower.address);
      expect(balAfter - balBefore).to.equal(collateralAmount);
    });

    it("should support partial fills on lending orders", async function () {
      const amount = ethers.parseUnits("1000", USDC_DECIMALS);
      await usdc.connect(lender).approve(await orderBook.getAddress(), amount);
      await orderBook.connect(lender).createLendingOrder(amount, 2); // THIRTY_DAYS

      // Borrower takes 400 out of 1000
      const borrowAmount = ethers.parseUnits("400", USDC_DECIMALS);
      const collateralAmount = ethers.parseUnits("150", TOKEN_DECIMALS);
      await collateralToken.connect(borrower).approve(await collateralManager.getAddress(), collateralAmount);
      await loanManager.connect(borrower).takeLoan(0, borrowAmount, await collateralToken.getAddress(), collateralAmount);

      const order = await orderBook.getLendingOrder(0);
      expect(order.availableAmount).to.equal(ethers.parseUnits("600", USDC_DECIMALS));
      expect(order.status).to.equal(0); // Still OPEN
    });
  });

  // ============================================================
  //                     PLATFORM FEE
  // ============================================================

  describe("Platform Fee", function () {
    it("should collect 10% of interest as platform fee", async function () {
      const principal = ethers.parseUnits("1000", USDC_DECIMALS);
      await usdc.connect(lender).approve(await orderBook.getAddress(), principal);
      await orderBook.connect(lender).createLendingOrder(principal, 0); // 7 days

      const collateralAmount = ethers.parseUnits("300", TOKEN_DECIMALS);
      await collateralToken.connect(borrower).approve(await collateralManager.getAddress(), collateralAmount);
      await loanManager.connect(borrower).takeLoan(0, principal, await collateralToken.getAddress(), collateralAmount);

      await time.increase(5 * 24 * 3600);

      // Interest = 2% of 1000 = 20 USDC
      // Platform fee = 10% of 20 = 2 USDC
      // Lender gets = 20 - 2 = 18 USDC interest + 1000 principal
      const interest = ethers.parseUnits("20", USDC_DECIMALS);
      await usdc.mint(borrower.address, interest);
      await usdc.connect(borrower).approve(await loanManager.getAddress(), principal + interest);

      const treasuryBefore = await usdc.balanceOf(treasury.address);
      const lenderBefore = await usdc.balanceOf(lender.address);

      await loanManager.connect(borrower).repayLoan(0);

      const treasuryAfter = await usdc.balanceOf(treasury.address);
      const lenderAfter = await usdc.balanceOf(lender.address);

      expect(treasuryAfter - treasuryBefore).to.equal(ethers.parseUnits("2", USDC_DECIMALS));
      expect(lenderAfter - lenderBefore).to.equal(principal + ethers.parseUnits("18", USDC_DECIMALS));
    });
  });

  // ============================================================
  //                     RISK ENGINE
  // ============================================================

  describe("Risk Engine", function () {
    it("should reject loans exceeding exposure limit", async function () {
      // Set low exposure limit
      await riskEngine.setTokenRiskParams(
        await collateralToken.getAddress(),
        4000, 6000,
        ethers.parseUnits("500", USDC_DECIMALS) // Only 500 USDC max
      );

      const amount = ethers.parseUnits("600", USDC_DECIMALS);
      await usdc.connect(lender).approve(await orderBook.getAddress(), amount);
      await orderBook.connect(lender).createLendingOrder(amount, 0);

      const collateralAmount = ethers.parseUnits("300", TOKEN_DECIMALS);
      await collateralToken.connect(borrower).approve(await collateralManager.getAddress(), collateralAmount);

      await expect(
        loanManager.connect(borrower).takeLoan(0, amount, await collateralToken.getAddress(), collateralAmount)
      ).to.be.revertedWith("Token exposure limit reached");
    });

    it("should reject non-whitelisted tokens", async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const badToken = await MockERC20.deploy("Bad Token", "BAD", 18);

      const amount = ethers.parseUnits("100", USDC_DECIMALS);
      await usdc.connect(lender).approve(await orderBook.getAddress(), amount);
      await orderBook.connect(lender).createLendingOrder(amount, 0);

      await expect(
        loanManager.connect(borrower).takeLoan(0, amount, await badToken.getAddress(), ethers.parseUnits("100", 18))
      ).to.be.reverted;
    });
  });

  // ============================================================
  //                     COLLATERAL
  // ============================================================

  describe("Collateral", function () {
    it("should lock collateral on loan creation and release on repayment", async function () {
      const principal = ethers.parseUnits("1000", USDC_DECIMALS);
      const collateralAmount = ethers.parseUnits("300", TOKEN_DECIMALS);
      // LTV 40%, price $10 -> required = 1000 / 0.40 / 10 = 250 tokens
      const requiredCollateral = ethers.parseUnits("250", TOKEN_DECIMALS);

      await usdc.connect(lender).approve(await orderBook.getAddress(), principal);
      await orderBook.connect(lender).createLendingOrder(principal, 0);

      await collateralToken.connect(borrower).approve(await collateralManager.getAddress(), collateralAmount);
      await loanManager.connect(borrower).takeLoan(0, principal, await collateralToken.getAddress(), collateralAmount);

      // Collateral should be locked (contract locks only requiredCollateral, not full amount sent)
      const locked = await collateralManager.getLockedCollateral(0, await collateralToken.getAddress());
      expect(locked).to.equal(requiredCollateral);

      // Repay
      await time.increase(3 * 24 * 3600);
      const interest = ethers.parseUnits("20", USDC_DECIMALS);
      await usdc.mint(borrower.address, interest);
      await usdc.connect(borrower).approve(await loanManager.getAddress(), principal + interest);

      const balBefore = await collateralToken.balanceOf(borrower.address);
      await loanManager.connect(borrower).repayLoan(0);
      const balAfter = await collateralToken.balanceOf(borrower.address);

      // Collateral returned (only the locked amount)
      expect(balAfter - balBefore).to.equal(requiredCollateral);
    });
  });

  // ============================================================
  //                     BORROW REQUEST FLOW
  // ============================================================

  describe("Borrow Request Flow", function () {
    it("should allow lender to fill a borrow request", async function () {
      const requestAmount = ethers.parseUnits("500", USDC_DECIMALS);
      const collateralAmount = ethers.parseUnits("200", TOKEN_DECIMALS);

      // Borrower creates request with collateral locked in OrderBook
      await collateralToken.connect(borrower).approve(await orderBook.getAddress(), collateralAmount);
      await orderBook.connect(borrower).createBorrowRequest(
        requestAmount,
        await collateralToken.getAddress(),
        collateralAmount,
        2 // THIRTY_DAYS
      );

      // Lender fills the request
      await usdc.connect(lender).approve(await loanManager.getAddress(), requestAmount);
      await loanManager.connect(lender).fillBorrowRequest(0, requestAmount);

      const loan = await loanManager.getLoan(0);
      expect(loan.lender).to.equal(lender.address);
      expect(loan.borrower).to.equal(borrower.address);
      expect(loan.principal).to.equal(requestAmount);
      expect(loan.status).to.equal(0); // ACTIVE
    });
  });

  // ============================================================
  //                   EMERGENCY PAUSE
  // ============================================================

  describe("Emergency Pause", function () {
    it("should block new orders when paused", async function () {
      await orderBook.pause();

      await usdc.connect(lender).approve(await orderBook.getAddress(), ONE_USDC * 100n);
      await expect(
        orderBook.connect(lender).createLendingOrder(ONE_USDC * 100n, 0)
      ).to.be.revertedWithCustomError(orderBook, "EnforcedPause");
    });

    it("should allow repayment when paused", async function () {
      // Create loan first
      const principal = ethers.parseUnits("1000", USDC_DECIMALS);
      const collateralAmount = ethers.parseUnits("300", TOKEN_DECIMALS);

      await usdc.connect(lender).approve(await orderBook.getAddress(), principal);
      await orderBook.connect(lender).createLendingOrder(principal, 0);
      await collateralToken.connect(borrower).approve(await collateralManager.getAddress(), collateralAmount);
      await loanManager.connect(borrower).takeLoan(0, principal, await collateralToken.getAddress(), collateralAmount);

      // Pause the protocol
      await loanManager.pause();

      // Repayment should still work (repayLoan doesn't use whenNotPaused)
      await time.increase(3 * 24 * 3600);
      const interest = ethers.parseUnits("20", USDC_DECIMALS);
      await usdc.mint(borrower.address, interest);
      await usdc.connect(borrower).approve(await loanManager.getAddress(), principal + interest);
      await loanManager.connect(borrower).repayLoan(0);

      const loan = await loanManager.getLoan(0);
      expect(loan.status).to.equal(1); // REPAID
    });
  });

  // ============================================================
  //                    PRICE ORACLE
  // ============================================================

  describe("Price Oracle", function () {
    it("should return correct price from Chainlink feed", async function () {
      const [price, confidence] = await priceOracle.getPrice(await collateralToken.getAddress());
      expect(price).to.equal(TOKEN_PRICE_USDC); // 10 USDC
      expect(confidence).to.equal(true);
    });

    it("should calculate correct USDC value for token amount", async function () {
      // 100 tokens at $10 each = $1000 USDC
      const amount = ethers.parseUnits("100", TOKEN_DECIMALS);
      const value = await priceOracle.getValueInUsdc(await collateralToken.getAddress(), amount);
      expect(value).to.equal(ethers.parseUnits("1000", USDC_DECIMALS));
    });
  });
});
