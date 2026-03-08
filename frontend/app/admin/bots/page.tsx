"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";

type TokenInfo = {
  symbol: string;
  address: string;
  price: string;
  lastUpdate: number;
  staleMinutes: number;
  isStale: boolean;
  paused: boolean;
  ltvBps: number;
  exposure: string;
  maxExposure: string;
  isActive: boolean;
};

type LoanInfo = {
  id: number;
  borrower: string;
  lender: string;
  principal: string;
  collateralToken: string;
  healthFactor: string;
  liquidatable: boolean;
  duration: number;
  startTimestamp: number;
};

type ProtocolStatus = {
  totalLoans: number;
  reserveFund: string;
  timestamp: string;
};

type BotControl = {
  priceUpdater: boolean;
  healthMonitor: boolean;
  liquidationBot: boolean;
  monitorBot: boolean;
};

type SecurityRole = {
  role: string;
  deployer: boolean;
  deployerError?: string;
  safe: boolean;
  safeError?: string;
};

type SecurityContract = {
  name: string;
  address: string;
  roles: SecurityRole[];
};

type SecurityData = {
  deployerWallet: string;
  safeAddress: string;
  contracts: SecurityContract[];
  timestamp: string;
};

// Wallets autorizadas para ver el panel
const SAFE_ADDRESS = "0x362D5267A61f65cb4901B163B5D94adbf147DB87";
const DEPLOYER_WALLET = "0x9ce3F036365DfAf608D5F98B34A5872bbe5Ee125";

