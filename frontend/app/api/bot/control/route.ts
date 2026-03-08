import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ADMIN_WALLETS = [
  "0x362D5267A61f65cb4901B163B5D94adbf147DB87".toLowerCase(), // Safe multisig
  "0x9ce3F036365DfAf608D5F98B34A5872bbe5Ee125".toLowerCase(), // Deployer
];

const VALID_BOTS = ["priceUpdater", "healthMonitor", "liquidationBot", "monitorBot"];

const DEFAULT_CONTROL = {
  priceUpdater: true,
  healthMonitor: true,
  liquidationBot: true,
  monitorBot: true,
};

function getFirestore() {
  if (admin.apps.length === 0) {
    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!keyPath) return null;

    const fullPath = resolve(keyPath);
    if (!existsSync(fullPath)) return null;

    const serviceAccount = JSON.parse(readFileSync(fullPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin.firestore();
}

export async function GET() {
  const db = getFirestore();
  if (!db) {
    return NextResponse.json({ ...DEFAULT_CONTROL });
  }

  try {
    const doc = await db.collection("bot-config").doc("control").get();
    if (!doc.exists) {
      return NextResponse.json({ ...DEFAULT_CONTROL });
    }
    const data = doc.data()!;
    return NextResponse.json({
      priceUpdater: data.priceUpdater !== false,
      healthMonitor: data.healthMonitor !== false,
      liquidationBot: data.liquidationBot !== false,
      monitorBot: data.monitorBot !== false,
      updatedAt: data.updatedAt || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const wallet = request.headers.get("x-wallet-address")?.toLowerCase();
  if (!wallet || !ADMIN_WALLETS.includes(wallet)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const db = getFirestore();
  if (!db) {
    return NextResponse.json({ error: "Firebase not available" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { bot, enabled } = body;

    if (!VALID_BOTS.includes(bot)) {
      return NextResponse.json({ error: `Invalid bot: ${bot}` }, { status: 400 });
    }

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
    }

    await db.collection("bot-config").doc("control").set({
      [bot]: enabled,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await db.collection("bot-logs").add({
      timestamp: new Date().toISOString(),
      botType: "admin",
      action: "bot_toggle",
      status: "info",
      txHash: null,
      error: null,
      details: `${bot} ${enabled ? "ON" : "OFF"} by ${wallet}`,
    });

    return NextResponse.json({ success: true, bot, enabled });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
