"use client";

// Доступ к локали и словарю в клиентских компонентах. Значения приходят из серверного корневого
// макета (он знает локаль через next/root-params) и раздаются через React-контекст, поэтому
// клиентским компонентам не нужно прокидывать их пропсами.

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export interface I18nValue {
  locale: Locale;
  dict: Dictionary;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, dict, children }: I18nValue & { children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return value;
}
