/// @notice Firebase Admin SDK initialization for keeper logging
import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

let db = null;
let initialized = false;

function initFirebase() {
  if (initialized) return db;

  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!keyPath) {
    console.log("  [Firebase] No FIREBASE_SERVICE_ACCOUNT_KEY set — logs to console only");
    initialized = true;
    return null;
  }

  const fullPath = resolve(keyPath);
  if (!existsSync(fullPath)) {
    console.log(`  [Firebase] Service account file not found: ${fullPath} — logs to console only`);
    initialized = true;
    return null;
  }

  try {
    const serviceAccount = JSON.parse(readFileSync(fullPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    db = admin.firestore();
    console.log("  [Firebase] Connected to Firestore");
    initialized = true;
    return db;
  } catch (err) {
    console.error(`  [Firebase] Init error: ${err.message}`);
    initialized = true;
    return null;
  }
}

export function getDb() {
  if (!initialized) initFirebase();
  return db;
}

// ============================================================
//                    LOGGING HELPERS
// ============================================================

export async function logBotAction(botType, action, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    botType,
    action,
    status: data.status || "info",
    txHash: data.txHash || null,
    error: data.error || null,
    details: data.details || null,
  };

  // Always log to console
  const icon = entry.status === "error" ? "✗" : entry.status === "success" ? "✓" : "→";
  console.log(`  [${botType}] ${icon} ${action}${entry.error ? `: ${entry.error}` : ""}`);

  // Log to Firestore if available
  const fireDb = getDb();
  if (fireDb) {
    try {
      await fireDb.collection("bot-logs").add(entry);
    } catch {}
  }
}

export async function logPriceUpdate(token, symbol, price, txHash) {
  const fireDb = getDb();
  if (!fireDb) return;

  try {
    await fireDb.collection("bot-config").doc("tokens").collection(token.toLowerCase()).doc("latest").set({
      symbol,
      lastPrice: price.toString(),
      lastUpdate: new Date().toISOString(),
      txHash,
    }, { merge: true });
  } catch {}
}

export async function logLiquidation(loanId, token, amount, txHash, status) {
  const entry = {
    loanId: Number(loanId),
    token,
    amount: amount.toString(),
    txHash,
    timestamp: new Date().toISOString(),
    status,
  };

  const fireDb = getDb();
  if (fireDb) {
    try {
      await fireDb.collection("liquidations").add(entry);
    } catch {}
  }
}

export async function updateBotStatus(botType, data) {
  const fireDb = getDb();
  if (!fireDb) return;

  try {
    await fireDb.collection("bot-config").doc("status").set({
      [botType]: {
        ...data,
        lastUpdate: new Date().toISOString(),
      },
    }, { merge: true });
  } catch {}
}

// ============================================================
//                    BOT CONTROL (ON/OFF)
// ============================================================

const DEFAULT_CONTROL = {
  priceUpdater: true,
  healthMonitor: true,
  liquidationBot: true,
  monitorBot: true,
};

// Cache to avoid reading Firestore on every cycle
let controlCache = null;
let controlCacheTime = 0;
const CONTROL_CACHE_TTL = 15_000; // 15 seconds

export async function getBotControl() {
  const now = Date.now();
  if (controlCache && now - controlCacheTime < CONTROL_CACHE_TTL) {
    return controlCache;
  }

  const fireDb = getDb();
  if (!fireDb) return { ...DEFAULT_CONTROL };

  try {
    const doc = await fireDb.collection("bot-config").doc("control").get();
    if (!doc.exists) {
      // Create default control doc
      await fireDb.collection("bot-config").doc("control").set({
        ...DEFAULT_CONTROL,
        updatedAt: new Date().toISOString(),
      });
      controlCache = { ...DEFAULT_CONTROL };
    } else {
      const data = doc.data();
      controlCache = {
        priceUpdater: data.priceUpdater !== false,
        healthMonitor: data.healthMonitor !== false,
        liquidationBot: data.liquidationBot !== false,
        monitorBot: data.monitorBot !== false,
      };
    }
    controlCacheTime = now;
    return controlCache;
  } catch (err) {
    console.error(`  [Firebase] getBotControl error: ${err.message}`);
    return controlCache || { ...DEFAULT_CONTROL };
  }
}

export async function setBotControl(botName, enabled) {
  const fireDb = getDb();
  if (!fireDb) throw new Error("Firebase not available");

  await fireDb.collection("bot-config").doc("control").set({
    [botName]: enabled,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  // Invalidate cache
  controlCache = null;
  controlCacheTime = 0;

  // Log the change
  await logBotAction("admin", "bot_toggle", {
    status: "info",
    details: `${botName} ${enabled ? "ON" : "OFF"}`,
  });
}
