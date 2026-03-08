"use client";

import { useTranslation, type Locale } from "@/i18n/context";
import clsx from "clsx";

const FLAGS: Record<Locale, { emoji: string; label: string }> = {
  en: { emoji: "🇺🇸", label: "EN" },
  es: { emoji: "🇪🇸", label: "ES" },
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-0.5 border border-border">
      {(Object.keys(FLAGS) as Locale[]).map((lang) => (
        <button
          key={lang}
          onClick={() => setLocale(lang)}
          className={clsx(
            "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200",
            locale === lang
              ? "bg-accent-blue/20 text-accent-blue"
              : "text-text-muted hover:text-text-secondary"
          )}
          title={lang === "en" ? "English" : "Español"}
        >
          <span className="text-sm">{FLAGS[lang].emoji}</span>
          <span className="hidden sm:inline">{FLAGS[lang].label}</span>
        </button>
      ))}
    </div>
  );
}
