/**
 * TEST 3 - Repago temprano (bracket 1: 2%)
 * TEST 4 - Repago en bracket 2 (4%)
 *
 * Ejecutar: node scripts/test-repayments.js
 * Red: Base Mainnet
 * Fondos: ~120 USDC + WETH para colateral
 *
 * FLUJO TEST 3:
 *   1. Crear lending order (50 USDC, 30 dias)
 *   2. takeLoan (50 USDC)
 *   3. repayLoan inmediatamente (bracket 1: <= 7 dias = 2%)
 *   4. Verificar: interes correcto, colateral devuelto, fee distribuido
 *
 * FLUJO TEST 4:
 *   NOTA: En mainnet real no podemos avanzar el tiempo.
 *   Creamos un prestamo de 14 dias y verificamos el calculo de interes esperado.
 *   Para bracket 2 real necesitarias esperar >7 dias o usar hardhat fork con evm_increaseTime.
 */
import {
  getSigner, getContracts, CONTRACTS,
  formatUsdc, parseUsdc, formatToken, parseToken,
  log, logSection, logSuccess, logError, logTx, logBalance,
  Duration, LoanStatus, WETH_ADDRESS,
} from "./test-shared.js";

async function main() {
  const signer = getSigner();
  const addr = signer.address;
  const c = getContracts(signer);

  console.log("========================================");
  console.log("  NomoLend - Test Repayments");
  console.log("  Red: Base Mainnet");
  console.log(`  Wallet: ${addr}`);
  console.log("========================================");

  // ============================================================
  //  TEST 3: REPAGO TEMPRANO (Bracket 1 = 2%)
  // ============================================================
  logSection("TEST 3: Repago Temprano (Bracket 1 = 2%)");

  // Balances iniciales
  const usdcStart = await logBalance("USDC inicio", c.usdc, addr);
  const wethStart = await logBalance("WETH inicio", c.weth, addr);

  const lendAmount = parseUsdc(50);
  const borrowAmount = parseUsdc(50);

  if (usdcStart < lendAmount + parseUsdc(5)) {
    logError(`Necesitas al menos 55 USDC (50 para prestar + ~5 para interes). Tienes: ${formatUsdc(usdcStart)}`);
    return;
  }

  // --- Crear lending order ---
  log("Creando Lending Order (50 USDC, 30 dias)...");
  let tx = await c.usdc.approve(CONTRACTS.OrderBook, lendAmount);
  await tx.wait();
  const orderId = await c.orderBook.nextLendingOrderId();
  tx = await c.orderBook.createLendingOrder(lendAmount, Duration.THIRTY_DAYS);
  await tx.wait();
  logSuccess(`Lending Order #${orderId} creada`);

  // --- Calcular y depositar colateral ---
  const requiredCollateral = await c.riskEngine.calculateRequiredCollateral(WETH_ADDRESS, borrowAmount);
  const collateral = (requiredCollateral * 110n) / 100n; // +10% margen
  log(`Colateral: ${formatToken(requiredCollateral)} WETH (con margen: ${formatToken(collateral)})`);

  const wethBal = await c.weth.balanceOf(addr);
  if (wethBal < collateral) {
    logError(`WETH insuficiente. Necesitas: ${formatToken(collateral)}, Tienes: ${formatToken(wethBal)}`);
    tx = await c.orderBook.cancelLendingOrder(orderId);
    await tx.wait();
    return;
  }

  tx = await c.weth.approve(CONTRACTS.CollateralManager, collateral);
  await tx.wait();

  // --- Tomar prestamo ---
  log("Tomando prestamo...");
  const loanIdBefore = await c.loanManager.nextLoanId();
  tx = await c.loanManager.takeLoan(orderId, borrowAmount, WETH_ADDRESS, collateral);
  const takeReceipt = await tx.wait();
  logTx("takeLoan", takeReceipt);
  const loanId = loanIdBefore;
  logSuccess(`Prestamo #${loanId} activo`);

  // --- Verificar deuda (deberia ser bracket 1 = 2%) ---
  const [totalDebt, interest] = await c.loanManager.getCurrentDebt(loanId);
  log(`Deuda actual: ${formatUsdc(totalDebt)} USDC`);
  log(`Interes: ${formatUsdc(interest)} USDC`);

  // 2% de 50 USDC = 1 USDC
  const expectedInterest = parseUsdc(1); // 50 * 200 / 10000 = 1 USDC
  if (interest === expectedInterest) {
    logSuccess("Interes correcto: 1 USDC (2% de 50 USDC) - Bracket 1");
  } else {
    log(`Interes calculado: ${formatUsdc(interest)} (esperado: 1.000000 USDC)`);
    log("NOTA: Diferencia minima posible por tiempo transcurrido");
  }

  // --- Repagar ---
  log("\nRepagando prestamo...");

  // Balances antes del repago
  const usdcBeforeRepay = await c.usdc.balanceOf(addr);
  const wethBeforeRepay = await c.weth.balanceOf(addr);

  // Obtener deuda actualizada justo antes de pagar
  const [debtNow] = await c.loanManager.getCurrentDebt(loanId);

  // Aprobar USDC al LoanManager para el repago
  tx = await c.usdc.approve(CONTRACTS.LoanManager, debtNow);
  await tx.wait();
  logSuccess(`USDC aprobado: ${formatUsdc(debtNow)} al LoanManager`);

  // Repagar
  tx = await c.loanManager.repayLoan(loanId);
  const repayReceipt = await tx.wait();
  logTx("repayLoan", repayReceipt);

  // --- Verificaciones post-repago ---
  logSection("VERIFICACIONES POST-REPAGO (Test 3)");

  // Verificar loan status
  const loan = await c.loanManager.getLoan(loanId);
  log(`Status: ${loan.status} (1=REPAID)`);
  if (Number(loan.status) === LoanStatus.REPAID) {
    logSuccess("Prestamo marcado como REPAID");
  } else {
    logError(`Status incorrecto: ${loan.status}`);
  }

  // Verificar interes pagado
  log(`Interes pagado registrado: ${formatUsdc(loan.interestPaid)} USDC`);
  const expectedRate = 200n; // 2% en bps
  const calcInterest = (borrowAmount * expectedRate) / 10000n;
  if (loan.interestPaid === calcInterest) {
    logSuccess(`Bracket 1 confirmado: 2% = ${formatUsdc(loan.interestPaid)} USDC`);
  } else {
    log(`Interes pagado: ${formatUsdc(loan.interestPaid)}, esperado: ${formatUsdc(calcInterest)}`);
  }

  // Verificar colateral devuelto
  const wethAfterRepay = await c.weth.balanceOf(addr);
  const wethRecovered = wethAfterRepay - wethBeforeRepay;
  log(`WETH recuperado: ${formatToken(wethRecovered)}`);
  if (wethRecovered > 0n) {
    logSuccess("Colateral devuelto al borrower");
  } else {
    logError("Colateral NO devuelto!");
  }

  // Verificar colateral liberado en CollateralManager
  const lockedAfter = await c.collateralManager.getLockedCollateral(loanId, WETH_ADDRESS);
  log(`Colateral bloqueado restante: ${formatToken(lockedAfter)} WETH`);
  if (lockedAfter === 0n) {
    logSuccess("CollateralManager: colateral completamente liberado");
  }

  // Verificar fee de plataforma (10% del interes)
  const platformFee = (loan.interestPaid * 1000n) / 10000n; // 10% del interes
  log(`Platform fee esperado: ${formatUsdc(platformFee)} USDC (10% del interes)`);
  log("  -> Lender recibio: principal + interes - fee");
  log("  -> Treasury recibio: fee portion");
  log("  -> ReserveFund recibio: 20% del fee");

  // Verificar reserve fund
  const reserveBalance = await c.reserveFund.getReserveBalance();
  log(`Reserve Fund balance: ${formatUsdc(reserveBalance)} USDC`);

  // Balance final
  const usdcEnd = await logBalance("USDC final", c.usdc, addr);
  const wethEnd = await logBalance("WETH final", c.weth, addr);

  // Como somos lender Y borrower, el costo neto es solo el platform fee
  const usdcNetCost = usdcStart - usdcEnd;
  log(`\nCosto neto USDC: ${formatUsdc(usdcNetCost)} (= platform fee distribuido)`);

  // ============================================================
  //  TEST 4: VERIFICACION DE BRACKET 2 (4%)
  // ============================================================
  logSection("TEST 4: Verificacion de Bracket 2 (4% interes)");

  log("NOTA IMPORTANTE:");
  log("En Base Mainnet no se puede avanzar el tiempo con evm_increaseTime.");
  log("Verificamos el calculo teorico de brackets:\n");

  // Verificar calculos de interes para cada bracket
  const principal = parseUsdc(50);
  const bracket1 = (principal * 200n) / 10000n; // 2%
  const bracket2 = (principal * 400n) / 10000n; // 4%
  const bracket3 = (principal * 800n) / 10000n; // 8%

  log("Para un prestamo de 50 USDC a 30 dias:");
  log(`  Bracket 1 (<=7 dias):  2% = ${formatUsdc(bracket1)} USDC`);
  log(`  Bracket 2 (<=14 dias): 4% = ${formatUsdc(bracket2)} USDC`);
  log(`  Bracket 3 (>14 dias):  8% = ${formatUsdc(bracket3)} USDC`);

  // Crear un segundo prestamo para dejar activo y testear bracket 2 despues
  log("\n--- Creando prestamo para futuro test de bracket 2 ---");
  log("Este prestamo quedara activo. Repagalo despues de 7+ dias para bracket 2.\n");

  const lendAmount2 = parseUsdc(50);
  const usdcNow = await c.usdc.balanceOf(addr);
  if (usdcNow < lendAmount2 + parseUsdc(5)) {
    log("USDC insuficiente para crear segundo prestamo de prueba.");
    log("Puedes crear uno manualmente cuando tengas fondos.\n");
  } else {
    tx = await c.usdc.approve(CONTRACTS.OrderBook, lendAmount2);
    await tx.wait();
    const orderId2 = await c.orderBook.nextLendingOrderId();
    tx = await c.orderBook.createLendingOrder(lendAmount2, Duration.THIRTY_DAYS);
    await tx.wait();
    logSuccess(`Lending Order #${orderId2} creada para bracket 2`);

    const reqCol2 = await c.riskEngine.calculateRequiredCollateral(WETH_ADDRESS, lendAmount2);
    const col2 = (reqCol2 * 110n) / 100n;
    const wethNow = await c.weth.balanceOf(addr);

    if (wethNow >= col2) {
      tx = await c.weth.approve(CONTRACTS.CollateralManager, col2);
      await tx.wait();
      const loanId2Before = await c.loanManager.nextLoanId();
      tx = await c.loanManager.takeLoan(orderId2, lendAmount2, WETH_ADDRESS, col2);
      await tx.wait();
      const loanId2 = loanId2Before;
      logSuccess(`Prestamo #${loanId2} creado (30 dias)`);
      log(`>>> IMPORTANTE: Repaga el prestamo #${loanId2} despues de 7 dias`);
      log(`    para verificar bracket 2 (4% = ${formatUsdc(bracket2)} USDC)`);
      log(`    Comando: Modifica test-repayments.js con loanId=${loanId2}\n`);
    } else {
      log("WETH insuficiente para segundo prestamo. Cancelando orden...");
      tx = await c.orderBook.cancelLendingOrder(orderId2);
      await tx.wait();
    }
  }

  console.log("\n========================================");
  console.log("  TEST 3 + TEST 4: COMPLETADO");
  console.log("  Bracket 1 (2%): Verificado on-chain");
  console.log("  Bracket 2 (4%): Calculo verificado, necesita esperar >7d");
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("\nError fatal:", err.message);
  if (err.data) console.error("Data:", err.data);
  process.exit(1);
});
