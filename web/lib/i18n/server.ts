// Серверный доступ к активной локали через next/root-params. Работает в любом серверном
// компоненте и серверной утилите без прокидывания пропсов (см. next/root-params).
// Нельзя использовать в клиентских компонентах, Server Actions и Route Handlers.

import { lang } from "next/root-params";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";
import { type Dictionary, getDictionaryFor } from "@/lib/i18n/dictionaries";

/** Активная локаль из сегмента [lang]. proxy гарантирует «uk»/«en»; иначе — локаль по умолчанию. */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  return isLocale(value) ? value : defaultLocale;
}

/** Локаль и её словарь — одним вызовом. */
export async function getI18n(): Promise<{ locale: Locale; dict: Dictionary }> {
  const locale = await getLocale();
  return { locale, dict: getDictionaryFor(locale) };
}
