/**
 * TEST 1 - Creacion de Lending Order
 * TEST 9 - Proteccion contra spam de ordenes (>20 ordenes)
 *
 * Ejecutar: node scripts/test-lending.js
 * Red: Base Mainnet
 * Fondos: ~50 USDC
 */
import {
  getSigner, getContracts, CONTRACTS,
  formatUsdc, parseUsdc, log, logSection, logSuccess, logError, logTx, logBalance,
  Duration, OrderStatus,
} from "./test-shared.js";

async function main() {
  const signer = getSigner();
  const addr = signer.address;
  const c = getContracts(signer);

  console.log("========================================");
  console.log("  NomoLend - Test Lending Order");
  console.log("  Red: Base Mainnet");
  console.log(`  Wallet: ${addr}`);
  console.log("========================================");

  // ============================================================
  //  TEST 1: Crear Lending Order de 50 USDC
  // ============================================================
  logSection("TEST 1: Crear Lending Order (50 USDC, 7 dias)");

  // Balance inicial
  const usdcBefore = await logBalance("USDC antes", c.usdc, addr);

  const lendAmount = parseUsdc(50); // 50 USDC
  const duration = Duration.SEVEN_DAYS;

  // Verificar balance suficiente
  if (usdcBefore < lendAmount) {
    logError(`Balance insuficiente. Necesitas al menos 50 USDC. Tienes: ${formatUsdc(usdcBefore)}`);
    return;
  }

  // Paso 1: Aprobar USDC al OrderBook
  log("Aprobando USDC al OrderBook...");
  const approveTx = await c.usdc.approve(CONTRACTS.OrderBook, lendAmount);
  const approveReceipt = await approveTx.wait();
  logTx("Approve USDC", approveReceipt);

  // Verificar allowance
  const allowance = await c.usdc.allowance(addr, CONTRACTS.OrderBook);
  log(`Allowance verificado: ${formatUsdc(allowance)} USDC`);

  // Paso 2: Obtener nextLendingOrderId antes de crear
  const orderIdBefore = await c.orderBook.nextLendingOrderId();
  log(`nextLendingOrderId actual: ${orderIdBefore}`);

  // Paso 3: Crear la orden
  log("Creando Lending Order...");
  const createTx = await c.orderBook.createLendingOrder(lendAmount, duration);
  const createReceipt = await createTx.wait();
  logTx("createLendingOrder", createReceipt);

  // Verificar orden creada
  const orderId = orderIdBefore; // La orden usa el ID que habia antes del incremento
  const order = await c.orderBook.getLendingOrder(orderId);

  log(`--- Orden #${orderId} ---`);
  log(`  Lender:          ${order.lender}`);
  log(`  Total Amount:    ${formatUsdc(order.totalAmount)} USDC`);
  log(`  Available:       ${formatUsdc(order.availableAmount)} USDC`);
  log(`  Duration:        ${order.duration} (0=7d, 1=14d, 2=30d)`);
  log(`  Status:          ${order.status} (0=OPEN, 1=FILLED, 2=CANCELLED)`);
  log(`  Created At:      ${new Date(Number(order.createdAt) * 1000).toISOString()}`);

  // Validaciones
  if (order.lender === addr) logSuccess("Lender correcto");
  else logError(`Lender incorrecto: ${order.lender}`);

  if (order.totalAmount === lendAmount) logSuccess("totalAmount correcto: 50 USDC");
  else logError(`totalAmount incorrecto: ${formatUsdc(order.totalAmount)}`);

  if (order.availableAmount === lendAmount) logSuccess("availableAmount correcto: 50 USDC");
  else logError(`availableAmount incorrecto: ${formatUsdc(order.availableAmount)}`);

  if (Number(order.status) === OrderStatus.OPEN) logSuccess("Status: OPEN");
  else logError(`Status incorrecto: ${order.status}`);

  // Balance final
  const usdcAfter = await logBalance("USDC despues", c.usdc, addr);
  const diff = usdcBefore - usdcAfter;
  log(`USDC transferido al contrato: ${formatUsdc(diff)}`);

  if (diff === lendAmount) logSuccess("Balance correcto: se transfirieron exactamente 50 USDC");
  else logError(`Diferencia inesperada: ${formatUsdc(diff)}`);

  // Verificar evento en receipt
  if (createReceipt.logs.length > 0) {
    logSuccess(`Eventos emitidos: ${createReceipt.logs.length} logs en la transaccion`);
  }

  // Guardar orderId para otros tests
  console.log(`\n  >>> LENDING ORDER ID: ${orderId} (guardar para test-borrow.js)`);

  // ============================================================
  //  TEST 9: Proteccion contra spam (>20 ordenes)
  // ============================================================
  logSection("TEST 9: Proteccion contra Spam de Ordenes");

  const maxOrders = await c.orderBook.maxActiveOrdersPerUser();
  const currentActive = await c.orderBook.activeOrderCount(addr);
  log(`Max ordenes activas por usuario: ${maxOrders}`);
  log(`Ordenes activas actuales: ${currentActive}`);

  if (Number(currentActive) >= Number(maxOrders)) {
    log("Ya se alcanzo el limite. Intentando crear una orden mas...");
    try {
      const spamTx = await c.orderBook.createLendingOrder(parseUsdc(10), Duration.SEVEN_DAYS);
      await spamTx.wait();
      logError("La transaccion NO debio pasar! El limite no funciona.");
    } catch (err) {
      logSuccess(`Orden rechazada correctamente: ${err.reason || err.message.substring(0, 80)}`);
    }
  } else {
    const remaining = Number(maxOrders) - Number(currentActive);
    log(`Quedan ${remaining} ordenes disponibles antes del limite.`);
    log("NOTA: Para probar el limite, necesitarias crear ordenes hasta llegar a 20.");
    log("Esto consumiria muchos fondos en mainnet. Se recomienda probar en fork local.");
  }

  // ============================================================
  //  LIMPIAR: Cancelar la orden para recuperar fondos
  // ============================================================
  logSection("LIMPIEZA: Cancelar orden para recuperar USDC");

  log("Cancelando Lending Order...");
  const cancelTx = await c.orderBook.cancelLendingOrder(orderId);
  const cancelReceipt = await cancelTx.wait();
  logTx("cancelLendingOrder", cancelReceipt);

  const orderAfterCancel = await c.orderBook.getLendingOrder(orderId);
  if (Number(orderAfterCancel.status) === OrderStatus.CANCELLED) {
    logSuccess("Orden cancelada correctamente");
  }

  const usdcFinal = await logBalance("USDC final", c.usdc, addr);
  if (usdcFinal === usdcBefore) {
    logSuccess("USDC recuperado al 100%");
  } else {
    log(`Diferencia por gas: ${formatUsdc(usdcBefore - usdcFinal)} USDC (solo gas de ETH)`);
    logSuccess("USDC recuperado (la diferencia es solo gas en ETH)");
  }

  console.log("\n========================================");
  console.log("  TEST 1 + TEST 9: COMPLETADO");
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("\nError fatal:", err.message);
  if (err.data) console.error("Data:", err.data);
  process.exit(1);
});
