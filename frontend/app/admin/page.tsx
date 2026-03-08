"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import {
  ERC20ABI,
  TokenValidatorAdminABI,
  PriceOracleAdminABI,
  RiskEngineAdminABI,
  RiskEngineABI,
  PriceOracleABI,
} from "@/lib/abis";
import { formatUsdc } from "@/lib/utils";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TokenIcon } from "@/components/ui/TokenIcon";
import clsx from "clsx";
import {
  Settings,
  Shield,
  DollarSign,
  Coins,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Vault,
  Calculator,
  Layers,
} from "lucide-react";

const ProtocolConfigABI = [
  { inputs: [], name: "treasury", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
] as const;

const LoanManagerNextIdABI = [
  { inputs: [], name: "nextLoanId", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

const TIERS = [
  { label: "Tier A (>$150M mcap)", ltvBps: 4000, liqBps: 6000 },
  { label: "Tier B (>$100M mcap)", ltvBps: 3500, liqBps: 5500 },
  { label: "Tier C (>$50M mcap)", ltvBps: 3000, liqBps: 5000 },
  { label: "Tier D (>$20M mcap)", ltvBps: 2500, liqBps: 5000 },
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

/* ─── Step Indicator ─── */
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isActive = currentStep === stepNum;
        const isCompleted = currentStep > stepNum;
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                isCompleted && "bg-accent-green text-white",
                isActive && "bg-gradient-to-br from-accent-blue to-accent-purple text-white shadow-lg shadow-accent-blue/30",
                !isActive && !isCompleted && "bg-bg-secondary text-text-muted border border-border"
              )}
            >
              {isCompleted ? <CheckCircle className="w-4 h-4" /> : stepNum}
            </div>
            {i < totalSteps - 1 && (
              <div
                className={clsx(
                  "w-8 h-0.5 rounded-full transition-all duration-300",
                  currentStep > stepNum ? "bg-accent-green" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Protocol Stats Section ─── */
function ProtocolStats() {
  const { data: treasuryAddr } = useReadContract({
    address: CONTRACTS.ProtocolConfig,
    abi: ProtocolConfigABI,
    functionName: "treasury",
  });

  const { data: reserveBalance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: [CONTRACTS.ReserveFund],
    query: { refetchInterval: 15000 },
  });

  const { data: orderBookBalance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: [CONTRACTS.OrderBook],
    query: { refetchInterval: 15000 },
  });

  const { data: loanManagerBalance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: [CONTRACTS.LoanManager],
    query: { refetchInterval: 15000 },
  });

  const { data: nextLoanId } = useReadContract({
    address: CONTRACTS.LoanManager,
    abi: LoanManagerNextIdABI,
    functionName: "nextLoanId",
    query: { refetchInterval: 15000 },
  });

  const totalLoans = nextLoanId ? Number(nextLoanId) : 0;
  const reserve = reserveBalance ?? 0n;
  const orderBook = orderBookBalance ?? 0n;
  const loanMgr = loanManagerBalance ?? 0n;

  const estimatedTreasuryFees = reserve * 4n;
  const totalProtocolFees = reserve * 5n;
  const totalTvl = orderBook + loanMgr;

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Fees Totales Generados"
          value={`${formatUsdc(totalProtocolFees)} USDC`}
          subtitle="10% del interes cobrado"
          icon={<DollarSign className="w-5 h-5" />}
          gradient="green"
        />
        <StatCard
          title="Treasury (80%)"
          value={`${formatUsdc(estimatedTreasuryFees)} USDC`}
          subtitle="Retirable por admin"
          icon={<Vault className="w-5 h-5" />}
          gradient="green"
        />
        <StatCard
          title="Fondo de Reserva (20%)"
          value={`${formatUsdc(reserve)} USDC`}
          subtitle="Solo para bad debt"
          icon={<Shield className="w-5 h-5" />}
          gradient="blue"
        />
        <StatCard
          title="TVL del Protocolo"
          value={`${formatUsdc(totalTvl)} USDC`}
          subtitle="Ofertas + Prestamos activos"
          icon={<TrendingUp className="w-5 h-5" />}
          gradient="purple"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard padding="sm" hover={false}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider">Ofertas (OrderBook)</p>
              <p className="text-lg font-bold text-text-primary mt-1">{formatUsdc(orderBook)} USDC</p>
              <p className="text-text-muted text-xs mt-0.5">Disponible para prestar</p>
            </div>
            <Coins className="w-5 h-5 text-text-muted" />
          </div>
        </GlassCard>
        <GlassCard padding="sm" hover={false}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider">Prestamos Activos</p>
              <p className="text-lg font-bold text-text-primary mt-1">{formatUsdc(loanMgr)} USDC</p>
              <p className="text-text-muted text-xs mt-0.5">Capital desplegado</p>
            </div>
            <Layers className="w-5 h-5 text-text-muted" />
          </div>
        </GlassCard>
        <GlassCard padding="sm" hover={false}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider">Prestamos Creados</p>
              <p className="text-lg font-bold text-text-primary mt-1">{totalLoans}</p>
              <p className="text-text-muted text-xs mt-0.5">Total historico</p>
            </div>
            <Calculator className="w-5 h-5 text-text-muted" />
          </div>
        </GlassCard>
      </div>

      {/* Fee Model Info */}
      <GlassCard padding="sm" hover={false} className="!bg-bg-secondary/50">
        <div className="space-y-1 text-xs text-text-muted">
          <p>Modelo de fees: Interes = 90% lender + 10% plataforma. Del 10%: 80% Treasury + 20% Reserva.</p>
          <p>Treasury: <span className="font-mono text-text-secondary">{treasuryAddr || "..."}</span></p>
          <p>Los fees se calculan a partir del Fondo de Reserva (unica fuente verificable on-chain).</p>
        </div>
      </GlassCard>
    </div>
  );
}

/* ─── Main Admin Page ─── */
export default function AdminPage() {
  const { isConnected, address } = useAccount();
  const ADMIN_WALLETS = [
    "0x362D5267A61f65cb4901B163B5D94adbf147DB87", // Safe multisig
    "0x9ce3F036365DfAf608D5F98B34A5872bbe5Ee125", // Deployer
  ];
  const isAdmin = isConnected && ADMIN_WALLETS.some(w => w.toLowerCase() === address?.toLowerCase());

  // Form state
  const [tokenAddress, setTokenAddress] = useState("");
  const [tierIndex, setTierIndex] = useState(2);
  const [maxExposure, setMaxExposure] = useState("50000");
  const [twapPrice, setTwapPrice] = useState("");
  const [step, setStep] = useState(0);

  // Token info (auto-fetch)
  const tokenAddr = tokenAddress.length === 42 ? (tokenAddress as `0x${string}`) : undefined;

  const { data: tokenSymbol } = useReadContract({
    address: tokenAddr,
    abi: ERC20ABI,
    functionName: "symbol",
    query: { enabled: !!tokenAddr },
  });

  const { data: tokenDecimals } = useReadContract({
    address: tokenAddr,
    abi: ERC20ABI,
    functionName: "decimals",
    query: { enabled: !!tokenAddr },
  });

  const { data: isWhitelisted } = useReadContract({
    address: CONTRACTS.TokenValidator,
    abi: TokenValidatorAdminABI,
    functionName: "whitelistedTokens",
    args: tokenAddr ? [tokenAddr] : undefined,
    query: { enabled: !!tokenAddr, refetchInterval: 5000 },
  });

  const { data: currentRiskParams } = useReadContract({
    address: CONTRACTS.RiskEngine,
    abi: RiskEngineABI,
    functionName: "tokenRiskParams",
    args: tokenAddr ? [tokenAddr] : undefined,
    query: { enabled: !!tokenAddr, refetchInterval: 5000 },
  });

  const { data: currentPrice } = useReadContract({
    address: CONTRACTS.PriceOracle,
    abi: PriceOracleABI,
    functionName: "getPrice",
    args: tokenAddr ? [tokenAddr] : undefined,
    query: { enabled: !!tokenAddr, refetchInterval: 5000 },
  });

  const isRiskActive = currentRiskParams ? currentRiskParams[3] : false;
  const onChainPrice = currentPrice ? Number(currentPrice[0]) / 1e6 : 0;
  const priceConfidence = currentPrice ? currentPrice[1] : false;

  // Transactions
  const { writeContract: write1, data: hash1, isPending: pending1 } = useWriteContract();
  const { isSuccess: success1 } = useWaitForTransactionReceipt({ hash: hash1 });

  const { writeContract: write2, data: hash2, isPending: pending2 } = useWriteContract();
  const { isSuccess: success2 } = useWaitForTransactionReceipt({ hash: hash2 });

  const { writeContract: write3, data: hash3, isPending: pending3 } = useWriteContract();
  const { isSuccess: success3 } = useWaitForTransactionReceipt({ hash: hash3 });

  const { writeContract: write4, data: hash4, isPending: pending4 } = useWriteContract();
  const { isSuccess: success4 } = useWaitForTransactionReceipt({ hash: hash4 });

  // Step progression
  useEffect(() => {
    if (success1 && step === 1) setStep(2);
  }, [success1, step]);

  useEffect(() => {
    if (success2 && step === 2) setStep(3);
  }, [success2, step]);

  useEffect(() => {
    if (success3 && step === 3) setStep(4);
  }, [success3, step]);

  useEffect(() => {
    if (success4 && step === 4) setStep(5);
  }, [success4, step]);

  // Actions
  const handleWhitelist = () => {
    if (!tokenAddr) return;
    setStep(1);
    write1({
      address: CONTRACTS.TokenValidator,
      abi: TokenValidatorAdminABI,
      functionName: "whitelistToken",
      args: [tokenAddr],
    });
  };

  const handleSetPriceFeed = () => {
    if (!tokenAddr || tokenDecimals === undefined) return;
    setStep(2);
    write2({
      address: CONTRACTS.PriceOracle,
      abi: PriceOracleAdminABI,
      functionName: "setPriceFeed",
      args: [tokenAddr, ZERO_ADDRESS, Number(tokenDecimals)],
    });
  };

  const handleSetTwap = () => {
    if (!tokenAddr || !twapPrice) return;
    setStep(3);
    const priceInUsdc = parseUnits(twapPrice, 6);
    write3({
      address: CONTRACTS.PriceOracle,
      abi: PriceOracleAdminABI,
      functionName: "updateTwapPrice",
      args: [tokenAddr, priceInUsdc],
    });
  };

  const handleSetRisk = () => {
    if (!tokenAddr) return;
    setStep(4);
    const tier = TIERS[tierIndex];
    const maxExp = parseUnits(maxExposure, 6);
    write4({
      address: CONTRACTS.RiskEngine,
      abi: RiskEngineAdminABI,
      functionName: "setTokenRiskParams",
      args: [tokenAddr, BigInt(tier.ltvBps), BigInt(tier.liqBps), maxExp],
    });
  };

  // Calculations
  const tier = TIERS[tierIndex];
  const ltvPct = tier.ltvBps / 100;
  const liqPct = tier.liqBps / 100;
  const priceNum = parseFloat(twapPrice || "0");
  const maxExpNum = parseFloat(maxExposure || "0");

  const exampleLoan = 1000;
  const requiredCollateralValue = ltvPct > 0 ? exampleLoan / (ltvPct / 100) : 0;
  const requiredCollateralTokens = priceNum > 0 ? requiredCollateralValue / priceNum : 0;
  const liquidationPrice = priceNum > 0 && requiredCollateralTokens > 0
    ? (exampleLoan / requiredCollateralTokens) * (10000 / tier.liqBps)
    : 0;

  if (!isConnected || !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center"
        >
          <Shield className="w-10 h-10 text-white" />
        </motion.div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-text-primary">Acceso Denegado</h1>
          <p className="text-text-secondary">
            {!isConnected ? "Conecta tu wallet de admin para continuar" : "Solo el administrador puede acceder a este panel"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-12">
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-blue/20">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-text-primary">Admin Panel</h1>
              <Badge variant="warning" size="md">Admin</Badge>
            </div>
            <p className="text-text-secondary mt-0.5">
              Panel de administracion del protocolo NomoLend
            </p>
          </div>
        </div>
      </motion.div>

      {/* ─── Protocol Stats ─── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-text-secondary" />
          <h2 className="text-xl font-semibold text-text-primary">Estadisticas del Protocolo</h2>
        </div>
        <ProtocolStats />
      </section>

      {/* ─── Divider ─── */}
      <div className="border-t border-border" />

      {/* ─── Token Onboarding Wizard ─── */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-text-secondary" />
            <h2 className="text-xl font-semibold text-text-primary">Agregar Token</h2>
          </div>
          <StepIndicator currentStep={step} totalSteps={4} />
        </div>

        {/* Token Address Input + Info */}
        <GlassCard padding="md">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-accent-cyan flex items-center justify-center text-white text-sm font-bold shrink-0">
                0
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Direccion del Token</h3>
                <p className="text-text-muted text-sm">Ingresa la direccion del contrato ERC-20</p>
              </div>
            </div>

            <input
              type="text"
              value={tokenAddress}
              onChange={(e) => { setTokenAddress(e.target.value); setStep(0); }}
              placeholder="0x..."
              className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-text-primary font-mono text-sm focus:border-accent-blue focus:outline-none transition-colors"
            />

            {tokenAddr && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-bg-secondary rounded-xl p-4 space-y-2"
              >
                <div className="flex items-center gap-2 mb-3">
                  {tokenSymbol && <TokenIcon symbol={tokenSymbol} size="sm" />}
                  <span className="text-text-primary font-semibold">{tokenSymbol || "Cargando..."}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Decimales:</span>
                    <span className="text-text-primary">{tokenDecimals !== undefined ? String(tokenDecimals) : "..."}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Whitelisted:</span>
                    <Badge variant={isWhitelisted ? "success" : "danger"} size="sm">
                      {isWhitelisted ? "Si" : "No"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Riesgo:</span>
                    <Badge variant={isRiskActive ? "success" : "danger"} size="sm">
                      {isRiskActive ? "Configurado" : "Sin configurar"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Precio:</span>
                    <span className={clsx("text-sm", onChainPrice > 0 ? "text-accent-green" : "text-text-muted")}>
                      {onChainPrice > 0 ? `$${onChainPrice.toFixed(4)}` : "Sin precio"}
                      {onChainPrice > 0 && !priceConfidence && (
                        <span className="text-accent-yellow ml-1">(baja)</span>
                      )}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </GlassCard>

        {/* Step 1: Whitelist Token */}
        <GlassCard padding="md">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all",
                  step >= 1
                    ? "bg-gradient-to-br from-accent-green to-emerald-600 text-white"
                    : "bg-bg-secondary text-text-muted border border-border"
                )}
              >
                {step > 1 ? <CheckCircle className="w-4 h-4" /> : "1"}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Whitelist Token</h3>
                <p className="text-text-muted text-sm">Agrega el token a la lista blanca del TokenValidator</p>
              </div>
              {isWhitelisted && (
                <Badge variant="success" size="sm" className="ml-auto">Completado</Badge>
              )}
            </div>

            <Button
              onClick={handleWhitelist}
              disabled={!tokenAddr || isWhitelisted === true || pending1 || step > 1}
              loading={pending1}
              size="lg"
              className="w-full"
            >
              {isWhitelisted ? "Ya esta en whitelist" : "Whitelist Token"}
            </Button>
          </div>
        </GlassCard>

        {/* Step 2: Set Price Feed (TWAP) */}
        <GlassCard padding="md">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all",
                  step >= 2
                    ? "bg-gradient-to-br from-accent-blue to-blue-600 text-white"
                    : "bg-bg-secondary text-text-muted border border-border"
                )}
              >
                {step > 3 ? <CheckCircle className="w-4 h-4" /> : "2"}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Configurar Precio (TWAP)</h3>
                <p className="text-text-muted text-sm">Registra el feed y establece el precio TWAP en USD</p>
              </div>
            </div>

            <Button
              onClick={handleSetPriceFeed}
              disabled={!tokenAddr || tokenDecimals === undefined || pending2}
              loading={pending2}
              variant="secondary"
              size="lg"
              className="w-full"
            >
              Registrar Price Feed (TWAP only)
            </Button>

            <div>
              <label className="block text-text-secondary text-sm mb-2">Precio en USD (ej: 0.05 para $0.05)</label>
              <input
                type="number"
                value={twapPrice}
                onChange={(e) => setTwapPrice(e.target.value)}
                placeholder="0.05"
                step="0.0001"
                className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-text-primary focus:border-accent-blue focus:outline-none transition-colors"
              />
            </div>

            <Button
              onClick={handleSetTwap}
              disabled={!tokenAddr || !twapPrice || parseFloat(twapPrice) <= 0 || pending3}
              loading={pending3}
              size="lg"
              className="w-full"
            >
              Establecer Precio TWAP
            </Button>
          </div>
        </GlassCard>

        {/* Step 3: Risk Parameters */}
        <GlassCard padding="md">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all",
                  step >= 4
                    ? "bg-gradient-to-br from-accent-purple to-purple-600 text-white"
                    : "bg-bg-secondary text-text-muted border border-border"
                )}
              >
                {step > 4 ? <CheckCircle className="w-4 h-4" /> : "3"}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Configurar Riesgo</h3>
                <p className="text-text-muted text-sm">Selecciona el tier y la exposicion maxima</p>
              </div>
            </div>

            {/* Tier Selector */}
            <div>
              <label className="block text-text-secondary text-sm mb-2">Tier de Riesgo</label>
              <div className="grid grid-cols-2 gap-3">
                {TIERS.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setTierIndex(i)}
                    className={clsx(
                      "relative rounded-xl p-4 text-left transition-all duration-200 border",
                      tierIndex === i
                        ? "bg-accent-blue/10 border-accent-blue text-text-primary shadow-lg shadow-accent-blue/10"
                        : "bg-bg-secondary border-border text-text-secondary hover:border-border-hover"
                    )}
                  >
                    <p className="font-semibold text-sm">{t.label}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="text-text-muted">LTV: <span className="text-text-primary font-medium">{t.ltvBps / 100}%</span></span>
                      <span className="text-text-muted">Liq: <span className="text-text-primary font-medium">{t.liqBps / 100}%</span></span>
                    </div>
                    {tierIndex === i && (
                      <motion.div
                        layoutId="tier-indicator"
                        className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent-blue"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* LTV Preview Bar */}
            <div className="bg-bg-secondary rounded-xl p-4 space-y-3">
              <p className="text-text-secondary text-sm font-medium">Vista previa del Tier seleccionado</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-text-muted">
                  <span>LTV: {ltvPct}%</span>
                  <span>Liquidacion: {liqPct}%</span>
                </div>
                <div className="h-2 bg-bg-card rounded-full overflow-hidden flex">
                  <div
                    className="bg-accent-green rounded-full transition-all duration-500"
                    style={{ width: `${ltvPct}%` }}
                  />
                  <div
                    className="bg-accent-yellow rounded-full transition-all duration-500 ml-0.5"
                    style={{ width: `${liqPct - ltvPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-accent-green inline-block" />
                    Colateral seguro
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-accent-yellow inline-block" />
                    Zona de riesgo
                  </span>
                </div>
              </div>
            </div>

            {/* Max Exposure */}
            <div>
              <label className="block text-text-secondary text-sm mb-2">Max Exposicion (USDC)</label>
              <input
                type="number"
                value={maxExposure}
                onChange={(e) => setMaxExposure(e.target.value)}
                placeholder="50000"
                className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-text-primary focus:border-accent-blue focus:outline-none transition-colors"
              />
            </div>

            <Button
              onClick={handleSetRisk}
              disabled={!tokenAddr || pending4}
              loading={pending4}
              size="lg"
              className="w-full !bg-accent-purple hover:!bg-purple-600 shadow-lg shadow-accent-purple/20"
            >
              Configurar Parametros de Riesgo
            </Button>
          </div>
        </GlassCard>

        {/* Success Message */}
        {step === 5 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <GlassCard padding="lg" hover={false} className="!border-accent-green/30 !bg-accent-green/5 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-accent-green/20 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-accent-green" />
                </div>
                <h2 className="text-xl font-semibold text-accent-green">Token Configurado Exitosamente</h2>
                <p className="text-text-secondary max-w-md">
                  {tokenSymbol} ya esta listo para usarse como colateral en NomoLend.
                  Agregalo a la lista de tokens del frontend para que aparezca en las paginas.
                </p>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </section>

      {/* ─── Divider ─── */}
      <div className="border-t border-border" />

      {/* ─── Risk Tier Reference Table ─── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-text-secondary" />
          <h2 className="text-xl font-semibold text-text-primary">Referencia de Tiers de Riesgo</h2>
        </div>

        <GlassCard padding="sm" hover={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-text-muted font-medium uppercase tracking-wider text-xs">Tier</th>
                  <th className="text-center py-3 px-4 text-text-muted font-medium uppercase tracking-wider text-xs">Market Cap</th>
                  <th className="text-center py-3 px-4 text-text-muted font-medium uppercase tracking-wider text-xs">LTV</th>
                  <th className="text-center py-3 px-4 text-text-muted font-medium uppercase tracking-wider text-xs">Liquidacion</th>
                  <th className="text-center py-3 px-4 text-text-muted font-medium uppercase tracking-wider text-xs">Colateral / $1K</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t, i) => {
                  const ltv = t.ltvBps / 100;
                  const liq = t.liqBps / 100;
                  const collateralNeeded = ltv > 0 ? 1000 / (ltv / 100) : 0;
                  const tierLetters = ["A", "B", "C", "D"];
                  const tierColors = ["text-accent-green", "text-accent-blue", "text-accent-yellow", "text-accent-red"];
                  return (
                    <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-bg-secondary/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className={clsx("font-bold", tierColors[i])}>Tier {tierLetters[i]}</span>
                      </td>
                      <td className="text-center py-3 px-4 text-text-secondary">
                        {t.label.match(/\(([^)]+)\)/)?.[1] || ""}
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge variant={i <= 1 ? "success" : i === 2 ? "warning" : "danger"} size="sm">
                          {ltv}%
                        </Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge variant="muted" size="sm">{liq}%</Badge>
                      </td>
                      <td className="text-center py-3 px-4 text-text-primary font-medium">
                        ${collateralNeeded.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>

      {/* ─── Loan Example Calculator ─── */}
      {priceNum > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-text-secondary" />
            <h2 className="text-xl font-semibold text-text-primary">Calculadora de Ejemplo</h2>
          </div>

          <GlassCard padding="md" hover={false}>
            <div className="space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                {tokenSymbol && <TokenIcon symbol={tokenSymbol} size="lg" />}
                <div>
                  <h3 className="text-text-primary font-semibold text-lg">
                    Prestamo de {exampleLoan.toLocaleString()} USDC con {tokenSymbol || "TOKEN"}
                  </h3>
                  <p className="text-text-muted text-sm">Usando {tier.label}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Collateral Requirements */}
                <div className="space-y-3">
                  <h4 className="text-text-secondary font-medium text-sm uppercase tracking-wider">Requisitos de Colateral</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-text-muted text-sm">Precio del token</span>
                      <span className="text-text-primary font-medium">${priceNum.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-text-muted text-sm">LTV</span>
                      <span className="text-text-primary font-medium">{ltvPct}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-text-muted text-sm">Valor colateral requerido</span>
                      <span className="text-accent-yellow font-medium">
                        ${requiredCollateralValue.toFixed(2)} ({(100 / ltvPct * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-text-muted text-sm">Tokens de colateral</span>
                      <span className="text-accent-yellow font-medium">
                        {requiredCollateralTokens.toFixed(2)} {tokenSymbol || "TOKEN"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-text-muted text-sm">Umbral de liquidacion</span>
                      <span className="text-text-primary font-medium">{liqPct}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-text-muted text-sm flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-accent-red" />
                        Se liquida si baja a
                      </span>
                      <span className="text-accent-red font-medium">
                        ${liquidationPrice.toFixed(4)} ({((1 - liquidationPrice / priceNum) * 100).toFixed(1)}% caida)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Protocol Capacity */}
                <div className="space-y-3">
                  <h4 className="text-text-secondary font-medium text-sm uppercase tracking-wider">Capacidad del Protocolo</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-text-muted text-sm">Max exposicion</span>
                      <span className="text-text-primary font-medium">
                        {parseFloat(maxExposure).toLocaleString()} USDC
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-text-muted text-sm">Max prestamos simultaneos</span>
                      <span className="text-text-primary font-medium">
                        ~{maxExpNum > 0 ? Math.floor(maxExpNum / exampleLoan) : 0} de {exampleLoan.toLocaleString()} USDC
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/30">
                      <span className="text-text-muted text-sm">TVL maximo en colateral</span>
                      <span className="text-accent-green font-medium">
                        ~{(maxExpNum / (ltvPct / 100)).toLocaleString()} USD
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-text-muted text-sm">Tokens bloqueados max</span>
                      <span className="text-accent-green font-medium">
                        {priceNum > 0 ? ((maxExpNum / (ltvPct / 100)) / priceNum).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "?"} {tokenSymbol || "TOKEN"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tier comparison for this token */}
              <div className="pt-4 border-t border-border">
                <h4 className="text-text-secondary font-medium text-sm uppercase tracking-wider mb-3">
                  Comparacion por Tier para {exampleLoan.toLocaleString()} USDC
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {TIERS.map((t, i) => {
                    const tLtv = t.ltvBps / 100;
                    const collVal = tLtv > 0 ? exampleLoan / (tLtv / 100) : 0;
                    const collTokens = priceNum > 0 ? collVal / priceNum : 0;
                    const tierLetters = ["A", "B", "C", "D"];
                    const tierBorders = [
                      "border-accent-green/30",
                      "border-accent-blue/30",
                      "border-accent-yellow/30",
                      "border-accent-red/30",
                    ];
                    return (
                      <div
                        key={i}
                        className={clsx(
                          "rounded-xl bg-bg-secondary p-3 border text-center",
                          tierIndex === i ? tierBorders[i] : "border-border/30"
                        )}
                      >
                        <p className="text-text-muted text-xs">Tier {tierLetters[i]}</p>
                        <p className="text-text-primary font-bold text-lg mt-1">
                          {collTokens.toFixed(1)}
                        </p>
                        <p className="text-text-muted text-xs">{tokenSymbol || "TOKEN"}</p>
                        <p className="text-text-muted text-xs mt-1">${collVal.toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </GlassCard>
        </section>
      )}
    </div>
  );
}
