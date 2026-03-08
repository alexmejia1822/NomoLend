/// @notice Alert system — Telegram, Discord, console
/// Sends notifications for critical protocol events

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 min entre alertas iguales
const recentAlerts = new Map();

function shouldAlert(key) {
  const last = recentAlerts.get(key);
  if (last && Date.now() - last < ALERT_COOLDOWN_MS) return false;
  recentAlerts.set(key, Date.now());
  return true;
}

async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    console.error(`  [Alert] Telegram error: ${err.message}`);
  }
}

async function sendDiscord(message) {
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
  } catch (err) {
    console.error(`  [Alert] Discord error: ${err.message}`);
  }
}

export async function sendAlert(level, title, details = "") {
  const key = `${level}:${title}`;
  if (!shouldAlert(key)) return;

  const emoji = level === "critical" ? "🚨" : level === "warning" ? "⚠️" : "ℹ️";
  const message = `${emoji} <b>NomoLend ${level.toUpperCase()}</b>\n${title}\n${details}`;
  const discordMsg = `${emoji} **NomoLend ${level.toUpperCase()}**\n${title}\n${details}`;

  console.log(`  [ALERT:${level}] ${title} ${details}`);

  await Promise.all([
    sendTelegram(message),
    sendDiscord(discordMsg),
  ]);
}

// Pre-built alert helpers
export async function alertLoanUnderwaterDetected(loanId, hf) {
  await sendAlert("warning", "Loan underwater detectado", `Loan #${loanId} — HF: ${hf}`);
}

export async function alertLiquidationExecuted(loanId, txHash) {
  await sendAlert("info", "Liquidacion ejecutada", `Loan #${loanId}\nTx: ${txHash}`);
}

export async function alertLiquidationFailed(loanId, error) {
  await sendAlert("critical", "Liquidacion FALLIDA", `Loan #${loanId}\nError: ${error}`);
}

export async function alertOracleStale(token, staleSec) {
  await sendAlert("warning", "Oracle stale", `Token: ${token}\nStale: ${Math.floor(staleSec / 60)} min`);
}

export async function alertTokenPaused(token, reason) {
  await sendAlert("critical", "Token PAUSADO", `Token: ${token}\nRazon: ${reason}`);
}

export async function alertDexLiquidityLow(token, liquidity) {
  await sendAlert("warning", "DEX liquidity baja", `Token: ${token}\nLiquidity: $${liquidity}`);
}

export async function alertReserveFundLow(balance) {
  await sendAlert("warning", "Reserve Fund bajo", `Balance: $${balance} USDC`);
}

export async function alertBotError(botType, error) {
  await sendAlert("critical", `Bot error: ${botType}`, error);
}

export async function alertWatchdog(botType, lastRunMinutes) {
  await sendAlert("critical", "Watchdog: bot no responde", `${botType} — ultimo run hace ${lastRunMinutes} min`);
}
