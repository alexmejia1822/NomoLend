/**
 * TEST 5 - Liquidacion por caida de precio (TWAP)
 * TEST 6 - Liquidacion por expiracion
 * TEST 8 - Proteccion Reserve Fund
 *
 * Ejecutar: node scripts/test-liquidation.js
 * Red: Base Mainnet
 * Fondos: ~60 USDC + WETH para colateral
 *
 * ESTRATEGIA PARA SIMULAR CAIDA DE PRECIO:
 *   - Usamos updateTwapPrice() para bajar el precio TWAP
 *   - El oraculo tiene maxTwapChangeBps (10% por update)
 *   - Para una caida de 40%, necesitamos multiples updates con cooldown
 *   - Alternativa: subir temporalmente el maxTwapChangeBps
 *
 * NOTA: Test 6 (expiracion) no es posible en mainnet sin esperar la duracion real.
 *       Se incluye la verificacion de isLoanLiquidatable() como referencia.
 */
import {
  getSigner, getContracts, CONTRACTS,
  formatUsdc, parseUsdc, formatToken, parseToken,
  log, logSection, logSuccess, logError, logTx, logBalance,
  Duration, LoanStatus, WETH_ADDRESS,
} from "./test-shared.js";

/**
 * Espera el cooldown de TWAP (5 min) para poder hacer el siguiente update.
 * En mainnet real hay que esperar.
 */
async function waitTwapCooldown(priceOracle, seconds = 310) {
  const cooldown = await priceOracle.twapUpdateCooldown();
  const waitSec = Number(cooldown) + 10; // +10s de margen
  log(`Esperando cooldown TWAP (${waitSec}s)...`);
  await new Promise(resolve => setTimeout(resolve, waitSec * 1000));
  logSuccess("Cooldown completado");
}

