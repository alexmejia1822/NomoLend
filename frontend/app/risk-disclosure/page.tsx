"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { useTranslation } from "@/i18n/context";
import {
  AlertTriangle,
  Bug,
  TrendingDown,
  Gavel,
  Activity,
  Radio,
  Droplets,
  Settings,
  Wifi,
  Scale,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

/* ------------------------------------------------------------------ */
/*  Risk Section Component                                             */
/* ------------------------------------------------------------------ */

function RiskSection({
  icon,
  title,
  severity,
  children,
  locale,
}: {
  icon: React.ReactNode;
  title: string;
  severity: "high" | "medium" | "info";
  children: React.ReactNode;
  locale?: string;
}) {
  const severityStyles = {
    high: {
      iconBg: "bg-accent-red/10 border-accent-red/20",
      badge: "bg-accent-red/10 text-accent-red border border-accent-red/20",
      label: locale === "es" ? "Alto Riesgo" : "High Risk",
    },
    medium: {
      iconBg: "bg-accent-yellow/10 border-accent-yellow/20",
      badge: "bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20",
      label: locale === "es" ? "Riesgo Medio" : "Medium Risk",
    },
    info: {
      iconBg: "bg-accent-blue/10 border-accent-blue/20",
      badge: "bg-accent-blue/10 text-accent-blue border border-accent-blue/20",
      label: locale === "es" ? "Informativo" : "Informational",
    },
  };

  const s = severityStyles[severity];

  return (
    <motion.section variants={itemVariants}>
      <GlassCard padding="md">
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`w-9 h-9 rounded-lg ${s.iconBg} flex items-center justify-center shrink-0`}
          >
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-text-primary">{title}</h2>
              <span
                className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${s.badge}`}
              >
                {s.label}
              </span>
            </div>
          </div>
        </div>
        <div className="text-sm text-text-secondary leading-relaxed space-y-3 pl-12">
          {children}
        </div>
      </GlassCard>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  Risk Disclosure Page                                               */
/* ------------------------------------------------------------------ */

export default function RiskDisclosurePage() {
  const { t, locale } = useTranslation();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-8"
    >
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <motion.section
        variants={itemVariants}
        className="relative overflow-hidden rounded-xl bg-bg-card border border-border p-6 md:p-8"
      >
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-accent-red/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-accent-yellow/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent-yellow/10 border border-accent-yellow/20 flex items-center justify-center">
              <AlertTriangle className="w-4.5 h-4.5 text-accent-yellow" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">
            {t("riskDisclosure.title")}
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed max-w-2xl mx-auto">
            {locale === "es"
              ? "Comprenda los riesgos asociados con el uso del protocolo NomoLend antes de suministrar o pedir prestado activos."
              : "Understand the risks associated with using the NomoLend protocol before supplying or borrowing assets."}
          </p>
          <p className="text-text-muted text-xs mt-3">
            {t("riskDisclosure.lastUpdated")}
          </p>
        </div>
      </motion.section>

      {locale === "es" ? (
        <>
          {/* ── Advertencia General ───────────────────────────────── */}
          <motion.section variants={itemVariants}>
            <div className="rounded-xl bg-accent-red/10 border border-accent-red/30 p-5 md:p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent-red/20 border border-accent-red/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-accent-red" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-accent-red mb-2">
                    Advertencia General
                  </h2>
                  <p className="text-sm text-text-secondary leading-relaxed mb-3">
                    Los protocolos de finanzas descentralizadas (DeFi) implican un riesgo sustancial de perdida. Solo suministre activos que pueda permitirse perder por completo. El rendimiento pasado no garantiza resultados futuros, y ningun mecanismo dentro del Protocolo puede eliminar completamente la posibilidad de perdida financiera.
                  </p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Al usar NomoLend, usted reconoce que ha leido y comprendido todos los riesgos descritos a continuacion y acepta plena responsabilidad por cualquier perdida que pueda ocurrir.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ── 1. Riesgo de Contratos Inteligentes ──────────────── */}
          <RiskSection
            icon={<Bug className="w-5 h-5 text-accent-red" />}
            title="1. Riesgo de Contratos Inteligentes"
            severity="high"
            locale={locale}
          >
            <p>
              El protocolo NomoLend esta construido sobre un sistema de contratos inteligentes interconectados desplegados en la blockchain de Base. A pesar de pruebas rigurosas, revision de codigo y el uso de librerias probadas como OpenZeppelin, los contratos inteligentes pueden contener bugs, errores logicos o vulnerabilidades no descubiertos.
            </p>
            <p>
              Las vulnerabilidades explotables podrian resultar en la perdida parcial o total de los fondos depositados en el Protocolo. La naturaleza inmutable de la blockchain significa que ciertos bugs no pueden ser parcheados retroactivamente, y los fondos perdidos por exploits pueden ser irrecuperables.
            </p>
            <p>
              El Protocolo aun no ha sido sometido a una auditoria de seguridad formal por terceros. Los usuarios deben considerar este factor cuidadosamente al decidir cuanto capital desplegar.
            </p>
          </RiskSection>

          {/* ── 2. Volatilidad del Mercado ────────────────────────── */}
          <RiskSection
            icon={<TrendingDown className="w-5 h-5 text-accent-red" />}
            title="2. Volatilidad del Mercado"
            severity="high"
            locale={locale}
          >
            <p>
              Los tokens de colateral utilizados en el protocolo NomoLend estan sujetos a una volatilidad de precios significativa. El valor del colateral puede disminuir rapida e inesperadamente, particularmente durante periodos de alto estres del mercado, liquidaciones en cascada o caidas generales del mercado cripto.
            </p>
            <p>
              Una caida repentina en el valor del colateral puede desencadenar la liquidacion de su posicion antes de que tenga la oportunidad de agregar colateral adicional o repagar su prestamo. En condiciones extremas del mercado, los ingresos de la liquidacion pueden no ser suficientes para cubrir la deuda pendiente.
            </p>
          </RiskSection>

          {/* ── 3. Riesgo de Liquidacion ──────────────────────────── */}
          <RiskSection
            icon={<Gavel className="w-5 h-5 text-accent-red" />}
            title="3. Riesgo de Liquidacion"
            severity="high"
            locale={locale}
          >
            <p>
              NomoLend emplea un sistema de liquidacion automatizado para proteger a los prestamistas. Cuando el Factor de Salud (HF) de un prestamo cae por debajo de 1.0, la posicion se vuelve elegible para liquidacion. El proceso de liquidacion funciona de la siguiente manera:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Monitoreo del Factor de Salud:</span>{" "}
                El Protocolo calcula continuamente el HF basado en el valor actual del colateral relativo a la deuda pendiente.
              </li>
              <li>
                <span className="text-text-secondary">Periodo de gracia:</span>{" "}
                Una vez que una posicion es marcada para liquidacion, se inicia un periodo de gracia de 4 horas, durante el cual el prestatario puede repagar el prestamo o agregar colateral para restaurar el HF por encima de 1.0.
              </li>
              <li>
                <span className="text-text-secondary">Ejecucion de swap en DEX:</span>{" "}
                Si el prestatario no actua dentro del periodo de gracia, el bot de liquidacion vende el colateral en exchanges descentralizados (DEXs) para repagar el principal del prestamista y los intereses acumulados.
              </li>
              <li>
                <span className="text-text-secondary">Excedente y deficit:</span>{" "}
                Cualquier excedente de la liquidacion se devuelve al prestatario. Si los ingresos de la liquidacion son insuficientes, el prestamista puede recibir menos del monto total adeudado.
              </li>
            </ul>
            <p>
              Los prestamos vencidos (pasada su fecha de vencimiento) tambien estan sujetos a liquidacion, con una penalidad adicional del 2% aplicada al prestatario.
            </p>
          </RiskSection>

          {/* ── 4. Riesgo de Oraculos ─────────────────────────────── */}
          <RiskSection
            icon={<Radio className="w-5 h-5 text-accent-yellow" />}
            title="4. Riesgo de Oraculos"
            severity="medium"
            locale={locale}
          >
            <p>
              NomoLend usa un sistema de oraculo dual que combina precios promedio ponderados por tiempo (TWAP) on-chain con feeds de precios de Chainlink como referencia secundaria. Si bien este diseno mejora la confiabilidad, el riesgo de oraculos no puede eliminarse completamente.
            </p>
            <p>
              Los posibles modos de falla de oraculos incluyen:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Datos obsoletos:</span>{" "}
                Los feeds de precios pueden no actualizarse oportunamente, particularmente durante periodos de alta congestion de red.
              </li>
              <li>
                <span className="text-text-secondary">Manipulacion de precios:</span>{" "}
                Los precios TWAP derivados de pools de DEX pueden ser influenciados por operaciones grandes o ataques de prestamos flash, aunque el mecanismo de promedio ponderado por tiempo mitiga la manipulacion a corto plazo.
              </li>
              <li>
                <span className="text-text-secondary">Divergencia de oraculos:</span>{" "}
                En casos raros, los feeds TWAP y Chainlink pueden divergir significativamente, lo que podria afectar la precision de los calculos del Factor de Salud.
              </li>
            </ul>
          </RiskSection>

          {/* ── 5. Riesgo de Liquidez ─────────────────────────────── */}
          <RiskSection
            icon={<Droplets className="w-5 h-5 text-accent-yellow" />}
            title="5. Riesgo de Liquidez"
            severity="medium"
            locale={locale}
          >
            <p>
              La liquidacion de colateral depende de suficiente liquidez en pools de DEX para ejecutar swaps a un precio razonable. En caso de una crisis de liquidez generalizada o para tokens con bajo volumen de negociacion, el bot de liquidacion puede no poder vender el colateral a un precio justo.
            </p>
            <p>
              El alto deslizamiento durante los swaps de liquidacion puede resultar en que los prestamistas reciban menos del valor total del prestamo pendiente, y los prestatarios pierdan mas colateral del que seria necesario.
            </p>
          </RiskSection>

          {/* ── 6. Riesgo de Actualizacion del Protocolo ──────────── */}
          <RiskSection
            icon={<Settings className="w-5 h-5 text-accent-yellow" />}
            title="6. Riesgo de Actualizacion del Protocolo"
            severity="medium"
            locale={locale}
          >
            <p>
              El Protocolo incluye funciones administrativas que permiten a partes autorizadas actualizar parametros de configuracion, pausar contratos y modificar el comportamiento del sistema. Si bien las acciones administrativas estan protegidas por un Safe multi-sig (que requiere 2 de 3 firmantes) y control de acceso basado en roles, estos mecanismos introducen riesgo de centralizacion.
            </p>
            <p>
              Los cambios en los parametros del Protocolo como ratios LTV, umbrales de liquidacion, estructuras de tarifas o listas blancas de tokens podrian afectar el perfil de riesgo de las posiciones existentes. Los usuarios deben monitorear los anuncios de gobernanza y ser conscientes de que el comportamiento del Protocolo puede cambiar con el tiempo.
            </p>
          </RiskSection>

          {/* ── 7. Riesgo Operacional ─────────────────────────────── */}
          <RiskSection
            icon={<Wifi className="w-5 h-5 text-accent-blue" />}
            title="7. Riesgo Operacional"
            severity="info"
            locale={locale}
          >
            <p>
              El Protocolo depende de infraestructura off-chain, incluyendo bots keeper, para operaciones criticas como actualizaciones de precios, monitoreo de factor de salud y ejecucion de liquidaciones. Los riesgos operacionales incluyen:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Tiempo de inactividad de bots keeper:</span>{" "}
                Si los bots de liquidacion o actualizacion de precios experimentan tiempo de inactividad, las liquidaciones pueden retrasarse, resultando potencialmente en posiciones sub-colateralizadas y perdidas para los prestamistas.
              </li>
              <li>
                <span className="text-text-secondary">Congestion de red:</span>{" "}
                La congestion de la red Base puede retrasar o aumentar el costo de las transacciones de liquidacion, afectando la oportunidad y eficiencia del proceso de liquidacion.
              </li>
              <li>
                <span className="text-text-secondary">Indisponibilidad del frontend:</span>{" "}
                La interfaz web puede estar temporalmente no disponible, aunque los usuarios siempre pueden interactuar directamente con los contratos inteligentes a traves de otros medios (por ejemplo, exploradores de bloques, herramientas de linea de comandos).
              </li>
            </ul>
          </RiskSection>

          {/* ── 8. Incertidumbre Regulatoria ──────────────────────── */}
          <RiskSection
            icon={<Scale className="w-5 h-5 text-accent-blue" />}
            title="8. Incertidumbre Regulatoria"
            severity="info"
            locale={locale}
          >
            <p>
              El panorama regulatorio para las finanzas descentralizadas esta evolucionando y varia significativamente entre jurisdicciones. Futuras acciones regulatorias podrian restringir o prohibir el uso de protocolos DeFi en ciertas regiones, afectando potencialmente su capacidad de acceder o usar el Protocolo.
            </p>
            <p>
              Los cambios en la regulacion tambien podrian afectar la disponibilidad de ciertos tokens, la legalidad de las actividades de prestamo y emprestito, o el tratamiento fiscal de las transacciones DeFi en su jurisdiccion. Los usuarios son los unicos responsables de entender y cumplir con todas las leyes y regulaciones aplicables.
            </p>
          </RiskSection>

          {/* ── Reconocimiento ────────────────────────────────────── */}
          <motion.section variants={itemVariants}>
            <div className="rounded-xl bg-accent-yellow/10 border border-accent-yellow/30 p-5 md:p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 border border-accent-yellow/30 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-accent-yellow" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-accent-yellow mb-2">
                    Reconocimiento
                  </h2>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Al usar el protocolo NomoLend, usted confirma que ha leido, comprendido y aceptado todos los riesgos descritos anteriormente. Acepta que esta usando el Protocolo bajo su propio riesgo y que ninguna parte asociada con el Protocolo sera responsable de cualquier perdida que pueda incurrir. Si no comprende completamente estos riesgos, no use el Protocolo.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>
        </>
      ) : (
        <>
          {/* ── General Warning ───────────────────────────────────── */}
          <motion.section variants={itemVariants}>
            <div className="rounded-xl bg-accent-red/10 border border-accent-red/30 p-5 md:p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent-red/20 border border-accent-red/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-accent-red" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-accent-red mb-2">
                    General Warning
                  </h2>
                  <p className="text-sm text-text-secondary leading-relaxed mb-3">
                    Decentralized finance (DeFi) protocols involve substantial risk of
                    loss. Only supply assets you can afford to lose entirely. Past
                    performance does not guarantee future results, and no mechanism
                    within the Protocol can fully eliminate the possibility of financial
                    loss.
                  </p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    By using NomoLend, you acknowledge that you have read and understood
                    all risks described below and accept full responsibility for any
                    losses that may occur.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ── 1. Smart Contract Risk ────────────────────────────── */}
          <RiskSection
            icon={<Bug className="w-5 h-5 text-accent-red" />}
            title="1. Smart Contract Risk"
            severity="high"
            locale={locale}
          >
            <p>
              The NomoLend protocol is built on a system of interconnected smart
              contracts deployed on the Base blockchain. Despite rigorous testing,
              code review, and the use of battle-tested libraries such as OpenZeppelin,
              smart contracts may contain undiscovered bugs, logic errors, or
              vulnerabilities.
            </p>
            <p>
              Exploitable vulnerabilities could result in partial or total loss of
              funds deposited in the Protocol. The immutable nature of blockchain
              means that certain bugs cannot be patched retroactively, and funds lost
              to exploits may be irrecoverable.
            </p>
            <p>
              The Protocol has not yet undergone a formal third-party security audit.
              Users should weigh this factor carefully when deciding how much capital
              to deploy.
            </p>
          </RiskSection>

          {/* ── 2. Market Volatility ──────────────────────────────── */}
          <RiskSection
            icon={<TrendingDown className="w-5 h-5 text-accent-red" />}
            title="2. Market Volatility"
            severity="high"
            locale={locale}
          >
            <p>
              Collateral tokens used in the NomoLend protocol are subject to
              significant price volatility. The value of collateral can decrease
              rapidly and without warning, particularly during periods of high market
              stress, cascading liquidations, or broader crypto market downturns.
            </p>
            <p>
              A sudden drop in collateral value may trigger liquidation of your
              position before you have the opportunity to add additional collateral or
              repay your loan. In extreme market conditions, the proceeds from
              liquidation may not be sufficient to cover the outstanding debt.
            </p>
          </RiskSection>

          {/* ── 3. Liquidation Risk ───────────────────────────────── */}
          <RiskSection
            icon={<Gavel className="w-5 h-5 text-accent-red" />}
            title="3. Liquidation Risk"
            severity="high"
            locale={locale}
          >
            <p>
              NomoLend employs an automated liquidation system to protect lenders. When
              a loan&apos;s Health Factor (HF) falls below 1.0, the position becomes
              eligible for liquidation. The liquidation process works as follows:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Health Factor monitoring:</span>{" "}
                The Protocol continuously calculates the HF based on the current value
                of collateral relative to the outstanding debt.
              </li>
              <li>
                <span className="text-text-secondary">Grace period:</span>{" "}
                Once a position is flagged for liquidation, a 4-hour grace period is
                initiated, during which the borrower may repay the loan or add
                collateral to restore the HF above 1.0.
              </li>
              <li>
                <span className="text-text-secondary">DEX swap execution:</span>{" "}
                If the borrower does not act within the grace period, the liquidation
                bot sells the collateral on decentralized exchanges (DEXs) to repay
                the lender&apos;s principal and accrued interest.
              </li>
              <li>
                <span className="text-text-secondary">Surplus and deficit:</span>{" "}
                Any surplus from the liquidation is returned to the borrower. If the
                liquidation proceeds are insufficient, the lender may receive less than
                the full amount owed.
              </li>
            </ul>
            <p>
              Expired loans (past their maturity date) are also subject to liquidation,
              with an additional 2% penalty applied to the borrower.
            </p>
          </RiskSection>

          {/* ── 4. Oracle Risk ────────────────────────────────────── */}
          <RiskSection
            icon={<Radio className="w-5 h-5 text-accent-yellow" />}
            title="4. Oracle Risk"
            severity="medium"
            locale={locale}
          >
            <p>
              NomoLend uses a dual oracle system combining on-chain Time-Weighted
              Average Prices (TWAP) with Chainlink price feeds as a secondary
              reference. While this design improves reliability, oracle risk cannot
              be fully eliminated.
            </p>
            <p>
              Potential oracle failure modes include:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Stale data:</span>{" "}
                Price feeds may not update in a timely manner, particularly during
                periods of high network congestion.
              </li>
              <li>
                <span className="text-text-secondary">Price manipulation:</span>{" "}
                TWAP prices derived from DEX pools can be influenced by large trades
                or flash loan attacks, although the time-weighted averaging mechanism
                mitigates short-term manipulation.
              </li>
              <li>
                <span className="text-text-secondary">Oracle divergence:</span>{" "}
                In rare cases, the TWAP and Chainlink feeds may diverge significantly,
                which could affect the accuracy of Health Factor calculations.
              </li>
            </ul>
          </RiskSection>

          {/* ── 5. Liquidity Risk ─────────────────────────────────── */}
          <RiskSection
            icon={<Droplets className="w-5 h-5 text-accent-yellow" />}
            title="5. Liquidity Risk"
            severity="medium"
            locale={locale}
          >
            <p>
              Liquidation of collateral relies on sufficient liquidity in DEX pools to
              execute swaps at a reasonable price. In the event of a market-wide
              liquidity crisis or for tokens with thin trading volume, the liquidation
              bot may be unable to sell collateral at a fair price.
            </p>
            <p>
              High slippage during liquidation swaps may result in lenders receiving
              less than the full value of the outstanding loan, and borrowers losing
              more collateral than would otherwise be necessary.
            </p>
          </RiskSection>

          {/* ── 6. Protocol Upgrade Risk ──────────────────────────── */}
          <RiskSection
            icon={<Settings className="w-5 h-5 text-accent-yellow" />}
            title="6. Protocol Upgrade Risk"
            severity="medium"
            locale={locale}
          >
            <p>
              The Protocol includes administrative functions that allow authorized
              parties to update configuration parameters, pause contracts, and modify
              system behavior. While administrative actions are protected by a multi-sig
              Safe (requiring 2 of 3 signers) and role-based access control, these
              mechanisms introduce centralization risk.
            </p>
            <p>
              Changes to Protocol parameters such as LTV ratios, liquidation thresholds,
              fee structures, or token whitelists could affect the risk profile of
              existing positions. Users should monitor governance announcements and
              be aware that Protocol behavior may change over time.
            </p>
          </RiskSection>

          {/* ── 7. Operational Risk ───────────────────────────────── */}
          <RiskSection
            icon={<Wifi className="w-5 h-5 text-accent-blue" />}
            title="7. Operational Risk"
            severity="info"
            locale={locale}
          >
            <p>
              The Protocol relies on off-chain infrastructure, including keeper bots,
              for critical operations such as price updates, health factor monitoring,
              and liquidation execution. Operational risks include:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Keeper bot downtime:</span>{" "}
                If the liquidation or price update bots experience downtime, liquidations
                may be delayed, potentially resulting in under-collateralized positions
                and losses for lenders.
              </li>
              <li>
                <span className="text-text-secondary">Network congestion:</span>{" "}
                Base network congestion may delay or increase the cost of liquidation
                transactions, affecting the timeliness and efficiency of the
                liquidation process.
              </li>
              <li>
                <span className="text-text-secondary">Frontend unavailability:</span>{" "}
                The web interface may be temporarily unavailable, though users can
                always interact directly with the smart contracts through other
                means (e.g., block explorers, command-line tools).
              </li>
            </ul>
          </RiskSection>

          {/* ── 8. Regulatory Uncertainty ─────────────────────────── */}
          <RiskSection
            icon={<Scale className="w-5 h-5 text-accent-blue" />}
            title="8. Regulatory Uncertainty"
            severity="info"
            locale={locale}
          >
            <p>
              The regulatory landscape for decentralized finance is evolving and varies
              significantly across jurisdictions. Future regulatory actions could
              restrict or prohibit the use of DeFi protocols in certain regions,
              potentially affecting your ability to access or use the Protocol.
            </p>
            <p>
              Changes in regulation could also affect the availability of certain tokens,
              the legality of lending and borrowing activities, or the tax treatment of
              DeFi transactions in your jurisdiction. Users are solely responsible for
              understanding and complying with all applicable laws and regulations.
            </p>
          </RiskSection>

          {/* ── Final Acknowledgment ──────────────────────────────── */}
          <motion.section variants={itemVariants}>
            <div className="rounded-xl bg-accent-yellow/10 border border-accent-yellow/30 p-5 md:p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 border border-accent-yellow/30 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-accent-yellow" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-accent-yellow mb-2">
                    Acknowledgment
                  </h2>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    By using the NomoLend protocol, you confirm that you have read,
                    understood, and accepted all the risks described above. You agree
                    that you are using the Protocol at your own risk and that no party
                    associated with the Protocol shall be held liable for any losses
                    you may incur. If you do not fully understand these risks, do not
                    use the Protocol.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>
        </>
      )}
    </motion.div>
  );
}
