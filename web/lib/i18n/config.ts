// Единственный источник правды о локалях магазина. Модуль без зависимостей от Next —
// его можно импортировать и в proxy (middleware), и в серверных, и в клиентских компонентах.

/** Поддерживаемые локали интерфейса. Украинская — по умолчанию (без префикса в адресе). */
export const locales = ["uk", "en"] as const;

export type Locale = (typeof locales)[number];

/** Локаль по умолчанию отдаётся на «/» без префикса; остальные — под своим префиксом (/en). */
export const defaultLocale: Locale = "uk";

/** BCP 47 для Intl.NumberFormat / Intl.DateTimeFormat. */
export const intlLocale: Record<Locale, string> = {
  uk: "uk-UA",
  en: "en-US",
};

/** Код для атрибута <html lang>. */
export const htmlLang: Record<Locale, string> = {
  uk: "uk",
  en: "en",
};

/** og:locale. */
export const ogLocale: Record<Locale, string> = {
  uk: "uk_UA",
  en: "en_US",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}
