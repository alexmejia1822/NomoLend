"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import en from "./en.json";
import es from "./es.json";

export type Locale = "en" | "es";
type Translations = typeof en;

const translations: Record<Locale, Translations> = { en, es };

type I18nContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

const STORAGE_KEY = "nomolend-locale";

function detectLocale(): Locale {
  // 1. Check localStorage
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "es") return stored;
  }
  // 2. Check browser language
  if (typeof navigator !== "undefined") {
    const lang = navigator.language?.toLowerCase() || "";
    if (lang.startsWith("es")) return "es";
  }
  // 3. Default to English
  return "en";
}

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // fallback to key
    }
  }
  return typeof current === "string" ? current : path;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(detectLocale());
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback(
    (key: string): string => {
      return getNestedValue(translations[locale] as unknown as Record<string, unknown>, key);
    },
    [locale]
  );

  // Avoid hydration mismatch: render with detected locale only after mount
  if (!mounted) {
    return (
      <I18nContext.Provider value={{ locale: "en", setLocale, t: (key) => getNestedValue(en as unknown as Record<string, unknown>, key) }}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
