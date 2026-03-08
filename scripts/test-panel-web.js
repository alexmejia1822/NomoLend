/**
 * NomoLend Test Panel - Web Interface
 *
 * Ejecutar: node scripts/test-panel-web.js
 * Abrir: http://localhost:4000
 */
import express from "express";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ethers } from "ethers";
import { CONTRACTS, getSigner, getProvider } from "./shared.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const app = express();
app.use(express.json());
const PORT = 4000;

// Token activo para tests
let activeToken = { key: "CYPR", address: "0xD262A4c7108C8139b2B189758e8D17c3DFC91a38", symbol: "CYPR", decimals: 18 };

// Tokens predefinidos + custom
const TOKENS = {
  CYPR: { address: "0xD262A4c7108C8139b2B189758e8D17c3DFC91a38", symbol: "CYPR", decimals: 18 },
  WETH: { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
};

// Estado de los tests
const testState = {};
const testLog = {};

const TESTS = [
  { id: "diag",  name: "Diagnostico",              desc: "Verifica configuracion del protocolo y balances" },
  { id: "test1", name: "Test 1: Lending Order",     desc: "Crear, verificar y cancelar una orden de prestamo" },
  { id: "test2", name: "Test 2: Borrow",            desc: "Tomar prestamo con colateral" },
  { id: "test3", name: "Test 3: Repago (2%)",       desc: "Repago temprano - Bracket 1 (2% interes)" },
  { id: "test4", name: "Test 4: Bracket 2 (4%)",    desc: "Requiere esperar >7 dias en mainnet" },
  { id: "test5", name: "Test 5: Liquidacion",       desc: "Liquidacion por caida de precio TWAP (~20 min)" },
  { id: "test7", name: "Test 7: Circuit Breaker",   desc: "Pausar token por caida >30% (~15 min)" },
  { id: "test8", name: "Test 8: Reserve Fund",      desc: "Verificar coverBadDebt del fondo de reserva" },
  { id: "test9", name: "Test 9: Spam Protection",   desc: "Verificar limite de ordenes por usuario" },
  { id: "test10",name: "Test 10: Loan Limit",       desc: "Verificar limite de prestamos por token" },
  { id: "test11",name: "Test 11: Underwater Liq.",  desc: "Liquidacion con deuda > valor colateral" },
  { id: "test12",name: "Test 12: Slippage Revert",  desc: "Verificar revert por slippage alto en DEX" },
  { id: "test13",name: "Test 13: Router Fallback",  desc: "Fallback de router cuando primario falla" },
  { id: "test14",name: "Test 14: TWAP Protection",  desc: "Proteccion contra manipulacion TWAP" },
  { id: "test15",name: "Test 15: Bracket 3 (8%)",   desc: "Verificar interes bracket 3 (>14 dias)" },
  { id: "test16",name: "Test 16: Expiry Liq.",      desc: "Liquidacion por expiracion de prestamo" },
  { id: "test17",name: "Test 17: Cascading Liq.",   desc: "Liquidaciones en cascada (multiples prestamos)" },
  { id: "test18",name: "Test 18: Exposure Limit",   desc: "Verificar limite de exposicion por token" },
  { id: "test19",name: "Test 19: Random Ops",       desc: "Operaciones aleatorias de stress test" },
  { id: "test20",name: "Test 20: Death Spiral",     desc: "Crash de precio 95% y recuperacion" },
  { id: "test21",name: "Test 21: Governance Abuse", desc: "Verificar que wallets sin roles no pueden escalar permisos" },
  { id: "test22",name: "Test 22: Oracle Liveness",  desc: "Verificar deteccion de oracle stale y cooldown enforcement" },
  { id: "test23",name: "Test 23: Flash Liquidation", desc: "Crash de precio y liquidacion inmediata" },
  { id: "test24",name: "Test 24: Zero Liq. DEX",    desc: "Liquidacion falla gracefully sin liquidez DEX" },
  { id: "clean", name: "Limpieza",                  desc: "Repagar prestamos, restaurar TWAP, despausar tokens, cancelar ordenes" },
];

function runTest(testId) {
  if (testState[testId] === "running") return;
  testState[testId] = "running";
  testLog[testId] = "";

  // Pasar token activo via env
  const env = { ...process.env };
  if (activeToken.key.startsWith("0x")) {
    env.TOKEN = activeToken.address;
    env.TOKEN_SYMBOL = activeToken.symbol;
    env.TOKEN_DECIMALS = String(activeToken.decimals);
  } else {
    env.TOKEN = activeToken.key;
  }

  const proc = spawn("node", ["scripts/test-panel.js", testId], {
    cwd: ROOT,
    env,
  });

  proc.stdout.on("data", (d) => { testLog[testId] += d.toString(); });
  proc.stderr.on("data", (d) => { testLog[testId] += d.toString(); });
  proc.on("close", (code) => {
    testState[testId] = code === 0 ? "success" : "error";
  });
}

// API: tests
app.get("/api/tests", (_, res) => {
  res.json(TESTS.map(t => ({
    ...t,
    status: testState[t.id] || "idle",
    log: testLog[t.id] || "",
  })));
});

app.post("/api/run/:id", (req, res) => {
  const id = req.params.id;
  if (!TESTS.find(t => t.id === id)) return res.status(404).json({ error: "Test not found" });
  runTest(id);
  res.json({ ok: true });
});

app.post("/api/run-all", (_, res) => {
  const sequential = ["diag", "test1", "test2", "test3", "test8", "test9", "test10"];
  let chain = Promise.resolve();
  for (const id of sequential) {
    chain = chain.then(() => new Promise((resolve) => {
      runTest(id);
      const check = setInterval(() => {
        if (testState[id] !== "running") { clearInterval(check); resolve(); }
      }, 1000);
    }));
  }
  res.json({ ok: true });
});

// API: tokens
app.get("/api/tokens", (_, res) => {
  res.json({
    active: activeToken,
    available: Object.entries(TOKENS).map(([key, t]) => ({ key, ...t })),
  });
});

app.post("/api/tokens/select", (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: "key required" });
  const t = TOKENS[key.toUpperCase()];
  if (!t) return res.status(404).json({ error: "Token not found" });
  activeToken = { key: key.toUpperCase(), ...t };
  // Reset test states
  Object.keys(testState).forEach(k => { testState[k] = undefined; testLog[k] = ""; });
  res.json({ ok: true, active: activeToken });
});

