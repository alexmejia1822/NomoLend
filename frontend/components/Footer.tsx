"use client";

import { useTranslation } from "@/i18n/context";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border py-6 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-text-muted text-sm">NomoLend &copy; 2026</p>
          <div className="flex items-center gap-4 text-text-muted text-sm flex-wrap justify-center">
            <a href="https://github.com/alexmejia1822/NomoLend" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">GitHub</a>
            <span className="text-border">|</span>
            <a href="https://basescan.org/address/0x356e137F8F93716e1d92F66F9e2d4866C586d9cf" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">BaseScan</a>
            <span className="text-border">|</span>
            <a href="/terms" className="hover:text-text-secondary transition-colors">{t("footer.terms")}</a>
            <span className="text-border">|</span>
            <a href="/risk-disclosure" className="hover:text-text-secondary transition-colors">{t("footer.risk")}</a>
            <span className="text-border">|</span>
            <a href="/privacy" className="hover:text-text-secondary transition-colors">{t("footer.privacy")}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