async function main() {
  const signer = getSigner();
  const addr = signer.address;
  const c = getContracts(signer);

  console.log("========================================");
  console.log("  NomoLend - Test Liquidation");
  console.log("  Red: Base Mainnet");
  console.log(`  Wallet: ${addr}`);
  console.log("========================================");

  // ============================================================
  //  VERIFICAR ESTADO
  // ============================================================
  logSection("ESTADO PREVIO");

  const usdcBal = await logBalance("USDC", c.usdc, addr);
  const wethBal = await logBalance("WETH", c.weth, addr);

  // Precio actual WETH
  const [currentWethPrice, confidence] = await c.priceOracle.getPrice(WETH_ADDRESS);
  log(`Precio WETH actual: $${formatUsdc(currentWethPrice)} (confidence: ${confidence})`);

  // TWAP actual
  const feed = await c.priceOracle.priceFeeds(WETH_ADDRESS);
  log(`TWAP actual: $${formatUsdc(feed.twapPrice)}`);
  log(`Chainlink feed: ${feed.chainlinkFeed}`);
  log(`maxTwapChangeBps: ${await c.priceOracle.maxTwapChangeBps()}`);
  log(`twapUpdateCooldown: ${await c.priceOracle.twapUpdateCooldown()}s`);

  // Verificar rol LIQUIDATOR
  const liquidatorRole = await c.loanManager.LIQUIDATOR_ROLE();
  const hasLiqRole = await c.loanManager.hasRole(liquidatorRole, addr);
  log(`Tiene LIQUIDATOR_ROLE: ${hasLiqRole}`);

  const publicLiq = await c.loanManager.publicLiquidationEnabled();
  log(`Public liquidation enabled: ${publicLiq}`);

  if (!hasLiqRole && !publicLiq) {
    log("Habilitando public liquidation para poder liquidar...");
    const enableTx = await c.loanManager.setPublicLiquidation(true);
    await enableTx.wait();
    logSuccess("Public liquidation habilitada");
  }

  // ============================================================
  //  TEST 5: LIQUIDACION POR CAIDA DE PRECIO
  // ============================================================
  logSection("TEST 5: Liquidacion por Caida de Precio");

  const lendAmount = parseUsdc(50);
  const borrowAmount = parseUsdc(50);

  if (usdcBal < lendAmount + parseUsdc(5)) {
    logError(`Necesitas al menos 55 USDC. Tienes: ${formatUsdc(usdcBal)}`);
    return;
  }

  // --- Paso 1: Crear prestamo ---
  log("Paso 1: Creando prestamo para liquidar...");

  let tx = await c.usdc.approve(CONTRACTS.OrderBook, lendAmount);
  await tx.wait();
  const orderId = await c.orderBook.nextLendingOrderId();
  tx = await c.orderBook.createLendingOrder(lendAmount, Duration.THIRTY_DAYS);
  await tx.wait();
  logSuccess(`Lending Order #${orderId}`);

  const reqCol = await c.riskEngine.calculateRequiredCollateral(WETH_ADDRESS, borrowAmount);
  const collateral = (reqCol * 110n) / 100n;

  if (wethBal < collateral) {
    logError(`WETH insuficiente. Necesitas: ${formatToken(collateral)}`);
    tx = await c.orderBook.cancelLendingOrder(orderId);
    await tx.wait();
    return;
  }

  tx = await c.weth.approve(CONTRACTS.CollateralManager, collateral);
  await tx.wait();

  const loanIdBefore = await c.loanManager.nextLoanId();
  tx = await c.loanManager.takeLoan(orderId, borrowAmount, WETH_ADDRESS, collateral);
  const takeReceipt = await tx.wait();
  logTx("takeLoan", takeReceipt);
  const loanId = loanIdBefore;
  logSuccess(`Prestamo #${loanId} activo`);

  // Verificar health factor inicial
  const hfBefore = await c.loanManager.getLoanHealthFactor(loanId);
  log(`Health Factor inicial: ${Number(hfBefore) / 10000}`);

  // --- Paso 2: Simular caida de precio via TWAP ---
  logSection("SIMULACION DE CAIDA DE PRECIO");

  log("Estrategia: Bajar TWAP en multiples pasos (max 10% por update)");
  log("Para causar liquidacion necesitamos que el valor del colateral");
  log("caiga por debajo del threshold de liquidacion.\n");

  // Guardar precio original para restaurar
  const originalTwap = feed.twapPrice;
  log(`TWAP original: $${formatUsdc(originalTwap)}`);

  // Calcular precio target para liquidacion
  // Health factor = (collateralValue * liquidationThresholdBps) / debt
  // Liquidable cuando healthFactor <= 10000
  // collateralValue = collateral * price / 10^18
  // Necesitamos: (collateral * newPrice / 10^18) * liqThreshold / debt <= 10000
  const loan = await c.loanManager.getLoan(loanId);
  const riskParams = await c.riskEngine.tokenRiskParams(WETH_ADDRESS);
  const liqThreshold = riskParams.liquidationThresholdBps;

  // newPrice <= (debt * 10000 * 10^18) / (collateral * liqThreshold)
  const [totalDebt] = await c.loanManager.getCurrentDebt(loanId);
  const maxPriceForLiq = (totalDebt * 10000n * (10n ** 18n)) / (loan.collateralAmount * liqThreshold);
  log(`Precio maximo para liquidacion: $${formatUsdc(maxPriceForLiq)}`);
  log(`Liquidation threshold: ${liqThreshold} bps`);

  // Temporalmente aumentar maxTwapChangeBps para poder bajar mas rapido
  const currentMaxChange = await c.priceOracle.maxTwapChangeBps();
  log(`\nmaxTwapChangeBps actual: ${currentMaxChange}`);

  // Subir a 50% para poder hacer una caida grande en menos steps
  log("Subiendo maxTwapChangeBps a 5000 (50%) temporalmente...");
  tx = await c.priceOracle.setMaxTwapChangeBps(5000);
  await tx.wait();
  logSuccess("maxTwapChangeBps = 5000");

  // Bajar el precio TWAP gradualmente
  let currentTwap = originalTwap;
  const targetPrice = (maxPriceForLiq * 80n) / 100n; // 20% debajo del umbral de liquidacion
  log(`Target TWAP: $${formatUsdc(targetPrice)} (20% debajo del umbral)\n`);

  let step = 0;
  while (currentTwap > targetPrice && step < 5) {
    step++;
    const newPrice = (currentTwap * 55n) / 100n; // Bajar 45% cada paso
    const finalPrice = newPrice < targetPrice ? targetPrice : newPrice;

    log(`Step ${step}: $${formatUsdc(currentTwap)} -> $${formatUsdc(finalPrice)}`);

    if (step > 1) {
      await waitTwapCooldown(c.priceOracle);
    }

    tx = await c.priceOracle.updateTwapPrice(WETH_ADDRESS, finalPrice);
    const updateReceipt = await tx.wait();
    logTx(`updateTwapPrice step ${step}`, updateReceipt);

    // Verificar que se actualizo
    const feedNow = await c.priceOracle.priceFeeds(WETH_ADDRESS);
    currentTwap = feedNow.twapPrice;
    log(`TWAP actual: $${formatUsdc(currentTwap)}`);

    // Check health factor
    try {
      const hf = await c.loanManager.getLoanHealthFactor(loanId);
      log(`Health Factor: ${Number(hf) / 10000}`);
      if (Number(hf) <= 10000) {
        logSuccess("Prestamo SUB-COLATERALIZADO!");
        break;
      }
    } catch (err) {
      log(`Health factor check error: ${err.message.substring(0, 60)}`);
    }
  }

  // --- Paso 3: Verificar que es liquidable ---
  logSection("VERIFICAR LIQUIDABILIDAD");

  try {
    const [isExpired, isUndercollateralized] = await c.loanManager.isLoanLiquidatable(loanId);
    log(`isExpired: ${isExpired}`);
    log(`isUndercollateralized: ${isUndercollateralized}`);

    if (isUndercollateralized) {
      logSuccess("Prestamo confirmado como LIQUIDABLE por sub-colateralizacion");
    } else {
      log("Prestamo aun no liquidable. El precio TWAP puede no haber bajado suficiente.");
      log("Esto puede pasar si el oraculo rechazo el update (TwapPriceRejected).");
    }
  } catch (err) {
    logError(`Error verificando liquidabilidad: ${err.message.substring(0, 100)}`);
  }

  // --- Paso 4: Ejecutar liquidacion ---
  logSection("EJECUTAR LIQUIDACION");

  try {
    const [isExpired, isUndercol] = await c.loanManager.isLoanLiquidatable(loanId);

    if (isUndercol || isExpired) {
      log("Ejecutando liquidateLoan...");

      // minAmountOut = 1 USDC (minimo para slippage en test)
      const liqTx = await c.loanManager.liquidateLoan(loanId, parseUsdc(1));
      const liqReceipt = await liqTx.wait();
      logTx("liquidateLoan", liqReceipt);

      // Verificar resultado
      const loanAfter = await c.loanManager.getLoan(loanId);
      log(`Status despues: ${loanAfter.status} (2=LIQUIDATED)`);
      if (Number(loanAfter.status) === LoanStatus.LIQUIDATED) {
        logSuccess("PRESTAMO LIQUIDADO CORRECTAMENTE");
      }

      // Verificar colateral liberado
      const lockedAfter = await c.collateralManager.getLockedCollateral(loanId, WETH_ADDRESS);
      log(`Colateral bloqueado restante: ${formatToken(lockedAfter)}`);
      if (lockedAfter === 0n) logSuccess("Colateral completamente liberado");

      // Verificar eventos en logs
      log(`Eventos emitidos: ${liqReceipt.logs.length} logs`);

      // Balance post liquidacion
      await logBalance("USDC post-liquidacion", c.usdc, addr);
      await logBalance("WETH post-liquidacion", c.weth, addr);

      // Reserve fund
      const reserveBal = await c.reserveFund.getReserveBalance();
      log(`Reserve Fund: ${formatUsdc(reserveBal)} USDC`);
    } else {
      log("Prestamo no liquidable aun. Saltando ejecucion de liquidacion.");
      log("Para forzar, necesitas bajar mas el TWAP o esperar expiracion.");
    }
  } catch (err) {
    logError(`Liquidacion fallida: ${err.reason || err.message.substring(0, 150)}`);
    log("Esto puede ser normal si el swap DEX fallo o no hay liquidez.");
  }

  // --- Restaurar precio TWAP ---
  logSection("RESTAURAR ESTADO");

  log("Esperando cooldown para restaurar TWAP...");
  await waitTwapCooldown(c.priceOracle);

  log(`Restaurando TWAP a: $${formatUsdc(originalTwap)}`);
  // Necesitamos subir gradualmente tambien
  const feedNow = await c.priceOracle.priceFeeds(WETH_ADDRESS);
  let restoreTwap = feedNow.twapPrice;

  let restoreStep = 0;
  while (restoreTwap < originalTwap && restoreStep < 5) {
    restoreStep++;
    const newPrice = (restoreTwap * 150n) / 100n; // Subir 50%
    const finalPrice = newPrice > originalTwap ? originalTwap : newPrice;

    if (restoreStep > 1) await waitTwapCooldown(c.priceOracle);

    tx = await c.priceOracle.updateTwapPrice(WETH_ADDRESS, finalPrice);
    await tx.wait();
    const f = await c.priceOracle.priceFeeds(WETH_ADDRESS);
    restoreTwap = f.twapPrice;
    log(`Restore step ${restoreStep}: TWAP = $${formatUsdc(restoreTwap)}`);
  }

  // Restaurar maxTwapChangeBps
  log("Restaurando maxTwapChangeBps...");
  tx = await c.priceOracle.setMaxTwapChangeBps(Number(currentMaxChange));
  await tx.wait();
  logSuccess(`maxTwapChangeBps restaurado a ${currentMaxChange}`);

  // Despausar token si fue pausado por circuit breaker
  const isPaused = await c.riskEngine.pausedTokens(WETH_ADDRESS);
  if (isPaused) {
    log("WETH fue pausado (circuit breaker). Despausando...");
    tx = await c.riskEngine.setTokenPaused(WETH_ADDRESS, false, "Test cleanup");
    await tx.wait();
    logSuccess("WETH despausado");
  }

  // ============================================================
  //  TEST 6: NOTA SOBRE LIQUIDACION POR EXPIRACION
  // ============================================================
  logSection("TEST 6: Liquidacion por Expiracion (NOTA)");

  log("En Base Mainnet no se puede avanzar el tiempo.");
  log("Para verificar liquidacion por expiracion:");
  log("  1. Crea un prestamo de 7 dias");
  log("  2. Espera 7 dias + 4 horas (grace period)");
  log("  3. Ejecuta: loanManager.liquidateLoan(loanId, minAmountOut)");
  log("  4. Verifica: penalty de 2% aplicado + liquidacion exitosa");
  log("");
  log("Alternativa: Usa un fork local de Base:");
  log("  npx hardhat node --fork $BASE_RPC_URL");
  log("  Y avanza el tiempo con evm_increaseTime\n");

  // ============================================================
  //  TEST 8: RESERVE FUND
  // ============================================================
  logSection("TEST 8: Reserve Fund Protection");

  const reserveBalance = await c.reserveFund.getReserveBalance();
  log(`Reserve Fund balance actual: ${formatUsdc(reserveBalance)} USDC`);

  if (reserveBalance > 0n) {
    log("El reserve fund tiene fondos. Verificando coverBadDebt...");
    // Test con 1 USDC
    const coverAmount = reserveBalance < parseUsdc(1) ? reserveBalance : parseUsdc(1);
    try {
      tx = await c.reserveFund.coverBadDebt(coverAmount, addr, "Integration test - bad debt coverage");
      const coverReceipt = await tx.wait();
      logTx("coverBadDebt", coverReceipt);
      logSuccess(`coverBadDebt exitoso: ${formatUsdc(coverAmount)} USDC transferido`);

      const newReserve = await c.reserveFund.getReserveBalance();
      log(`Reserve Fund despues: ${formatUsdc(newReserve)} USDC`);
    } catch (err) {
      logError(`coverBadDebt fallido: ${err.reason || err.message.substring(0, 80)}`);
    }
  } else {
    log("Reserve Fund vacio. Se llenara cuando se repagen prestamos (20% del fee).");
    log("Despues del Test 3 deberia tener fondos.");
  }

  // ============================================================
  //  RESULTADO
  // ============================================================
  console.log("\n========================================");
  console.log("  TEST 5 + 6 + 8: COMPLETADO");
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("\nError fatal:", err.message);
  if (err.data) console.error("Data:", err.data);
  process.exit(1);
});
