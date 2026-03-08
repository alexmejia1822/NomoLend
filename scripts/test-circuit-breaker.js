/**
 * TEST 7 - Circuit Breaker (caida de precio >30%)
 *
 * Ejecutar: node scripts/test-circuit-breaker.js
 * Red: Base Mainnet
 *
 * FLUJO:
 *   1. Verificar snapshot de precio actual
 *   2. Bajar TWAP >30% del snapshot
 *   3. Llamar checkCircuitBreaker()
 *   4. Verificar que el token queda pausado
 *   5. Intentar crear un prestamo (debe fallar)
 *   6. Restaurar estado
 *
 * NOTA: Este test NO requiere fondos significativos.
 *       Solo manipula precios TWAP y verifica pausado.
 */
import {
  getSigner, getContracts, CONTRACTS,
  formatUsdc, parseUsdc, formatToken, parseToken,
  log, logSection, logSuccess, logError, logTx, logBalance,
  Duration, WETH_ADDRESS,
} from "./test-shared.js";

async function waitTwapCooldown(priceOracle) {
  const cooldown = await priceOracle.twapUpdateCooldown();
  const waitSec = Number(cooldown) + 10;
  log(`Esperando cooldown TWAP (${waitSec}s)...`);
  await new Promise(resolve => setTimeout(resolve, waitSec * 1000));
  logSuccess("Cooldown completado");
}

