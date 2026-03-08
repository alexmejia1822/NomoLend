"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useTranslation } from "@/i18n/context";

const STORAGE_KEY = "nomolend-risk-accepted";

export function RiskWarningBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) setVisible(true);
  }, []);

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-xl bg-bg-card border border-accent-yellow/30 p-6 shadow-2xl">
        <button
          onClick={handleAccept}
          className="absolute top-3 right-3 text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent-yellow/10 border border-accent-yellow/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-accent-yellow" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">{t("riskWarning.title")}</h2>
        </div>

        <p className="text-text-secondary text-sm leading-relaxed mb-2">
          {t("riskWarning.p1")}
        </p>
        <p className="text-text-secondary text-sm leading-relaxed mb-5">
          <strong className="text-accent-yellow">{t("riskWarning.p2")}</strong>{t("riskWarning.p2suffix")}
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={handleAccept}
            className="flex-1 rounded-lg bg-accent-blue hover:bg-accent-blue/80 text-white font-semibold py-2.5 px-4 text-sm transition-colors"
          >
            {t("riskWarning.accept")}
          </button>
          <a
            href="/risk-disclosure"
            className="text-text-muted hover:text-text-secondary text-sm underline underline-offset-2 transition-colors"
          >
            {t("riskWarning.learnMore")}
          </a>
        </div>
      </div>
    </div>
  );
}
