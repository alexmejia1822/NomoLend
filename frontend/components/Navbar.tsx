"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import clsx from "clsx";
import { useTranslation } from "@/i18n/context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  LayoutDashboard, ArrowLeftRight, Download, Wallet,
  Shield, Settings, Bot, Menu, X, BookOpen, BarChart3,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/lend", labelKey: "nav.lend", icon: ArrowLeftRight },
  { href: "/borrow", labelKey: "nav.borrow", icon: Download },
  { href: "/my-loans", labelKey: "nav.myLoans", icon: Wallet },
  { href: "/risk", labelKey: "nav.risk", icon: Shield },
  { href: "/protocol", labelKey: "nav.protocol", icon: BookOpen },
  { href: "/analytics", labelKey: "nav.analytics", icon: BarChart3 },
];

const ADMIN_ITEMS = [
  { href: "/admin", labelKey: "nav.admin", icon: Settings },
  { href: "/admin/bots", labelKey: "nav.bots", icon: Bot },
];

const ADMIN_WALLETS = [
  "0x362D5267A61f65cb4901B163B5D94adbf147DB87", // Safe multisig
  "0x9ce3F036365DfAf608D5F98B34A5872bbe5Ee125", // Deployer
];

export default function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();
  const isAdmin = isConnected && ADMIN_WALLETS.some(w => w.toLowerCase() === address?.toLowerCase());

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg-primary/80 backdrop-blur-xl">
      <div className="max-w-[1400px] mx-auto px-3 lg:px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/logo.jpeg"
              alt="NomoLend"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="text-base font-bold text-text-primary">
              Nomo<span className="text-accent-blue">Lend</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                    active
                      ? "bg-accent-blue/10 text-accent-blue"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t(item.labelKey)}
                </Link>
              );
            })}

            {isAdmin && <div className="w-px h-5 bg-border mx-1.5" />}

            {isAdmin && ADMIN_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                    active
                      ? "bg-accent-purple/10 text-accent-purple"
                      : "text-text-muted hover:text-text-secondary hover:bg-bg-card"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            <ConnectButton
              showBalance={false}
              accountStatus="address"
              chainStatus="icon"
            />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-text-secondary hover:text-text-primary"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-border bg-bg-primary/95 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-1">
            {[...NAV_ITEMS, ...(isAdmin ? ADMIN_ITEMS : [])].map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    active
                      ? "bg-accent-blue/10 text-accent-blue"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
