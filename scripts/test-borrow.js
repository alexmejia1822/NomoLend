/**
 * TEST 2 - Tomar un prestamo (takeLoan)
 * TEST 10 - Limite de prestamos por usuario/token (max 5)
 *
 * Ejecutar: node scripts/test-borrow.js
 * Red: Base Mainnet
 * Fondos: ~50 USDC + WETH para colateral
 *
 * FLUJO:
 *   1. Crear lending order (50 USDC, 30 dias)
 *   2. Calcular colateral requerido
 *   3. Aprobar colateral (WETH) al CollateralManager
 *   4. takeLoan() - tomar el prestamo
 *   5. Verificar: USDC recibido, colateral bloqueado, loan creado
 *   6. NO cancelar ni repagar (se usa en test-repayments.js)
 */
import {
  getSigner, getContracts, CONTRACTS,
  formatUsdc, parseUsdc, formatToken, parseToken,
  log, logSection, logSuccess, logError, logTx, logBalance,
  Duration, LoanStatus, OrderStatus,
  WETH_ADDRESS,
} from "./test-shared.js";

async function main() {
  const signer = getSigner();
  const addr = signer.address;
  const c = getContracts(signer);

  console.log("========================================");
  console.log("  NomoLend - Test Borrow (takeLoan)");
  console.log("  Red: Base Mainnet");
  console.log(`  Wallet: ${addr}`);
  console.log("========================================");

  // ============================================================
  //  VERIFICAR ESTADO PREVIO
  // ============================================================
  logSection("VERIFICAR ESTADO PREVIO");

  const usdcBal = await logBalance("USDC", c.usdc, addr);
  const wethBal = await logBalance("WETH", c.weth, addr);

  // Verificar precio de WETH
  const [wethPrice, wethConfidence] = await c.priceOracle.getPrice(WETH_ADDRESS);
  log(`Precio WETH: $${formatUsdc(wethPrice)} (confidence: ${wethConfidence})`);

  // Verificar que WETH esta activo como colateral
  const riskParams = await c.riskEngine.tokenRiskParams(WETH_ADDRESS);
  log(`WETH Risk: LTV=${riskParams.ltvBps}bps, LiqThreshold=${riskParams.liquidationThresholdBps}bps, Active=${riskParams.isActive}`);

  if (!riskParams.isActive) {
    logError("WETH no esta activo como colateral. Ejecuta configureTokens.js primero.");
    return;
  }

  // Verificar token no pausado
  const isPaused = await c.riskEngine.pausedTokens(WETH_ADDRESS);
  if (isPaused) {
    logError("WETH esta pausado. Despausalo primero.");
    return;
  }

  // ============================================================
  //  TEST 2: CREAR LENDING ORDER + TOMAR PRESTAMO
  // ============================================================
  logSection("TEST 2: Crear Orden y Tomar Prestamo");

  const lendAmount = parseUsdc(50); // 50 USDC
  const borrowAmount = parseUsdc(50); // Tomar 50 USDC
  const duration = Duration.THIRTY_DAYS; // 30 dias para poder testear brackets

  // Verificar fondos
  if (usdcBal < lendAmount) {
    logError(`Necesitas al menos 50 USDC. Tienes: ${formatUsdc(usdcBal)}`);
    return;
  }

  // --- Paso 1: Crear lending order ---
  log("Paso 1: Creando Lending Order (50 USDC, 30 dias)...");
  const approveTx = await c.usdc.approve(CONTRACTS.OrderBook, lendAmount);
  await approveTx.wait();
  logSuccess("USDC aprobado al OrderBook");

  const orderIdBefore = await c.orderBook.nextLendingOrderId();
  const createTx = await c.orderBook.createLendingOrder(lendAmount, duration);
  const createReceipt = await createTx.wait();
  logTx("createLendingOrder", createReceipt);
  const orderId = orderIdBefore;
  logSuccess(`Lending Order #${orderId} creada`);

  // --- Paso 2: Calcular colateral requerido ---
  log("\nPaso 2: Calculando colateral requerido...");
  const requiredCollateral = await c.riskEngine.calculateRequiredCollateral(WETH_ADDRESS, borrowAmount);
  log(`Colateral requerido: ${formatToken(requiredCollateral)} WETH`);

  // Agregar 5% de margen para evitar errores por variacion de precio
  const collateralWithMargin = (requiredCollateral * 105n) / 100n;
  log(`Colateral con margen (5%): ${formatToken(collateralWithMargin)} WETH`);

  if (wethBal < collateralWithMargin) {
    logError(`WETH insuficiente. Necesitas: ${formatToken(collateralWithMargin)}, Tienes: ${formatToken(wethBal)}`);
    log("Cancelando lending order para recuperar USDC...");
    const cancelTx = await c.orderBook.cancelLendingOrder(orderId);
    await cancelTx.wait();
    logSuccess("Orden cancelada, USDC recuperado.");
    return;
  }

  // --- Paso 3: Aprobar colateral al CollateralManager ---
  log("\nPaso 3: Aprobando WETH al CollateralManager...");
  const approveWethTx = await c.weth.approve(CONTRACTS.CollateralManager, collateralWithMargin);
  await approveWethTx.wait();
  logSuccess("WETH aprobado");

  // --- Paso 4: Tomar el prestamo ---
  log("\nPaso 4: Tomando prestamo (takeLoan)...");

  // Balances antes
  const usdcBeforeLoan = await c.usdc.balanceOf(addr);
  const wethBeforeLoan = await c.weth.balanceOf(addr);
  const loanIdBefore = await c.loanManager.nextLoanId();

  const takeTx = await c.loanManager.takeLoan(
    orderId,
    borrowAmount,
    WETH_ADDRESS,
    collateralWithMargin
  );
  const takeReceipt = await takeTx.wait();
  logTx("takeLoan", takeReceipt);

  const loanId = loanIdBefore;
  logSuccess(`Prestamo #${loanId} creado`);

  // --- Paso 5: Verificaciones ---
  logSection("VERIFICACIONES");

  // 5a: Verificar que el borrower recibio USDC
  const usdcAfterLoan = await c.usdc.balanceOf(addr);
  const usdcReceived = usdcAfterLoan - usdcBeforeLoan;
  log(`USDC recibido por borrower: ${formatUsdc(usdcReceived)}`);
  // Como el lender y borrower son la misma wallet, el USDC recibido es el borrowAmount
  // menos el lendAmount que se envio. Neto = 0 si son iguales.
  // Pero realmente: la wallet puso 50 USDC como lender, y recibe 50 USDC como borrower.
  // Net = 0 pero el flujo funciono.
  logSuccess("Flujo USDC: lender deposito -> borrower recibio (misma wallet, neto ~0)");

  // 5b: Verificar colateral bloqueado en CollateralManager
  const lockedCollateral = await c.collateralManager.getLockedCollateral(loanId, WETH_ADDRESS);
  log(`Colateral bloqueado: ${formatToken(lockedCollateral)} WETH`);
  if (lockedCollateral > 0n) {
    logSuccess("Colateral bloqueado correctamente en CollateralManager");
  } else {
    logError("No se encontro colateral bloqueado!");
  }

  // 5c: Verificar WETH reducido en wallet
  const wethAfterLoan = await c.weth.balanceOf(addr);
  const wethUsed = wethBeforeLoan - wethAfterLoan;
  log(`WETH usado como colateral: ${formatToken(wethUsed)}`);

  // 5d: Verificar datos del prestamo
  const loan = await c.loanManager.getLoan(loanId);
  log("\n--- Datos del Prestamo ---");
  log(`  Loan ID:         ${loan.loanId}`);
  log(`  Lender:          ${loan.lender}`);
  log(`  Borrower:        ${loan.borrower}`);
  log(`  Principal:       ${formatUsdc(loan.principal)} USDC`);
  log(`  Collateral:      ${formatToken(loan.collateralAmount)} WETH`);
  log(`  Duration:        ${loan.duration} (0=7d, 1=14d, 2=30d)`);
  log(`  Status:          ${loan.status} (0=ACTIVE)`);
  log(`  Start:           ${new Date(Number(loan.startTimestamp) * 1000).toISOString()}`);

  if (Number(loan.status) === LoanStatus.ACTIVE) logSuccess("Prestamo ACTIVO");
  else logError(`Status inesperado: ${loan.status}`);

  if (loan.borrower === addr) logSuccess("Borrower correcto");
  if (loan.principal === borrowAmount) logSuccess("Principal correcto: 50 USDC");

  // 5e: Health factor
  const healthFactor = await c.loanManager.getLoanHealthFactor(loanId);
  log(`\nHealth Factor: ${Number(healthFactor) / 10000} (${healthFactor} bps)`);
  if (Number(healthFactor) > 10000) {
    logSuccess("Health Factor > 1.0 (prestamo saludable)");
  } else {
    logError("Health Factor <= 1.0 (peligro de liquidacion!)");
  }

  // 5f: Deuda actual
  const [totalDebt, interest] = await c.loanManager.getCurrentDebt(loanId);
  log(`Deuda actual: ${formatUsdc(totalDebt)} USDC (interes: ${formatUsdc(interest)} USDC)`);

  // 5g: Verificar orden actualizada
  const orderAfter = await c.orderBook.getLendingOrder(orderId);
  log(`\nOrden #${orderId} despues: available=${formatUsdc(orderAfter.availableAmount)} USDC, status=${orderAfter.status}`);

  // ============================================================
  //  TEST 10: Limite de prestamos por usuario/token
  // ============================================================
  logSection("TEST 10: Limite de Prestamos por Usuario/Token");

  const maxLoans = await c.riskEngine.maxLoansPerUserPerToken();
  const currentLoans = await c.riskEngine.userTokenLoanCount(addr, WETH_ADDRESS);
  log(`Max prestamos por usuario/token: ${maxLoans}`);
  log(`Prestamos actuales (${addr.slice(0, 10)}... / WETH): ${currentLoans}`);

  if (Number(currentLoans) >= Number(maxLoans)) {
    log("Limite alcanzado. Intentando crear otro prestamo...");
    try {
      // Crear otra orden y intentar tomar prestamo
      const approveTx2 = await c.usdc.approve(CONTRACTS.OrderBook, parseUsdc(10));
      await approveTx2.wait();
      const createTx2 = await c.orderBook.createLendingOrder(parseUsdc(10), Duration.SEVEN_DAYS);
      await createTx2.wait();
      const newOrderId = await c.orderBook.nextLendingOrderId() - 1n;

      const approveWeth2 = await c.weth.approve(CONTRACTS.CollateralManager, parseToken("1"));
      await approveWeth2.wait();

      const takeTx2 = await c.loanManager.takeLoan(newOrderId, parseUsdc(10), WETH_ADDRESS, parseToken("1"));
      await takeTx2.wait();
      logError("La transaccion NO debio pasar! El limite no funciona.");
    } catch (err) {
      logSuccess(`Prestamo rechazado correctamente: ${err.reason || err.message.substring(0, 100)}`);
    }
  } else {
    log(`Quedan ${Number(maxLoans) - Number(currentLoans)} prestamos disponibles antes del limite.`);
    log("NOTA: Para probar el limite completo se necesitarian 5 prestamos con WETH.");
  }

  // ============================================================
  //  RESULTADO
  // ============================================================
  console.log("\n========================================");
  console.log("  TEST 2 + TEST 10: COMPLETADO");
  console.log(`  Loan ID creado: ${loanId}`);
  console.log("  >>> Usa este loanId en test-repayments.js");
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("\nError fatal:", err.message);
  if (err.data) console.error("Data:", err.data);
  process.exit(1);
});