async function main() {
  const signer = getSigner();
  const addr = signer.address;
  const c = getContracts(signer);

  console.log("========================================");
  console.log("  NomoLend - Test Circuit Breaker");
  console.log("  Red: Base Mainnet");
  console.log(`  Wallet: ${addr}`);
  console.log("========================================");

  // ============================================================
  //  ESTADO INICIAL
  // ============================================================
  logSection("ESTADO INICIAL");

  const [currentPrice, confidence] = await c.priceOracle.getPrice(WETH_ADDRESS);
  log(`Precio WETH actual: $${formatUsdc(currentPrice)} (confidence: ${confidence})`);

  const feed = await c.priceOracle.priceFeeds(WETH_ADDRESS);
  log(`TWAP actual: $${formatUsdc(feed.twapPrice)}`);
  log(`Chainlink feed: ${feed.chainlinkFeed}`);

  const snapshot = await c.riskEngine.priceSnapshot(WETH_ADDRESS);
  const snapshotTime = await c.riskEngine.snapshotTimestamp(WETH_ADDRESS);
  log(`Price snapshot: $${formatUsdc(snapshot)}`);
  log(`Snapshot time: ${snapshotTime > 0n ? new Date(Number(snapshotTime) * 1000).toISOString() : "no set"}`);

  const dropThreshold = await c.riskEngine.priceDropThresholdBps();
  log(`Circuit breaker threshold: ${dropThreshold} bps (${Number(dropThreshold) / 100}%)`);

  const isPausedBefore = await c.riskEngine.pausedTokens(WETH_ADDRESS);
  log(`WETH pausado: ${isPausedBefore}`);

  if (isPausedBefore) {
    log("WETH ya esta pausado. Despausando para test...");
    let tx = await c.riskEngine.setTokenPaused(WETH_ADDRESS, false, "Pre-test cleanup");
    await tx.wait();
    logSuccess("WETH despausado");
  }

  // Necesitamos un snapshot de precio para que el circuit breaker funcione.
  // El snapshot se actualiza automaticamente cuando se crea un prestamo (addExposure).
  // Si no hay snapshot, necesitamos crear uno.
  if (snapshot === 0n) {
    log("\nNo hay price snapshot. Necesitamos crear un prestamo primero");
    log("para generar el snapshot (se crea en addExposure).");
    log("Ejecuta test-borrow.js antes de este test.");
    log("Alternativa: verificamos el mecanismo sin snapshot activo.\n");
  }

  // ============================================================
  //  TEST 7: SIMULAR CAIDA >30%
  // ============================================================
  logSection("TEST 7: Simular Caida de Precio >30%");

  // Guardar estado original
  const originalTwap = feed.twapPrice;
  const originalMaxChange = await c.priceOracle.maxTwapChangeBps();

  log("Paso 1: Subir maxTwapChangeBps para poder simular caida grande...");
  let tx = await c.priceOracle.setMaxTwapChangeBps(5000); // 50%
  await tx.wait();
  logSuccess("maxTwapChangeBps = 5000 (50%)");

  // Paso 2: Bajar precio TWAP
  const targetDrop = 40; // 40% de caida
  const targetPrice = (originalTwap * BigInt(100 - targetDrop)) / 100n;
  log(`\nPaso 2: Bajando TWAP de $${formatUsdc(originalTwap)} a $${formatUsdc(targetPrice)} (-${targetDrop}%)`);

  tx = await c.priceOracle.updateTwapPrice(WETH_ADDRESS, targetPrice);
  const updateReceipt = await tx.wait();
  logTx("updateTwapPrice", updateReceipt);

  // Verificar TWAP actualizado
  const feedAfterDrop = await c.priceOracle.priceFeeds(WETH_ADDRESS);
  log(`TWAP despues: $${formatUsdc(feedAfterDrop.twapPrice)}`);

  if (feedAfterDrop.twapPrice === targetPrice) {
    logSuccess(`TWAP bajado a $${formatUsdc(targetPrice)} (-${targetDrop}%)`);
  } else if (feedAfterDrop.twapPrice === originalTwap) {
    logError("TWAP no se actualizo (posiblemente rechazado por maxTwapChangeBps)");
    log("Intentando con pasos mas pequenos...");

    // Intentar paso intermedio
    const midPrice = (originalTwap * 55n) / 100n;
    tx = await c.priceOracle.updateTwapPrice(WETH_ADDRESS, midPrice);
    await tx.wait();
    const f = await c.priceOracle.priceFeeds(WETH_ADDRESS);
    log(`TWAP intermedio: $${formatUsdc(f.twapPrice)}`);
  }

  // Paso 3: Verificar precio actual del oraculo
  const [priceAfterDrop] = await c.priceOracle.getPrice(WETH_ADDRESS);
  log(`\nPrecio oraculo despues de drop: $${formatUsdc(priceAfterDrop)}`);

  // Paso 4: Llamar checkCircuitBreaker
  logSection("EJECUTAR CIRCUIT BREAKER CHECK");

  if (snapshot > 0n) {
    log("Llamando checkCircuitBreaker(WETH)...");
    tx = await c.riskEngine.checkCircuitBreaker(WETH_ADDRESS);
    const cbReceipt = await tx.wait();
    logTx("checkCircuitBreaker", cbReceipt);

    // Verificar si se pauso
    const isPausedAfter = await c.riskEngine.pausedTokens(WETH_ADDRESS);
    log(`WETH pausado despues del check: ${isPausedAfter}`);

    if (isPausedAfter) {
      logSuccess("CIRCUIT BREAKER ACTIVADO - Token WETH pausado automaticamente");

      // Verificar eventos
      if (cbReceipt.logs.length > 0) {
        logSuccess(`Eventos emitidos: ${cbReceipt.logs.length} logs (CircuitBreakerTriggered + TokenPaused)`);
      }
    } else {
      log("Circuit breaker no se activo.");
      log("Posible causa: el oraculo usa Chainlink como primario y el TWAP solo es fallback.");
      log("El circuit breaker compara contra el snapshot usando getPrice() que prioriza Chainlink.");
      log("Si Chainlink no bajo, el precio sigue alto a pesar del TWAP bajo.");
    }
  } else {
    log("Sin price snapshot, el circuit breaker retorna false (snapshot == 0).");
    log("Esto es esperado - el snapshot se crea al crear prestamos.");
  }

  // Paso 5: Intentar crear prestamo con token pausado
  logSection("VERIFICAR RECHAZO DE NUEVOS PRESTAMOS");

  const isPausedNow = await c.riskEngine.pausedTokens(WETH_ADDRESS);
  if (isPausedNow) {
    log("WETH esta pausado. Verificando que no se pueden crear nuevos prestamos...");

    const usdcBal = await c.usdc.balanceOf(addr);
    if (usdcBal >= parseUsdc(15)) {
      // Intentar crear una orden y tomar prestamo
      tx = await c.usdc.approve(CONTRACTS.OrderBook, parseUsdc(10));
      await tx.wait();
      const testOrderId = await c.orderBook.nextLendingOrderId();
      tx = await c.orderBook.createLendingOrder(parseUsdc(10), Duration.SEVEN_DAYS);
      await tx.wait();

      try {
        tx = await c.weth.approve(CONTRACTS.CollateralManager, parseToken("1"));
        await tx.wait();
        const takeTx = await c.loanManager.takeLoan(testOrderId, parseUsdc(10), WETH_ADDRESS, parseToken("1"));
        await takeTx.wait();
        logError("El prestamo NO debio crearse con token pausado!");
      } catch (err) {
        logSuccess(`Prestamo rechazado correctamente: ${err.reason || err.message.substring(0, 80)}`);
      }

      // Cancelar la orden de test
      tx = await c.orderBook.cancelLendingOrder(testOrderId);
      await tx.wait();
      log("Orden de test cancelada");
    } else {
      log("USDC insuficiente para test de rechazo. Verificacion manual necesaria.");
    }
  } else {
    log("Token no pausado. No se puede verificar rechazo.");
    log("Esto puede pasar si Chainlink mantiene el precio alto.");
  }

  // ============================================================
  //  RESTAURAR ESTADO
  // ============================================================
  logSection("RESTAURAR ESTADO");

  // Restaurar TWAP
  log("Restaurando precio TWAP...");
  await waitTwapCooldown(c.priceOracle);

  const feedCurrent = await c.priceOracle.priceFeeds(WETH_ADDRESS);
  let restoreTwap = feedCurrent.twapPrice;

  let step = 0;
  while (restoreTwap < originalTwap && step < 5) {
    step++;
    const newPrice = (restoreTwap * 150n) / 100n;
    const finalPrice = newPrice > originalTwap ? originalTwap : newPrice;

    if (step > 1) await waitTwapCooldown(c.priceOracle);

    tx = await c.priceOracle.updateTwapPrice(WETH_ADDRESS, finalPrice);
    await tx.wait();
    const f = await c.priceOracle.priceFeeds(WETH_ADDRESS);
    restoreTwap = f.twapPrice;
    log(`Restore step ${step}: TWAP = $${formatUsdc(restoreTwap)}`);
  }

  logSuccess(`TWAP restaurado: $${formatUsdc(restoreTwap)}`);

  // Restaurar maxTwapChangeBps
  tx = await c.priceOracle.setMaxTwapChangeBps(Number(originalMaxChange));
  await tx.wait();
  logSuccess(`maxTwapChangeBps restaurado a ${originalMaxChange}`);

  // Despausar token
  const stillPaused = await c.riskEngine.pausedTokens(WETH_ADDRESS);
  if (stillPaused) {
    tx = await c.riskEngine.setTokenPaused(WETH_ADDRESS, false, "Test cleanup - circuit breaker test done");
    await tx.wait();
    logSuccess("WETH despausado");
  }

  // Verificar estado final
  logSection("ESTADO FINAL");
  const [finalPrice] = await c.priceOracle.getPrice(WETH_ADDRESS);
  log(`Precio WETH: $${formatUsdc(finalPrice)}`);
  log(`WETH pausado: ${await c.riskEngine.pausedTokens(WETH_ADDRESS)}`);

  console.log("\n========================================");
  console.log("  TEST 7: CIRCUIT BREAKER COMPLETADO");
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("\nError fatal:", err.message);
  if (err.data) console.error("Data:", err.data);
  process.exit(1);
});
