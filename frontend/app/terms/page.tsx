"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { useTranslation } from "@/i18n/context";
import {
  FileText,
  Shield,
  AlertTriangle,
  Scale,
  UserCheck,
  Wallet,
  Zap,
  TrendingDown,
  Info,
  Server,
  ShieldOff,
  RefreshCw,
  Landmark,
  MessageSquare,
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
/*  Section Component                                                  */
/* ------------------------------------------------------------------ */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section variants={itemVariants}>
      <GlassCard padding="md">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <h2 className="text-lg font-bold text-text-primary pt-1">{title}</h2>
        </div>
        <div className="text-sm text-text-secondary leading-relaxed space-y-3 pl-12">
          {children}
        </div>
      </GlassCard>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  Terms of Use Page                                                  */
/* ------------------------------------------------------------------ */

export default function TermsPage() {
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
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-accent-blue/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-accent-purple/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-accent-blue" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">
            {t("terms.title")}
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed max-w-2xl mx-auto">
            {locale === "es" ? "Por favor lea estos terminos cuidadosamente antes de usar el protocolo NomoLend." : "Please read these terms carefully before using the NomoLend protocol."}
          </p>
          <p className="text-text-muted text-xs mt-3">
            {t("terms.lastUpdated")}
          </p>
        </div>
      </motion.section>

      {locale === "es" ? (
        <>
          {/* ── 1. Introduccion ─────────────────────────────────────── */}
          <Section
            icon={<Info className="w-5 h-5 text-accent-blue" />}
            title="1. Introduccion"
          >
            <p>
              Bienvenido a NomoLend, un protocolo de prestamos peer-to-peer descentralizado desplegado en la blockchain de Base. Estos Terminos de Uso (&quot;Terminos&quot;) rigen su acceso y uso del protocolo NomoLend, incluyendo todos los contratos inteligentes, interfaces, APIs y documentacion asociados (colectivamente, el &quot;Protocolo&quot;).
            </p>
            <p>
              Al acceder o usar el Protocolo, usted reconoce que ha leido, comprendido y acepta estar sujeto a estos Terminos. Si no esta de acuerdo con estos Terminos, no debe usar el Protocolo.
            </p>
          </Section>

          {/* ── 2. Naturaleza del Protocolo ─────────────────────────── */}
          <Section
            icon={<Landmark className="w-5 h-5 text-accent-blue" />}
            title="2. Naturaleza del Protocolo"
          >
            <p>
              NomoLend es un protocolo descentralizado y no custodial. En ningun momento el Protocolo o sus colaboradores toman custodia de sus activos. Usted interactua directamente con contratos inteligentes desplegados en la blockchain de Base, y todas las transacciones se ejecutan on-chain sin intermediarios.
            </p>
            <p>
              El Protocolo proporciona un marco para prestamos peer-to-peer donde los prestamistas suministran USDC y los prestatarios proporcionan colateral en forma de tokens ERC-20 aprobados. El Protocolo en si no presta, pide prestado ni mantiene fondos en nombre de ningun usuario.
            </p>
          </Section>

          {/* ── 3. Elegibilidad ─────────────────────────────────────── */}
          <Section
            icon={<UserCheck className="w-5 h-5 text-accent-blue" />}
            title="3. Elegibilidad"
          >
            <p>
              Al usar el Protocolo, usted representa y garantiza que tiene la edad legal en su jurisdiccion y la capacidad legal para aceptar estos Terminos. Usted es el unico responsable de asegurar que su uso del Protocolo cumpla con todas las leyes y regulaciones aplicables en su jurisdiccion.
            </p>
            <p>
              No debe usar el Protocolo si se encuentra en, o es ciudadano o residente de, cualquier jurisdiccion donde el uso de protocolos financieros descentralizados esta prohibido o restringido por ley.
            </p>
          </Section>

          {/* ── 4. Responsabilidades del Usuario ────────────────────── */}
          <Section
            icon={<Wallet className="w-5 h-5 text-accent-blue" />}
            title="4. Responsabilidades del Usuario"
          >
            <p>
              Usted es el unico responsable de la seguridad y gestion de su billetera blockchain, claves privadas y frases semilla. El Protocolo no tiene la capacidad de recuperar claves perdidas o revertir transacciones no autorizadas.
            </p>
            <p>
              Usted reconoce que tiene un conocimiento suficiente de finanzas descentralizadas (DeFi), tecnologia blockchain, contratos inteligentes y activos digitales para evaluar los riesgos asociados con el uso del Protocolo. Acepta plena responsabilidad por cualquier perdida derivada de su uso del Protocolo.
            </p>
          </Section>

          {/* ── 5. Interaccion con Contratos Inteligentes ───────────── */}
          <Section
            icon={<Zap className="w-5 h-5 text-accent-blue" />}
            title="5. Interaccion con Contratos Inteligentes"
          >
            <p>
              Todas las interacciones con el Protocolo se ejecutan a traves de contratos inteligentes en la blockchain de Base. Una vez que una transaccion es enviada y confirmada on-chain, es irreversible. Ni los colaboradores del Protocolo ni terceros pueden revertir, cancelar o modificar transacciones confirmadas.
            </p>
            <p>
              Usted es responsable de todas las tarifas de gas y costos de red asociados con sus transacciones. Las tarifas de gas se pagan a los validadores de la red y no son reembolsables, independientemente de si una transaccion tiene exito o falla.
            </p>
          </Section>

          {/* ── 6. Riesgos de Usar DeFi ─────────────────────────────── */}
          <Section
            icon={<TrendingDown className="w-5 h-5 text-accent-yellow" />}
            title="6. Riesgos de Usar DeFi"
          >
            <p>
              El uso de protocolos financieros descentralizados implica riesgos significativos, incluyendo pero no limitado a:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Vulnerabilidades de contratos inteligentes:</span> A pesar de pruebas exhaustivas, los contratos inteligentes pueden contener bugs o vulnerabilidades explotables que podrian resultar en perdida de fondos.
              </li>
              <li>
                <span className="text-text-secondary">Fallas de oraculos:</span> Los feeds de precios pueden proporcionar datos inexactos, obsoletos o manipulados, lo que podria llevar a liquidaciones incorrectas o colateral mal valorado.
              </li>
              <li>
                <span className="text-text-secondary">Volatilidad del mercado:</span> El valor de los activos digitales puede fluctuar dramaticamente en periodos cortos, lo que puede resultar en la liquidacion del colateral o perdida del principal.
              </li>
              <li>
                <span className="text-text-secondary">Congestion de red:</span> La congestion de la red Base puede retrasar transacciones, incluyendo operaciones sensibles al tiempo como el repago de prestamos o la adicion de colateral.
              </li>
            </ul>
          </Section>

          {/* ── 7. No es Asesoria Financiera ────────────────────────── */}
          <Section
            icon={<AlertTriangle className="w-5 h-5 text-accent-yellow" />}
            title="7. No es Asesoria Financiera"
          >
            <p>
              Nada contenido en el Protocolo, su documentacion o su interfaz de usuario constituye asesoria financiera, de inversion, legal o fiscal. Toda la informacion proporcionada es solo para fines informativos y no debe ser utilizada como base para tomar decisiones financieras.
            </p>
            <p>
              Debe consultar profesionales financieros, legales y fiscales calificados antes de participar en cualquier actividad de prestamo, emprestito u otras actividades financieras a traves del Protocolo.
            </p>
          </Section>

          {/* ── 8. Disponibilidad del Protocolo ─────────────────────── */}
          <Section
            icon={<Server className="w-5 h-5 text-accent-blue" />}
            title="8. Disponibilidad del Protocolo"
          >
            <p>
              El Protocolo se proporciona &quot;tal cual&quot; y &quot;segun disponibilidad&quot;. No hay garantia de operacion continua, ininterrumpida o libre de errores. El Protocolo puede estar temporal o permanentemente no disponible debido a mantenimiento, actualizaciones, incidentes de seguridad u otras circunstancias.
            </p>
            <p>
              El Protocolo incluye funcionalidad de pausa de emergencia que puede activarse para proteger los fondos de los usuarios en caso de una vulnerabilidad detectada o incidente de seguridad. Durante una pausa, ciertas o todas las funciones del Protocolo pueden estar temporalmente no disponibles.
            </p>
          </Section>

          {/* ── 9. Limitacion de Responsabilidad ────────────────────── */}
          <Section
            icon={<ShieldOff className="w-5 h-5 text-accent-red" />}
            title="9. Limitacion de Responsabilidad"
          >
            <p>
              En la maxima medida permitida por la ley aplicable, los colaboradores, desarrolladores y partes asociadas del Protocolo no seran responsables de ningun dano directo, indirecto, incidental, especial, consecuente o ejemplar derivado de o relacionado con su uso del Protocolo, incluyendo pero no limitado a perdida de fondos, perdida de datos, perdida de beneficios o cualquier otra perdida intangible.
            </p>
            <p>
              Esta limitacion aplica independientemente de la teoria de responsabilidad, ya sea basada en contrato, agravio, negligencia, responsabilidad estricta o cualquier otra teoria legal o equitativa, incluso si las partes han sido informadas de la posibilidad de tales danos.
            </p>
          </Section>

          {/* ── 10. Indemnizacion ───────────────────────────────────── */}
          <Section
            icon={<Shield className="w-5 h-5 text-accent-blue" />}
            title="10. Indemnizacion"
          >
            <p>
              Usted acepta indemnizar, defender y mantener indemnes a los colaboradores, desarrolladores y partes asociadas del Protocolo de y contra cualquier reclamo, demanda, accion, dano, perdida, costo y gasto (incluyendo honorarios razonables de abogados) derivados de o relacionados con su uso del Protocolo, su violacion de estos Terminos o su violacion de los derechos de un tercero.
            </p>
          </Section>

          {/* ── 11. Modificaciones ──────────────────────────────────── */}
          <Section
            icon={<RefreshCw className="w-5 h-5 text-accent-blue" />}
            title="11. Modificaciones"
          >
            <p>
              Estos Terminos pueden actualizarse o modificarse en cualquier momento sin previo aviso. La fecha de &quot;Ultima actualizacion&quot; en la parte superior de esta pagina indica cuando estos Terminos fueron revisados por ultima vez. Su uso continuado del Protocolo despues de cualquier cambio constituye su aceptacion de los Terminos revisados.
            </p>
            <p>
              Los cambios materiales a estos Terminos pueden comunicarse a traves de la interfaz del Protocolo o canales de comunicacion oficiales, pero usted es responsable de revisar los Terminos periodicamente.
            </p>
          </Section>

          {/* ── 12. Principios Rectores ─────────────────────────────── */}
          <Section
            icon={<Scale className="w-5 h-5 text-accent-purple" />}
            title="12. Principios Rectores"
          >
            <p>
              NomoLend opera como un protocolo descentralizado gobernado por su codigo de contrato inteligente y, cuando sea aplicable, por mecanismos de gobernanza descentralizados. El Protocolo no esta incorporado en ninguna jurisdiccion y no reconoce la autoridad de ningun marco legal nacional unico.
            </p>
            <p>
              Cualquier disputa derivada del uso del Protocolo debe resolverse a traves de procesos de gobernanza comunitaria o, cuando sea necesario, a traves de arbitraje en un foro mutuamente acordado.
            </p>
          </Section>

          {/* ── 13. Contacto ────────────────────────────────────────── */}
          <Section
            icon={<MessageSquare className="w-5 h-5 text-accent-blue" />}
            title="13. Contacto"
          >
            <p>
              Si tiene preguntas, inquietudes o comentarios sobre estos Terminos o el Protocolo, por favor comuniquese a traves de los canales oficiales:
            </p>
            <div className="rounded-lg bg-bg-secondary border border-border p-4 mt-2">
              <p className="text-text-primary font-medium text-sm">
                GitHub Issues
              </p>
              <p className="text-text-muted text-xs mt-1">
                Para reportes de bugs, solicitudes de funcionalidades y consultas generales, por favor abra un issue en el repositorio de GitHub de NomoLend.
              </p>
            </div>
          </Section>
        </>
      ) : (
        <>
          {/* ── 1. Introduction ───────────────────────────────────────── */}
          <Section
            icon={<Info className="w-5 h-5 text-accent-blue" />}
            title="1. Introduction"
          >
            <p>
              Welcome to NomoLend, a decentralized peer-to-peer lending protocol
              deployed on the Base blockchain. These Terms of Use (&quot;Terms&quot;)
              govern your access to and use of the NomoLend protocol, including all
              associated smart contracts, interfaces, APIs, and documentation
              (collectively, the &quot;Protocol&quot;).
            </p>
            <p>
              By accessing or using the Protocol, you acknowledge that you have read,
              understood, and agree to be bound by these Terms. If you do not agree
              with these Terms, you must not use the Protocol.
            </p>
          </Section>

          {/* ── 2. Protocol Nature ────────────────────────────────────── */}
          <Section
            icon={<Landmark className="w-5 h-5 text-accent-blue" />}
            title="2. Protocol Nature"
          >
            <p>
              NomoLend is a non-custodial, decentralized protocol. At no point does the
              Protocol or its contributors take custody of your assets. You interact
              directly with smart contracts deployed on the Base blockchain, and all
              transactions are executed on-chain without intermediaries.
            </p>
            <p>
              The Protocol provides a framework for peer-to-peer lending where lenders
              supply USDC and borrowers provide collateral in the form of approved ERC-20
              tokens. The Protocol itself does not lend, borrow, or hold funds on behalf
              of any user.
            </p>
          </Section>

          {/* ── 3. Eligibility ────────────────────────────────────────── */}
          <Section
            icon={<UserCheck className="w-5 h-5 text-accent-blue" />}
            title="3. Eligibility"
          >
            <p>
              By using the Protocol, you represent and warrant that you are of legal age
              in your jurisdiction and have the legal capacity to enter into these Terms.
              You are solely responsible for ensuring that your use of the Protocol
              complies with all applicable laws and regulations in your jurisdiction.
            </p>
            <p>
              You must not use the Protocol if you are located in, or a citizen or
              resident of, any jurisdiction where the use of decentralized financial
              protocols is prohibited or restricted by law.
            </p>
          </Section>

          {/* ── 4. User Responsibilities ──────────────────────────────── */}
          <Section
            icon={<Wallet className="w-5 h-5 text-accent-blue" />}
            title="4. User Responsibilities"
          >
            <p>
              You are solely responsible for the security and management of your
              blockchain wallet, private keys, and seed phrases. The Protocol has no
              ability to recover lost keys or reverse unauthorized transactions.
            </p>
            <p>
              You acknowledge that you have a sufficient understanding of decentralized
              finance (DeFi), blockchain technology, smart contracts, and digital assets
              to evaluate the risks associated with using the Protocol. You accept full
              responsibility for any losses arising from your use of the Protocol.
            </p>
          </Section>

          {/* ── 5. Smart Contract Interaction ─────────────────────────── */}
          <Section
            icon={<Zap className="w-5 h-5 text-accent-blue" />}
            title="5. Smart Contract Interaction"
          >
            <p>
              All interactions with the Protocol are executed through smart contracts on
              the Base blockchain. Once a transaction is submitted and confirmed on-chain,
              it is irreversible. Neither the Protocol contributors nor any third party can
              reverse, cancel, or modify confirmed transactions.
            </p>
            <p>
              You are responsible for all gas fees and network costs associated with your
              transactions. Gas fees are paid to network validators and are non-refundable,
              regardless of whether a transaction succeeds or fails.
            </p>
          </Section>

          {/* ── 6. Risks of Using DeFi ────────────────────────────────── */}
          <Section
            icon={<TrendingDown className="w-5 h-5 text-accent-yellow" />}
            title="6. Risks of Using DeFi"
          >
            <p>
              The use of decentralized financial protocols involves significant risks,
              including but not limited to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Smart contract vulnerabilities:</span> Despite
                thorough testing, smart contracts may contain bugs or exploitable
                vulnerabilities that could result in loss of funds.
              </li>
              <li>
                <span className="text-text-secondary">Oracle failures:</span> Price feed oracles
                may provide inaccurate, stale, or manipulated data, potentially leading
                to incorrect liquidations or mispriced collateral.
              </li>
              <li>
                <span className="text-text-secondary">Market volatility:</span> The value of
                digital assets can fluctuate dramatically in short periods, which may
                result in the liquidation of collateral or loss of principal.
              </li>
              <li>
                <span className="text-text-secondary">Network congestion:</span> Base network
                congestion may delay transactions, including time-sensitive operations
                such as loan repayment or collateral top-up.
              </li>
            </ul>
          </Section>

          {/* ── 7. No Financial Advice ────────────────────────────────── */}
          <Section
            icon={<AlertTriangle className="w-5 h-5 text-accent-yellow" />}
            title="7. No Financial Advice"
          >
            <p>
              Nothing contained in the Protocol, its documentation, or its user interface
              constitutes financial, investment, legal, or tax advice. All information
              provided is for informational purposes only and should not be relied upon
              as a basis for making financial decisions.
            </p>
            <p>
              You should consult qualified financial, legal, and tax professionals before
              engaging in any lending, borrowing, or other financial activities through
              the Protocol.
            </p>
          </Section>

          {/* ── 8. Protocol Availability ──────────────────────────────── */}
          <Section
            icon={<Server className="w-5 h-5 text-accent-blue" />}
            title="8. Protocol Availability"
          >
            <p>
              The Protocol is provided on an &quot;as is&quot; and &quot;as available&quot; basis. There
              is no guarantee of continuous, uninterrupted, or error-free operation. The
              Protocol may be temporarily or permanently unavailable due to maintenance,
              upgrades, security incidents, or other circumstances.
            </p>
            <p>
              The Protocol includes emergency pause functionality that may be activated
              to protect user funds in the event of a detected vulnerability or security
              incident. During a pause, certain or all Protocol functions may be
              temporarily unavailable.
            </p>
          </Section>

          {/* ── 9. Limitation of Liability ────────────────────────────── */}
          <Section
            icon={<ShieldOff className="w-5 h-5 text-accent-red" />}
            title="9. Limitation of Liability"
          >
            <p>
              To the maximum extent permitted by applicable law, the Protocol
              contributors, developers, and associated parties shall not be liable for
              any direct, indirect, incidental, special, consequential, or exemplary
              damages arising from or related to your use of the Protocol, including
              but not limited to loss of funds, loss of data, loss of profits, or any
              other intangible losses.
            </p>
            <p>
              This limitation applies regardless of the theory of liability, whether
              based on contract, tort, negligence, strict liability, or any other legal
              or equitable theory, even if the parties have been advised of the
              possibility of such damages.
            </p>
          </Section>

          {/* ── 10. Indemnification ───────────────────────────────────── */}
          <Section
            icon={<Shield className="w-5 h-5 text-accent-blue" />}
            title="10. Indemnification"
          >
            <p>
              You agree to indemnify, defend, and hold harmless the Protocol
              contributors, developers, and associated parties from and against any and
              all claims, demands, actions, damages, losses, costs, and expenses
              (including reasonable attorneys&apos; fees) arising from or related to your use
              of the Protocol, your violation of these Terms, or your violation of any
              rights of a third party.
            </p>
          </Section>

          {/* ── 11. Modifications ─────────────────────────────────────── */}
          <Section
            icon={<RefreshCw className="w-5 h-5 text-accent-blue" />}
            title="11. Modifications"
          >
            <p>
              These Terms may be updated or modified at any time without prior notice.
              The &quot;Last updated&quot; date at the top of this page indicates when these Terms
              were last revised. Your continued use of the Protocol after any changes
              constitutes your acceptance of the revised Terms.
            </p>
            <p>
              Material changes to these Terms may be communicated through the Protocol
              interface or official communication channels, but you are responsible for
              reviewing the Terms periodically.
            </p>
          </Section>

          {/* ── 12. Governing Principles ──────────────────────────────── */}
          <Section
            icon={<Scale className="w-5 h-5 text-accent-purple" />}
            title="12. Governing Principles"
          >
            <p>
              NomoLend operates as a decentralized protocol governed by its smart
              contract code and, where applicable, by decentralized governance
              mechanisms. The Protocol is not incorporated in any jurisdiction and does
              not recognize the authority of any single national legal framework.
            </p>
            <p>
              Any disputes arising from the use of the Protocol should be resolved
              through community governance processes or, where necessary, through
              arbitration in a mutually agreed-upon forum.
            </p>
          </Section>

          {/* ── 13. Contact ───────────────────────────────────────────── */}
          <Section
            icon={<MessageSquare className="w-5 h-5 text-accent-blue" />}
            title="13. Contact"
          >
            <p>
              If you have questions, concerns, or feedback regarding these Terms or the
              Protocol, please reach out through the official channels:
            </p>
            <div className="rounded-lg bg-bg-secondary border border-border p-4 mt-2">
              <p className="text-text-primary font-medium text-sm">
                GitHub Issues
              </p>
              <p className="text-text-muted text-xs mt-1">
                For bug reports, feature requests, and general inquiries, please open an
                issue on the NomoLend GitHub repository.
              </p>
            </div>
          </Section>
        </>
      )}
    </motion.div>
  );
}