export default function BotsPage() {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<ProtocolStatus | null>(null);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loans, setLoans] = useState<LoanInfo[]>([]);
  const [totalLoans, setTotalLoans] = useState(0);
  const [botControl, setBotControl] = useState<BotControl>({
    priceUpdater: true, healthMonitor: true, liquidationBot: true, monitorBot: true,
  });
  const [toggling, setToggling] = useState<string | null>(null);
  const [security, setSecurity] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  const isAdmin = isConnected && (
    address?.toLowerCase() === SAFE_ADDRESS.toLowerCase() ||
    address?.toLowerCase() === DEPLOYER_WALLET.toLowerCase()
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch sequentially to avoid rate-limit collisions
      const statusRes = await fetch("/api/bot?action=status");
      if (!statusRes.ok) throw new Error(`Status: ${statusRes.status}`);
      const statusData = await statusRes.json();

      const tokensRes = await fetch("/api/bot?action=tokens");
      if (!tokensRes.ok) throw new Error(`Tokens: ${tokensRes.status}`);
      const tokensData = await tokensRes.json();

      const loansRes = await fetch("/api/bot?action=loans");
      if (!loansRes.ok) throw new Error(`Loans: ${loansRes.status}`);
      const loansData = await loansRes.json();

      const controlRes = await fetch("/api/bot/control");
      if (controlRes.ok) {
        const controlData = await controlRes.json();
        setBotControl(controlData);
      }

      try {
        const securityRes = await fetch("/api/bot/security");
        if (securityRes.ok) {
          const securityData = await securityRes.json();
          setSecurity(securityData);
        }
      } catch {
        // Security fetch is non-critical, don't block the rest
      }

      setStatus(statusData);
      setTokens(tokensData.tokens || []);
      setLoans(loansData.loans || []);
      setTotalLoans(loansData.total || 0);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleBot = useCallback(async (bot: string, enabled: boolean) => {
    if (!address) return;
    setToggling(bot);
    try {
      const res = await fetch("/api/bot/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": address,
        },
        body: JSON.stringify({ bot, enabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setBotControl(prev => ({ ...prev, [bot]: enabled }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error toggling bot");
    } finally {
      setToggling(null);
    }
  }, [address]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
      const interval = setInterval(fetchData, 30_000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, fetchData]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Conecta tu wallet para acceder</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-red-400 text-lg">Acceso denegado — Solo admin</p>
      </div>
    );
  }

  const riskyLoans = loans.filter(l => parseFloat(l.healthFactor) < 1.2 && l.healthFactor !== "N/A");
  const liquidatableLoans = loans.filter(l => l.liquidatable);
  const staleTokens = tokens.filter(t => t.isStale);
  const pausedTokens = tokens.filter(t => t.paused);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Panel de Bots & Monitoreo</h1>
            <p className="text-gray-400 text-sm mt-1">
              Ultimo refresh: {lastRefresh || "—"}
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm disabled:opacity-50"
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatusCard
            title="Loans Totales"
            value={String(totalLoans)}
            subtitle={`${loans.length} activos`}
          />
          <StatusCard
            title="Reserve Fund"
            value={`$${parseFloat(status?.reserveFund || "0").toFixed(2)}`}
            subtitle="USDC"
            alert={parseFloat(status?.reserveFund || "0") < 0.01}
          />
          <StatusCard
            title="Tokens Activos"
            value={String(tokens.filter(t => t.isActive).length)}
            subtitle={staleTokens.length > 0 ? `${staleTokens.length} stale` : "Todos frescos"}
            alert={staleTokens.length > 0}
          />
          <StatusCard
            title="Alertas"
            value={String(liquidatableLoans.length + pausedTokens.length + staleTokens.length)}
            subtitle={liquidatableLoans.length > 0 ? `${liquidatableLoans.length} liquidables` : "Sin alertas"}
            alert={liquidatableLoans.length > 0}
          />
        </div>

        {/* Bot Control */}
        <Section title="Bot Control">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              { key: "priceUpdater", label: "Price Updater" },
              { key: "healthMonitor", label: "Health Monitor" },
              { key: "liquidationBot", label: "Liquidation Bot" },
              { key: "monitorBot", label: "Monitor Bot" },
            ] as const).map(({ key, label }) => (
              <div
                key={key}
                className={`rounded-xl p-4 border flex items-center justify-between ${
                  botControl[key] ? "border-green-800 bg-green-900/10" : "border-red-800 bg-red-900/10"
                }`}
              >
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className={`text-xs font-bold mt-1 ${botControl[key] ? "text-green-400" : "text-red-400"}`}>
                    {botControl[key] ? "ON" : "OFF"}
                  </p>
                </div>
                <button
                  onClick={() => toggleBot(key, !botControl[key])}
                  disabled={toggling === key}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    botControl[key] ? "bg-green-600" : "bg-red-600"
                  } ${toggling === key ? "opacity-50" : ""}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      botControl[key] ? "left-6" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-3">
            Desactivar un bot evita que ejecute acciones. El proceso pm2 sigue corriendo.
          </p>
        </Section>

        {/* Keeper Bot Status */}
        <Section title="Estado de los Bots">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BotCard
              name="Price Updater"
              desc="Actualiza precios TWAP cada 5 min"
              status={staleTokens.length === 0 ? "ok" : "warning"}
              detail={staleTokens.length === 0 ? "Todos los precios frescos" : `${staleTokens.length} tokens stale`}
            />
            <BotCard
              name="Health Monitor"
              desc="Escanea loans cada 1 min"
              status={liquidatableLoans.length === 0 ? "ok" : "critical"}
              detail={`${loans.length} activos, ${riskyLoans.length} riesgosos`}
            />
            <BotCard
              name="Liquidation Bot"
              desc="Ejecuta liquidaciones automaticas"
              status={liquidatableLoans.length === 0 ? "ok" : "critical"}
              detail={liquidatableLoans.length > 0 ? `${liquidatableLoans.length} pendientes` : "Sin pendientes"}
            />
          </div>
          <p className="text-gray-500 text-xs mt-4">
            Ejecutar: <code className="bg-gray-800 px-2 py-0.5 rounded">node keeper/index.js</code>
            {" | "}Modo prueba: <code className="bg-gray-800 px-2 py-0.5 rounded">DRY_RUN=true node keeper/index.js</code>
          </p>
        </Section>

        {/* Token Prices */}
        <Section title="Precios TWAP">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2 px-3">Token</th>
                  <th className="text-right py-2 px-3">Precio</th>
                  <th className="text-right py-2 px-3">Ultimo Update</th>
                  <th className="text-right py-2 px-3">LTV</th>
                  <th className="text-right py-2 px-3">Exposicion</th>
                  <th className="text-center py-2 px-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.address} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                    <td className="py-3 px-3 font-medium">{t.symbol}</td>
                    <td className="py-3 px-3 text-right font-mono">
                      ${parseFloat(t.price).toFixed(4)}
                    </td>
                    <td className={`py-3 px-3 text-right ${t.isStale ? "text-yellow-400" : "text-gray-400"}`}>
                      {t.staleMinutes} min
                    </td>
                    <td className="py-3 px-3 text-right text-gray-400">
                      {(t.ltvBps / 100).toFixed(0)}%
                    </td>
                    <td className="py-3 px-3 text-right text-gray-400">
                      ${parseFloat(t.exposure).toFixed(0)} / ${parseFloat(t.maxExposure).toFixed(0)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {t.paused ? (
                        <span className="bg-red-900/50 text-red-400 text-xs px-2 py-1 rounded">Pausado</span>
                      ) : t.isStale ? (
                        <span className="bg-yellow-900/50 text-yellow-400 text-xs px-2 py-1 rounded">Stale</span>
                      ) : (
                        <span className="bg-green-900/50 text-green-400 text-xs px-2 py-1 rounded">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
                {tokens.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-gray-500">Sin tokens activos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Risky Loans */}
        <Section title={`Loans Riesgosos (${riskyLoans.length + liquidatableLoans.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2 px-3">ID</th>
                  <th className="text-left py-2 px-3">Borrower</th>
                  <th className="text-right py-2 px-3">Principal</th>
                  <th className="text-right py-2 px-3">Health Factor</th>
                  <th className="text-center py-2 px-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {[...liquidatableLoans, ...riskyLoans.filter(l => !l.liquidatable)].map((l) => (
                  <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                    <td className="py-3 px-3 font-mono">#{l.id}</td>
                    <td className="py-3 px-3 font-mono text-gray-400">
                      {l.borrower.slice(0, 8)}...{l.borrower.slice(-4)}
                    </td>
                    <td className="py-3 px-3 text-right">${parseFloat(l.principal).toFixed(2)}</td>
                    <td className={`py-3 px-3 text-right font-mono ${
                      l.liquidatable ? "text-red-400" : parseFloat(l.healthFactor) < 1.2 ? "text-yellow-400" : "text-green-400"
                    }`}>
                      {l.healthFactor}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {l.liquidatable ? (
                        <span className="bg-red-900/50 text-red-400 text-xs px-2 py-1 rounded">Liquidable</span>
                      ) : (
                        <span className="bg-yellow-900/50 text-yellow-400 text-xs px-2 py-1 rounded">Riesgoso</span>
                      )}
                    </td>
                  </tr>
                ))}
                {riskyLoans.length === 0 && liquidatableLoans.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-gray-500">Todos los loans estan sanos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* All Active Loans */}
        <Section title={`Todos los Loans Activos (${loans.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-2 px-3">ID</th>
                  <th className="text-left py-2 px-3">Borrower</th>
                  <th className="text-left py-2 px-3">Lender</th>
                  <th className="text-right py-2 px-3">Principal</th>
                  <th className="text-right py-2 px-3">HF</th>
                  <th className="text-right py-2 px-3">Inicio</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                    <td className="py-2 px-3 font-mono">#{l.id}</td>
                    <td className="py-2 px-3 font-mono text-gray-400 text-xs">
                      {l.borrower.slice(0, 8)}...{l.borrower.slice(-4)}
                    </td>
                    <td className="py-2 px-3 font-mono text-gray-400 text-xs">
                      {l.lender.slice(0, 8)}...{l.lender.slice(-4)}
                    </td>
                    <td className="py-2 px-3 text-right">${parseFloat(l.principal).toFixed(2)}</td>
                    <td className={`py-2 px-3 text-right font-mono ${
                      l.liquidatable ? "text-red-400" : parseFloat(l.healthFactor) < 1.2 ? "text-yellow-400" : "text-green-400"
                    }`}>
                      {l.healthFactor}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500 text-xs">
                      {new Date(l.startTimestamp * 1000).toLocaleDateString("es-CO")}
                    </td>
                  </tr>
                ))}
                {loans.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-gray-500">Sin loans activos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Configuration */}
        <Section title="Configuracion del Keeper">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-900 rounded-lg p-4">
              <h4 className="text-gray-400 mb-2 font-medium">Variables de Entorno (.env)</h4>
              <pre className="text-gray-300 text-xs space-y-1">
{`BOT_PRIVATE_KEY=           # Wallet del bot (o usa DEPLOYER_PRIVATE_KEY)
BASE_RPC_URL=              # RPC de Base
DRY_RUN=true               # Modo simulacion (no envia txs)
TELEGRAM_BOT_TOKEN=        # Bot de Telegram (opcional)
TELEGRAM_CHAT_ID=          # Chat ID para alertas
DISCORD_WEBHOOK_URL=       # Webhook de Discord (opcional)
FIREBASE_SERVICE_ACCOUNT_KEY=  # Path a service account JSON (opcional)`}
              </pre>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <h4 className="text-gray-400 mb-2 font-medium">Intervalos</h4>
              <div className="space-y-2 text-gray-300 text-xs">
                <p>Price Updater: cada 5 minutos</p>
                <p>Health Monitor: cada 1 minuto</p>
                <p>Liquidation Bot: cada 2 minutos</p>
                <p>Monitor Bot: cada 2 minutos</p>
                <p>Oracle stale threshold: 30 minutos</p>
                <p>Liquidation trigger: HF &lt; 1.05</p>
                <p>Slippage tolerance: 5%</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Security & Access Control */}
        <Section title="Security & Access Control">
          {security ? (
            <>
              <div className="mb-4 space-y-1">
                <p className="text-sm text-gray-400">
                  Safe Multisig (Admin):{" "}
                  <span className="font-mono text-green-400">{security.safeAddress}</span>
                </p>
                <p className="text-sm text-gray-400">
                  Deployer:{" "}
                  <span className="font-mono text-gray-500">{security.deployerWallet}</span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800">
                      <th className="text-left py-2 px-3">Contract</th>
                      <th className="text-left py-2 px-3">Role</th>
                      <th className="text-center py-2 px-3">Safe</th>
                      <th className="text-center py-2 px-3">Deployer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {security.contracts.map((contract) =>
                      contract.roles.map((role, idx) => (
                        <tr
                          key={`${contract.name}-${role.role}`}
                          className="border-b border-gray-800/50 hover:bg-gray-900/50"
                        >
                          {idx === 0 ? (
                            <td
                              className="py-3 px-3 font-medium align-top"
                              rowSpan={contract.roles.length}
                            >
                              <span>{contract.name}</span>
                              <span className="block text-xs text-gray-500 font-mono mt-0.5">
                                {contract.address.slice(0, 8)}...{contract.address.slice(-4)}
                              </span>
                            </td>
                          ) : null}
                          <td className="py-3 px-3 text-gray-300 font-mono text-xs">
                            {role.role}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {role.safeError ? (
                              <span className="text-yellow-400 text-xs" title={role.safeError}>N/A</span>
                            ) : role.safe ? (
                              <span className="text-green-400 text-lg">&#10003;</span>
                            ) : (
                              <span className="text-red-400 text-lg">&#10007;</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {role.deployerError ? (
                              <span className="text-yellow-400 text-xs" title={role.deployerError}>N/A</span>
                            ) : role.deployer ? (
                              <span className="text-green-400 text-lg">&#10003;</span>
                            ) : (
                              <span className="text-gray-600 text-lg">&#10007;</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-gray-500 text-xs mt-3">
                Ultimo check: {new Date(security.timestamp).toLocaleTimeString()}
              </p>
            </>
          ) : (
            <p className="text-gray-500 text-sm">
              {loading ? "Cargando roles..." : "No se pudo cargar la informacion de seguridad"}
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}

// ============================================================
//  SUB-COMPONENTS
// ============================================================

function StatusCard({ title, value, subtitle, alert = false }: {
  title: string; value: string; subtitle: string; alert?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 ${alert ? "bg-red-900/20 border border-red-800" : "bg-gray-900"}`}>
      <p className="text-gray-400 text-xs uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${alert ? "text-red-400" : "text-white"}`}>{value}</p>
      <p className="text-gray-500 text-xs mt-1">{subtitle}</p>
    </div>
  );
}

function BotCard({ name, desc, status, detail }: {
  name: string; desc: string; status: "ok" | "warning" | "critical"; detail: string;
}) {
  const colors = {
    ok: "border-green-800 bg-green-900/10",
    warning: "border-yellow-800 bg-yellow-900/10",
    critical: "border-red-800 bg-red-900/10",
  };
  const dots = { ok: "bg-green-400", warning: "bg-yellow-400", critical: "bg-red-400" };

  return (
    <div className={`rounded-xl p-4 border ${colors[status]}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${dots[status]}`} />
        <h3 className="font-medium">{name}</h3>
      </div>
      <p className="text-gray-400 text-xs">{desc}</p>
      <p className="text-gray-300 text-sm mt-2">{detail}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
        {children}
      </div>
    </div>
  );
}