app.post("/api/tokens/add", async (req, res) => {
  const { address } = req.body;
  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return res.status(400).json({ error: "Direccion invalida" });
  }

  try {
    const provider = getProvider();
    const erc20 = new ethers.Contract(address, [
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
    ], provider);

    const [symbol, decimals] = await Promise.all([
      erc20.symbol(),
      erc20.decimals(),
    ]);

    // Check if whitelisted in protocol
    const tv = new ethers.Contract(CONTRACTS.TokenValidator, [
      "function whitelistedTokens(address) view returns (bool)",
    ], provider);
    const whitelisted = await tv.whitelistedTokens(address);

    // Check risk params
    const re = new ethers.Contract(CONTRACTS.RiskEngine, [
      "function tokenRiskParams(address) view returns (uint256,uint256,uint256,bool)",
    ], provider);
    const params = await re.tokenRiskParams(address);

    // Check price
    const po = new ethers.Contract(CONTRACTS.PriceOracle, [
      "function getPrice(address) view returns (uint256,bool)",
    ], provider);
    let price = 0n, hasPrice = false;
    try { [price, hasPrice] = await po.getPrice(address); } catch {}

    const key = symbol.toUpperCase();
    const tokenData = { address, symbol, decimals: Number(decimals) };
    TOKENS[key] = tokenData;

    res.json({
      ok: true,
      token: { key, ...tokenData },
      protocol: {
        whitelisted,
        riskActive: params[3],
        ltvBps: Number(params[0]),
        liqThresholdBps: Number(params[1]),
        hasPrice,
        price: price > 0n ? ethers.formatUnits(price, 6) : "0",
      },
    });
  } catch (err) {
    res.status(400).json({ error: `No se pudo leer el token: ${err.message.substring(0, 100)}` });
  }
});

