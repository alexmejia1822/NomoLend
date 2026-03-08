"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { useTranslation } from "@/i18n/context";
import {
  Eye,
  Shield,
  Database,
  Wallet,
  ExternalLink,
  Lock,
  Cookie,
  RefreshCw,
  MessageSquare,
  Info,
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
          <div className="w-9 h-9 rounded-lg bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center shrink-0">
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
/*  Privacy Policy Page                                                */
/* ------------------------------------------------------------------ */

export default function PrivacyPage() {
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
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-accent-purple/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-accent-blue/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center">
              <Eye className="w-4.5 h-4.5 text-accent-purple" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">
            {t("privacy.title")}
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed max-w-2xl mx-auto">
            {locale === "es" ? "Como el protocolo NomoLend maneja datos y protege su privacidad." : "How the NomoLend protocol handles data and protects your privacy."}
          </p>
          <p className="text-text-muted text-xs mt-3">
            {t("privacy.lastUpdated")}
          </p>
        </div>
      </motion.section>

      {locale === "es" ? (
        <>
          {/* ── 1. Introduccion ─────────────────────────────────────── */}
          <Section
            icon={<Info className="w-5 h-5 text-accent-purple" />}
            title="1. Introduccion"
          >
            <p>
              NomoLend es un protocolo de prestamos descentralizado y no custodial desplegado en la blockchain de Base. Por diseno, el Protocolo opera con minima recoleccion de datos. Esta Politica de Privacidad explica que informacion, si alguna, se recopila cuando interactua con la interfaz frontend de NomoLend y los contratos inteligentes subyacentes.
            </p>
            <p>
              Debido a que NomoLend es un protocolo descentralizado, no existe una entidad central que controle o almacene datos de usuarios en el sentido tradicional. Los contratos inteligentes operan de forma autonoma en la blockchain, y la interfaz frontend es una capa de conveniencia para interactuar con esos contratos.
            </p>
          </Section>

          {/* ── 2. Recoleccion de Informacion ───────────────────────── */}
          <Section
            icon={<Database className="w-5 h-5 text-accent-purple" />}
            title="2. Recoleccion de Informacion"
          >
            <p>
              Los contratos inteligentes del protocolo NomoLend no recopilan, almacenan ni procesan informacion personal. Los contratos inteligentes solo registran datos de transacciones (direcciones de billetera, montos, tipos de tokens) como parte del estado on-chain, lo cual es inherente al funcionamiento de las blockchains.
            </p>
            <p>
              La interfaz frontend de NomoLend puede recopilar datos analiticos limitados y no identificables personalmente para mejorar la experiencia del usuario, incluyendo:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Vistas de pagina y patrones de navegacion</span>{" "}
                para entender que funcionalidades son mas utilizadas.
              </li>
              <li>
                <span className="text-text-secondary">Registros de errores</span> para identificar y resolver bugs en la interfaz frontend.
              </li>
              <li>
                <span className="text-text-secondary">Tipo de dispositivo e informacion del navegador</span>{" "}
                (agregada, no identificable) para mejoras de compatibilidad.
              </li>
            </ul>
            <p>
              No se recopilan nombres, direcciones de correo electronico, numeros de telefono u otra informacion de identificacion personal por parte del Protocolo o su frontend.
            </p>
          </Section>

          {/* ── 3. Transparencia de Blockchain ──────────────────────── */}
          <Section
            icon={<Eye className="w-5 h-5 text-accent-purple" />}
            title="3. Transparencia de Blockchain"
          >
            <p>
              Todas las transacciones ejecutadas a traves del protocolo NomoLend se registran en la blockchain de Base, que es un libro mayor publico y sin permisos. Esto significa que todas las transacciones de prestamo, emprestito, repago y liquidacion son permanentemente visibles para cualquier persona.
            </p>
            <p>
              Los datos on-chain incluyen direcciones de billetera, montos de transacciones, tipos de tokens, marcas de tiempo e interacciones con contratos inteligentes. Estos datos son accesibles publicamente y no pueden ser eliminados, modificados u ocultados. Esta transparencia es una propiedad fundamental de la tecnologia blockchain y no esta bajo el control de los colaboradores del Protocolo.
            </p>
          </Section>

          {/* ── 4. Direcciones de Billetera ─────────────────────────── */}
          <Section
            icon={<Wallet className="w-5 h-5 text-accent-purple" />}
            title="4. Direcciones de Billetera"
          >
            <p>
              Las direcciones de billetera blockchain son identificadores pseudonimos. Si bien no revelan directamente su identidad real, son publicamente visibles en la blockchain y potencialmente pueden vincularse a su identidad a traves de diversos medios (por ejemplo, registros KYC de exchanges, analisis on-chain, divulgaciones en redes sociales).
            </p>
            <p>
              NomoLend no trata las direcciones de billetera como datos privados. Cuando conecta su billetera a la interfaz de NomoLend, su direccion de billetera se usa unicamente para facilitar sus interacciones con los contratos inteligentes y para mostrar informacion relevante de la cuenta en la interfaz de usuario. Su direccion de billetera no se almacena en ningun servidor centralizado por parte del Protocolo.
            </p>
          </Section>

          {/* ── 5. Servicios de Terceros ────────────────────────────── */}
          <Section
            icon={<ExternalLink className="w-5 h-5 text-accent-purple" />}
            title="5. Servicios de Terceros"
          >
            <p>
              La interfaz de NomoLend se integra con varios servicios de terceros para proporcionar su funcionalidad. Cada uno de estos servicios tiene su propia politica de privacidad y practicas de manejo de datos:
            </p>
            <div className="space-y-3 mt-2">
              <div className="rounded-lg bg-bg-secondary border border-border p-4">
                <p className="text-text-primary font-medium text-sm">WalletConnect</p>
                <p className="text-text-muted text-xs mt-1">
                  Usado para la conexion de billetera. WalletConnect puede recopilar metadatos de conexion como el tipo de billetera e informacion de sesion. Consulte la politica de privacidad de WalletConnect para mas detalles.
                </p>
              </div>
              <div className="rounded-lg bg-bg-secondary border border-border p-4">
                <p className="text-text-primary font-medium text-sm">Proveedores RPC</p>
                <p className="text-text-muted text-xs mt-1">
                  La interfaz usa proveedores RPC para comunicarse con la blockchain de Base. Los proveedores RPC pueden registrar direcciones IP y datos de solicitudes. Los usuarios pueden configurar endpoints RPC personalizados para mitigar esto.
                </p>
              </div>
              <div className="rounded-lg bg-bg-secondary border border-border p-4">
                <p className="text-text-primary font-medium text-sm">CoinGecko</p>
                <p className="text-text-muted text-xs mt-1">
                  Usado para obtener datos de precios de tokens e informacion de mercado mostrada en la interfaz. CoinGecko puede registrar metadatos de solicitudes API.
                </p>
              </div>
            </div>
          </Section>

          {/* ── 6. Seguridad ────────────────────────────────────────── */}
          <Section
            icon={<Lock className="w-5 h-5 text-accent-purple" />}
            title="6. Seguridad"
          >
            <p>
              El protocolo NomoLend emplea multiples capas de seguridad para proteger la funcionalidad de los contratos inteligentes y los fondos de los usuarios:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Administracion multi-firma:</span>{" "}
                Las funciones criticas del protocolo estan protegidas por un Safe multi-sig 2-de-3, que requiere multiples firmantes autorizados para cualquier accion administrativa.
              </li>
              <li>
                <span className="text-text-secondary">Control de acceso basado en roles:</span>{" "}
                Se usa OpenZeppelin AccessControl para imponer permisos granulares en todos los contratos del protocolo.
              </li>
              <li>
                <span className="text-text-secondary">Pausa de emergencia:</span>{" "}
                El Protocolo incluye funcionalidad de pausa que puede detener operaciones en caso de un incidente de seguridad detectado.
              </li>
              <li>
                <span className="text-text-secondary">Contratos verificados:</span>{" "}
                Todos los contratos inteligentes estan verificados y publicados en BaseScan para revision publica y transparencia.
              </li>
            </ul>
            <p>
              Si bien estas medidas reducen significativamente el riesgo, ningun sistema es completamente inmune a vulnerabilidades. Los usuarios deben tomar sus propias precauciones de seguridad, incluyendo el uso de billeteras de hardware y la verificacion de detalles de transacciones antes de firmar.
            </p>
          </Section>

          {/* ── 7. Cookies y Almacenamiento Local ───────────────────── */}
          <Section
            icon={<Cookie className="w-5 h-5 text-accent-purple" />}
            title="7. Cookies y Almacenamiento Local"
          >
            <p>
              La interfaz de NomoLend no usa cookies de navegador tradicionales para rastreo o publicidad. Sin embargo, la interfaz usa localStorage del navegador para almacenar preferencias de UI no sensibles, incluyendo:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Reconocimiento de advertencia de riesgo:</span>{" "}
                Si usted ha aceptado la advertencia de divulgacion de riesgos, para que no se muestre en cada visita.
              </li>
              <li>
                <span className="text-text-secondary">Preferencias de UI:</span>{" "}
                Configuraciones de visualizacion y preferencias de interfaz para una experiencia de usuario consistente.
              </li>
              <li>
                <span className="text-text-secondary">Estado de conexion de billetera:</span>{" "}
                Informacion de conexion de billetera en cache para conveniencia al regresar a la interfaz.
              </li>
            </ul>
            <p>
              Todos los datos de localStorage se almacenan localmente en su dispositivo y nunca se transmiten a ningun servidor. Puede borrar estos datos en cualquier momento a traves de la configuracion de su navegador.
            </p>
          </Section>

          {/* ── 8. Cambios en la Politica de Privacidad ─────────────── */}
          <Section
            icon={<RefreshCw className="w-5 h-5 text-accent-purple" />}
            title="8. Cambios en la Politica de Privacidad"
          >
            <p>
              Esta Politica de Privacidad puede actualizarse periodicamente para reflejar cambios en el Protocolo, su interfaz frontend o regulaciones aplicables. La fecha de &quot;Ultima actualizacion&quot; en la parte superior de esta pagina indica cuando esta politica fue revisada por ultima vez.
            </p>
            <p>
              Los cambios significativos en las practicas de manejo de datos se comunicaran a traves de la interfaz del Protocolo. Su uso continuado del Protocolo despues de cualquier cambio en esta Politica de Privacidad constituye su aceptacion de la politica revisada.
            </p>
          </Section>

          {/* ── 9. Contacto ─────────────────────────────────────────── */}
          <Section
            icon={<MessageSquare className="w-5 h-5 text-accent-purple" />}
            title="9. Contacto"
          >
            <p>
              Si tiene preguntas o inquietudes sobre esta Politica de Privacidad o las practicas de manejo de datos, por favor comuniquese a traves de los canales oficiales:
            </p>
            <div className="rounded-lg bg-bg-secondary border border-border p-4 mt-2">
              <p className="text-text-primary font-medium text-sm">
                GitHub Issues
              </p>
              <p className="text-text-muted text-xs mt-1">
                Para consultas relacionadas con la privacidad, por favor abra un issue en el repositorio de GitHub de NomoLend con la etiqueta &quot;privacy&quot;.
              </p>
            </div>
          </Section>

          {/* ── Summary Box ─────────────────────────────────────────── */}
          <motion.section variants={itemVariants}>
            <div className="rounded-xl bg-accent-purple/10 border border-accent-purple/30 p-5 md:p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent-purple/20 border border-accent-purple/30 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-accent-purple" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-accent-purple mb-2">
                    Privacidad por Diseno
                  </h2>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    NomoLend esta construido con privacidad por diseno. Como protocolo descentralizado, no requiere registro, no recopila informacion personal y no almacena datos de usuarios en servidores centralizados. Sus interacciones son entre usted y la blockchain.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>
        </>
      ) : (
        <>
          {/* ── 1. Introduction ───────────────────────────────────────── */}
          <Section
            icon={<Info className="w-5 h-5 text-accent-purple" />}
            title="1. Introduction"
          >
            <p>
              NomoLend is a decentralized, non-custodial lending protocol deployed on
              the Base blockchain. By design, the Protocol operates with minimal data
              collection. This Privacy Policy explains what information, if any, is
              collected when you interact with the NomoLend frontend interface and
              underlying smart contracts.
            </p>
            <p>
              Because NomoLend is a decentralized protocol, there is no central entity
              that controls or stores user data in the traditional sense. The smart
              contracts operate autonomously on the blockchain, and the frontend
              interface is a convenience layer for interacting with those contracts.
            </p>
          </Section>

          {/* ── 2. Information Collection ─────────────────────────────── */}
          <Section
            icon={<Database className="w-5 h-5 text-accent-purple" />}
            title="2. Information Collection"
          >
            <p>
              The NomoLend protocol smart contracts do not collect, store, or process
              any personal information. Smart contracts only record transaction data
              (wallet addresses, amounts, token types) as part of on-chain state, which
              is inherent to how blockchains operate.
            </p>
            <p>
              The NomoLend frontend interface may collect limited, non-personally
              identifiable analytics data to improve the user experience, including:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Page views and navigation patterns</span>{" "}
                to understand which features are most used.
              </li>
              <li>
                <span className="text-text-secondary">Error logs</span> to identify and
                resolve bugs in the frontend interface.
              </li>
              <li>
                <span className="text-text-secondary">Device type and browser information</span>{" "}
                (aggregated, non-identifying) for compatibility improvements.
              </li>
            </ul>
            <p>
              No names, email addresses, phone numbers, or other personally identifiable
              information is collected by the Protocol or its frontend.
            </p>
          </Section>

          {/* ── 3. Blockchain Transparency ────────────────────────────── */}
          <Section
            icon={<Eye className="w-5 h-5 text-accent-purple" />}
            title="3. Blockchain Transparency"
          >
            <p>
              All transactions executed through the NomoLend protocol are recorded on
              the Base blockchain, which is a public, permissionless ledger. This means
              that all lending, borrowing, repayment, and liquidation transactions are
              permanently visible to anyone.
            </p>
            <p>
              On-chain data includes wallet addresses, transaction amounts, token
              types, timestamps, and smart contract interactions. This data is publicly
              accessible and cannot be deleted, modified, or hidden. This transparency
              is a fundamental property of blockchain technology and is not within the
              control of the Protocol contributors.
            </p>
          </Section>

          {/* ── 4. Wallet Addresses ───────────────────────────────────── */}
          <Section
            icon={<Wallet className="w-5 h-5 text-accent-purple" />}
            title="4. Wallet Addresses"
          >
            <p>
              Blockchain wallet addresses are pseudonymous identifiers. While they do
              not directly reveal your real-world identity, they are publicly visible
              on the blockchain and can potentially be linked to your identity through
              various means (e.g., exchange KYC records, on-chain analysis, social
              media disclosures).
            </p>
            <p>
              NomoLend does not treat wallet addresses as private data. When you
              connect your wallet to the NomoLend frontend, your wallet address is used
              solely to facilitate your interactions with the smart contracts and to
              display relevant account information in the user interface. Your wallet
              address is not stored on any centralized server by the Protocol.
            </p>
          </Section>

          {/* ── 5. Third-Party Services ───────────────────────────────── */}
          <Section
            icon={<ExternalLink className="w-5 h-5 text-accent-purple" />}
            title="5. Third-Party Services"
          >
            <p>
              The NomoLend frontend integrates with several third-party services to
              provide its functionality. Each of these services has its own privacy
              policy and data handling practices:
            </p>
            <div className="space-y-3 mt-2">
              <div className="rounded-lg bg-bg-secondary border border-border p-4">
                <p className="text-text-primary font-medium text-sm">WalletConnect</p>
                <p className="text-text-muted text-xs mt-1">
                  Used for wallet connection. WalletConnect may collect connection
                  metadata such as wallet type and session information. Refer to the
                  WalletConnect privacy policy for details.
                </p>
              </div>
              <div className="rounded-lg bg-bg-secondary border border-border p-4">
                <p className="text-text-primary font-medium text-sm">RPC Providers</p>
                <p className="text-text-muted text-xs mt-1">
                  The frontend uses RPC providers to communicate with the Base
                  blockchain. RPC providers may log IP addresses and request data.
                  Users may configure custom RPC endpoints to mitigate this.
                </p>
              </div>
              <div className="rounded-lg bg-bg-secondary border border-border p-4">
                <p className="text-text-primary font-medium text-sm">CoinGecko</p>
                <p className="text-text-muted text-xs mt-1">
                  Used for fetching token price data and market information displayed
                  in the frontend interface. CoinGecko may log API request metadata.
                </p>
              </div>
            </div>
          </Section>

          {/* ── 6. Security ───────────────────────────────────────────── */}
          <Section
            icon={<Lock className="w-5 h-5 text-accent-purple" />}
            title="6. Security"
          >
            <p>
              The NomoLend protocol employs multiple layers of security to protect
              smart contract functionality and user funds:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Multi-signature administration:</span>{" "}
                Critical protocol functions are protected by a 2-of-3 multi-sig Safe,
                requiring multiple authorized signers for any administrative action.
              </li>
              <li>
                <span className="text-text-secondary">Role-based access control:</span>{" "}
                OpenZeppelin AccessControl is used to enforce granular permissions
                across all protocol contracts.
              </li>
              <li>
                <span className="text-text-secondary">Emergency pause:</span>{" "}
                The Protocol includes pause functionality that can halt operations in
                the event of a detected security incident.
              </li>
              <li>
                <span className="text-text-secondary">Verified contracts:</span>{" "}
                All smart contracts are verified and published on BaseScan for public
                review and transparency.
              </li>
            </ul>
            <p>
              While these measures significantly reduce risk, no system is entirely
              immune to vulnerabilities. Users should take their own security
              precautions, including using hardware wallets and verifying transaction
              details before signing.
            </p>
          </Section>

          {/* ── 7. Cookies & Local Storage ────────────────────────────── */}
          <Section
            icon={<Cookie className="w-5 h-5 text-accent-purple" />}
            title="7. Cookies and Local Storage"
          >
            <p>
              The NomoLend frontend does not use traditional browser cookies for
              tracking or advertising purposes. However, the interface uses browser
              localStorage to store non-sensitive UI preferences, including:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-text-muted">
              <li>
                <span className="text-text-secondary">Risk warning acknowledgment:</span>{" "}
                Whether you have accepted the risk disclosure warning, so it is not
                shown on every visit.
              </li>
              <li>
                <span className="text-text-secondary">UI preferences:</span>{" "}
                Display settings and interface preferences for a consistent user
                experience.
              </li>
              <li>
                <span className="text-text-secondary">Wallet connection state:</span>{" "}
                Cached wallet connection information for convenience when returning
                to the interface.
              </li>
            </ul>
            <p>
              All localStorage data is stored locally on your device and is never
              transmitted to any server. You can clear this data at any time through
              your browser settings.
            </p>
          </Section>

          {/* ── 8. Changes to Privacy Policy ──────────────────────────── */}
          <Section
            icon={<RefreshCw className="w-5 h-5 text-accent-purple" />}
            title="8. Changes to Privacy Policy"
          >
            <p>
              This Privacy Policy may be updated from time to time to reflect changes
              in the Protocol, its frontend interface, or applicable regulations. The
              &quot;Last updated&quot; date at the top of this page indicates when this
              policy was last revised.
            </p>
            <p>
              Significant changes to data handling practices will be communicated
              through the Protocol interface. Your continued use of the Protocol after
              any changes to this Privacy Policy constitutes your acceptance of the
              revised policy.
            </p>
          </Section>

          {/* ── 9. Contact ────────────────────────────────────────────── */}
          <Section
            icon={<MessageSquare className="w-5 h-5 text-accent-purple" />}
            title="9. Contact"
          >
            <p>
              If you have questions or concerns about this Privacy Policy or data
              handling practices, please reach out through the official channels:
            </p>
            <div className="rounded-lg bg-bg-secondary border border-border p-4 mt-2">
              <p className="text-text-primary font-medium text-sm">
                GitHub Issues
              </p>
              <p className="text-text-muted text-xs mt-1">
                For privacy-related inquiries, please open an issue on the NomoLend
                GitHub repository with the &quot;privacy&quot; label.
              </p>
            </div>
          </Section>

          {/* ── Summary Box ───────────────────────────────────────────── */}
          <motion.section variants={itemVariants}>
            <div className="rounded-xl bg-accent-purple/10 border border-accent-purple/30 p-5 md:p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent-purple/20 border border-accent-purple/30 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-accent-purple" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-accent-purple mb-2">
                    Privacy by Design
                  </h2>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    NomoLend is built with privacy by design. As a decentralized
                    protocol, it does not require registration, does not collect
                    personal information, and does not store user data on centralized
                    servers. Your interactions are between you and the blockchain.
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