// HTML Panel
app.get("/", (_, res) => {
  res.send(HTML);
});

const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NomoLend Test Panel</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #0a0e17; color: #e2e8f0; min-height: 100vh; }

  .header { background: linear-gradient(135deg, #1a1f3a 0%, #0d1025 100%); border-bottom: 1px solid #2d3748; padding: 16px 32px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .header h1 { font-size: 22px; font-weight: 700; color: #fff; }
  .header h1 span { color: #60a5fa; }
  .header .network { background: #1e40af; color: #93c5fd; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }

  .token-bar { display: flex; align-items: center; gap: 8px; margin-left: auto; }
  .token-select { background: #1e293b; color: #e2e8f0; border: 1px solid #374151; padding: 6px 12px; border-radius: 8px; font-size: 13px; cursor: pointer; }
  .token-select:focus { outline: none; border-color: #3b82f6; }
  .token-active { background: #065f46; color: #6ee7b7; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .btn-add-token { background: #374151; color: #9ca3af; border: 1px solid #4b5563; padding: 6px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
  .btn-add-token:hover { background: #4b5563; color: #fff; }

  .actions { padding: 12px 32px; display: flex; gap: 12px; border-bottom: 1px solid #1e293b; align-items: center; }
  .btn-all { background: #2563eb; color: white; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .btn-all:hover { background: #1d4ed8; }
  .btn-clean { background: #dc2626; color: white; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .btn-clean:hover { background: #b91c1c; }
  .status-bar { margin-left: auto; display: flex; align-items: center; gap: 16px; font-size: 13px; color: #94a3b8; }
  .status-bar .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
  .dot-ok { background: #22c55e; }
  .dot-err { background: #ef4444; }
  .dot-run { background: #f59e0b; animation: pulse 1s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

  .grid { display: grid; grid-template-columns: 340px 1fr; height: calc(100vh - 125px); }

  .sidebar { border-right: 1px solid #1e293b; overflow-y: auto; padding: 12px; }
  .test-card { background: #111827; border: 1px solid #1e293b; border-radius: 10px; padding: 12px; margin-bottom: 6px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 10px; }
  .test-card:hover { border-color: #3b82f6; background: #1a2234; }
  .test-card.active { border-color: #3b82f6; background: #1e293b; }
  .test-card.running { border-color: #f59e0b; }
  .test-card.success { border-color: #22c55e; }
  .test-card.error { border-color: #ef4444; }

  .card-icon { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
  .card-icon.idle { background: #1e293b; color: #64748b; }
  .card-icon.running { background: #78350f; color: #fbbf24; }
  .card-icon.success { background: #064e3b; color: #34d399; }
  .card-icon.error { background: #7f1d1d; color: #f87171; }

  .card-info { flex: 1; min-width: 0; }
  .card-info h3 { font-size: 12px; font-weight: 600; color: #f1f5f9; margin-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-info p { font-size: 10px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .card-btn { background: #1e40af; color: #93c5fd; border: none; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; flex-shrink: 0; transition: all 0.15s; }
  .card-btn:hover { background: #2563eb; color: #fff; }
  .card-btn:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }

  .main { display: flex; flex-direction: column; }
  .main-header { padding: 14px 24px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; gap: 12px; }
  .main-header h2 { font-size: 15px; font-weight: 600; }
  .main-header .badge { padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .badge-idle { background: #1e293b; color: #64748b; }
  .badge-running { background: #78350f; color: #fbbf24; }
  .badge-success { background: #064e3b; color: #34d399; }
  .badge-error { background: #7f1d1d; color: #f87171; }

  .log-container { flex: 1; overflow-y: auto; padding: 16px 24px; }
  .log { font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace; font-size: 12.5px; line-height: 1.7; white-space: pre-wrap; word-break: break-all; color: #cbd5e1; }
  .log .ok { color: #34d399; }
  .log .err { color: #f87171; }
  .log .tx { color: #60a5fa; }
  .log .section { color: #fbbf24; font-weight: 700; }
  .log .bal { color: #a78bfa; }

  .empty { display: flex; align-items: center; justify-content: center; height: 100%; color: #475569; font-size: 14px; flex-direction: column; gap: 8px; }

  /* Modal */
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100; align-items: center; justify-content: center; }
  .modal-overlay.show { display: flex; }
  .modal { background: #111827; border: 1px solid #374151; border-radius: 16px; padding: 28px; width: 480px; max-width: 90vw; }
  .modal h3 { font-size: 18px; margin-bottom: 16px; color: #f1f5f9; }
  .modal label { font-size: 13px; color: #94a3b8; display: block; margin-bottom: 6px; margin-top: 14px; }
  .modal input { width: 100%; background: #1e293b; border: 1px solid #374151; color: #e2e8f0; padding: 10px 14px; border-radius: 8px; font-size: 14px; font-family: monospace; }
  .modal input:focus { outline: none; border-color: #3b82f6; }
  .modal .btn-row { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
  .modal .btn-primary { background: #2563eb; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
  .modal .btn-primary:hover { background: #1d4ed8; }
  .modal .btn-primary:disabled { background: #374151; cursor: not-allowed; }
  .modal .btn-cancel { background: #374151; color: #9ca3af; border: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; cursor: pointer; }
  .modal .btn-cancel:hover { background: #4b5563; }
  .modal .token-info { background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 14px; margin-top: 14px; font-size: 13px; line-height: 1.8; }
  .modal .token-info .label { color: #64748b; }
  .modal .token-info .val { color: #e2e8f0; font-weight: 600; }
  .modal .token-info .val.ok { color: #34d399; }
  .modal .token-info .val.warn { color: #f59e0b; }
  .modal .token-info .val.err { color: #f87171; }
  .modal .error-msg { color: #f87171; font-size: 13px; margin-top: 10px; }
</style>
</head>
<body>

<div class="header">
  <h1>Nomo<span>Lend</span> Test Panel</h1>
  <span class="network">Base Mainnet</span>
  <div class="token-bar">
    <select class="token-select" id="tokenSelect" onchange="selectToken(this.value)"></select>
    <button class="btn-add-token" onclick="openAddToken()">+ Agregar Token</button>
  </div>
</div>

<div class="actions">
  <button class="btn-all" onclick="runAll()">Ejecutar Todos (rapidos)</button>
  <button class="btn-clean" onclick="runOne('clean')">Limpieza</button>
  <div class="status-bar" id="statusBar"></div>
</div>

<div class="grid">
  <div class="sidebar" id="sidebar"></div>
  <div class="main">
    <div class="main-header" id="mainHeader">
      <h2>Selecciona un test</h2>
    </div>
    <div class="log-container" id="logContainer">
      <div class="empty">
        <div>Selecciona un token y haz clic en un test para comenzar</div>
        <div style="font-size:12px;color:#374151">Puedes agregar cualquier token ERC20 con el boton "+ Agregar Token"</div>
      </div>
    </div>
  </div>
</div>

<!-- Modal: Agregar Token -->
<div class="modal-overlay" id="addTokenModal">
  <div class="modal">
    <h3>Agregar Token de Colateral</h3>
    <label>Direccion del contrato (Base)</label>
    <input type="text" id="tokenAddressInput" placeholder="0x..." oninput="clearTokenInfo()">
    <div id="tokenInfoBox"></div>
    <div id="tokenError" class="error-msg"></div>
    <div class="btn-row">
      <button class="btn-cancel" onclick="closeAddToken()">Cancelar</button>
      <button class="btn-primary" id="btnLookup" onclick="lookupToken()">Buscar</button>
      <button class="btn-primary" id="btnAddConfirm" onclick="confirmAddToken()" style="display:none">Agregar y Seleccionar</button>
    </div>
  </div>
</div>

<script>
let tests = [];
let selected = null;
let polling = null;
let tokenData = null; // from lookup
let currentActiveToken = null;
let availableTokens = [];

// ---- TOKENS ----
async function fetchTokens() {
  const r = await fetch("/api/tokens");
  const data = await r.json();
  currentActiveToken = data.active;
  availableTokens = data.available;
  renderTokenSelect();
}

function renderTokenSelect() {
  const sel = document.getElementById("tokenSelect");
  sel.innerHTML = availableTokens.map(t =>
    '<option value="' + t.key + '" ' + (t.key === currentActiveToken.key ? 'selected' : '') + '>' + t.symbol + ' (' + t.address.slice(0,6) + '...' + t.address.slice(-4) + ')</option>'
  ).join("");
}

async function selectToken(key) {
  const r = await fetch("/api/tokens/select", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ key }) });
  const data = await r.json();
  if (data.ok) {
    currentActiveToken = data.active;
    await fetchTests();
    await fetchTokens();
  }
}

function openAddToken() {
  document.getElementById("addTokenModal").classList.add("show");
  document.getElementById("tokenAddressInput").value = "";
  document.getElementById("tokenInfoBox").innerHTML = "";
  document.getElementById("tokenError").textContent = "";
  document.getElementById("btnLookup").style.display = "";
  document.getElementById("btnAddConfirm").style.display = "none";
  tokenData = null;
}

function closeAddToken() {
  document.getElementById("addTokenModal").classList.remove("show");
}

function clearTokenInfo() {
  document.getElementById("tokenInfoBox").innerHTML = "";
  document.getElementById("tokenError").textContent = "";
  document.getElementById("btnLookup").style.display = "";
  document.getElementById("btnAddConfirm").style.display = "none";
  tokenData = null;
}

async function lookupToken() {
  const addr = document.getElementById("tokenAddressInput").value.trim();
  if (!addr.startsWith("0x") || addr.length !== 42) {
    document.getElementById("tokenError").textContent = "Direccion invalida. Debe ser 0x... (42 caracteres)";
    return;
  }
  document.getElementById("btnLookup").disabled = true;
  document.getElementById("btnLookup").textContent = "Buscando...";
  document.getElementById("tokenError").textContent = "";

  try {
    const r = await fetch("/api/tokens/add", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ address: addr }) });
    const data = await r.json();
    if (data.error) {
      document.getElementById("tokenError").textContent = data.error;
      return;
    }
    tokenData = data;
    const p = data.protocol;
    const box = document.getElementById("tokenInfoBox");
    box.innerHTML = '<div class="token-info">' +
      '<div><span class="label">Symbol:</span> <span class="val">' + data.token.symbol + '</span></div>' +
      '<div><span class="label">Decimals:</span> <span class="val">' + data.token.decimals + '</span></div>' +
      '<div><span class="label">Direccion:</span> <span class="val" style="font-size:11px">' + data.token.address + '</span></div>' +
      '<hr style="border-color:#1e293b;margin:8px 0">' +
      '<div><span class="label">Whitelisted:</span> <span class="val ' + (p.whitelisted ? 'ok' : 'err') + '">' + (p.whitelisted ? 'Si' : 'No') + '</span></div>' +
      '<div><span class="label">Risk Params:</span> <span class="val ' + (p.riskActive ? 'ok' : 'warn') + '">' + (p.riskActive ? 'LTV ' + (p.ltvBps/100) + '% | Liq ' + (p.liqThresholdBps/100) + '%' : 'No configurados') + '</span></div>' +
      '<div><span class="label">Precio Oracle:</span> <span class="val ' + (p.hasPrice ? 'ok' : 'warn') + '">' + (p.hasPrice ? '$' + p.price : 'Sin precio') + '</span></div>' +
      (!p.whitelisted || !p.riskActive || !p.hasPrice ? '<div style="margin-top:8px;color:#f59e0b;font-size:11px">Este token necesita configuracion adicional en el protocolo antes de poder usarse como colateral.</div>' : '<div style="margin-top:8px;color:#34d399;font-size:11px">Token listo para testing.</div>') +
      '</div>';
    document.getElementById("btnLookup").style.display = "none";
    document.getElementById("btnAddConfirm").style.display = "";
  } catch (err) {
    document.getElementById("tokenError").textContent = "Error: " + err.message;
  } finally {
    document.getElementById("btnLookup").disabled = false;
    document.getElementById("btnLookup").textContent = "Buscar";
  }
}

async function confirmAddToken() {
  if (!tokenData) return;
  const key = tokenData.token.key;
  await selectToken(key);
  closeAddToken();
}

// ---- TESTS ----
async function fetchTests() {
  const r = await fetch("/api/tests");
  tests = await r.json();
  render();
}

function render() {
  const sb = document.getElementById("sidebar");
  sb.innerHTML = tests.map(t => {
    const icon = t.status === "success" ? "OK" : t.status === "error" ? "!!" : t.status === "running" ? "..." : t.id.replace("test","#").replace("diag","Dx").replace("clean","CL");
    return '<div class="test-card ' + t.status + ' ' + (selected===t.id?'active':'') + '" onclick="selectTest(\\'' + t.id + '\\')">' +
      '<div class="card-icon ' + t.status + '">' + icon + '</div>' +
      '<div class="card-info"><h3>' + t.name + '</h3><p>' + t.desc + '</p></div>' +
      '<button class="card-btn" onclick="event.stopPropagation();runOne(\\'' + t.id + '\\')" ' + (t.status==='running'?'disabled':'') + '>' + (t.status==='running'?'...':'Ejecutar') + '</button>' +
    '</div>';
  }).join("");

  const ok = tests.filter(t => t.status === "success").length;
  const err = tests.filter(t => t.status === "error").length;
  const run = tests.filter(t => t.status === "running").length;
  document.getElementById("statusBar").innerHTML =
    '<span><span class="dot dot-ok"></span> ' + ok + ' OK</span>' +
    '<span><span class="dot dot-err"></span> ' + err + ' Error</span>' +
    '<span><span class="dot dot-run"></span> ' + run + ' Corriendo</span>';

  if (selected) {
    const t = tests.find(x => x.id === selected);
    if (t) {
      const statusText = { idle: "Pendiente", running: "Corriendo...", success: "Completado", error: "Error" }[t.status] || "Pendiente";
      document.getElementById("mainHeader").innerHTML = '<h2>' + t.name + '</h2><span class="badge badge-' + t.status + '">' + statusText + '</span>';
      const container = document.getElementById("logContainer");
      const logText = t.log || "Sin logs aun. Haz clic en Ejecutar.";
      container.innerHTML = '<pre class="log">' + colorize(logText) + '</pre>';
      container.scrollTop = container.scrollHeight;
    }
  }
}

function colorize(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/(\\[OK\\].*)/g, '<span class="ok">$1</span>')
    .replace(/(\\[ERROR\\].*)/g, '<span class="err">$1</span>')
    .replace(/(\\[TX\\].*)/g, '<span class="tx">$1</span>')
    .replace(/(\\[BAL\\].*)/g, '<span class="bal">$1</span>')
    .replace(/(={40,})/g, '<span class="section">$1</span>')
    .replace(/(Error fatal:.*)/g, '<span class="err">$1</span>');
}

function selectTest(id) { selected = id; render(); }

async function runOne(id) {
  await fetch("/api/run/" + id, { method: "POST" });
  startPolling();
}

async function runAll() {
  await fetch("/api/run-all", { method: "POST" });
  startPolling();
}

function startPolling() {
  if (polling) return;
  polling = setInterval(async () => {
    await fetchTests();
    const running = tests.some(t => t.status === "running");
    if (!running) { clearInterval(polling); polling = null; }
  }, 2000);
}

// Init
fetchTokens();
fetchTests();
setInterval(fetchTests, 5000);
</script>
</body>
</html>`;

app.listen(PORT, () => {
  console.log(`\n  NomoLend Test Panel Web`);
  console.log(`  http://localhost:${PORT}\n`);
});
