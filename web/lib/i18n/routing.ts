// Построение адресов с учётом локали. Украинская локаль живёт без префикса («/catalog»),
// остальные — под префиксом («/en/catalog»). Модуль без зависимостей — годится и для proxy,
// и для серверных, и для клиентских компонентов.

import { defaultLocale, type Locale, locales } from "@/lib/i18n/config";

/**
 * Убирает префикс любой известной локали из пути и возвращает «логический» путь
 * (всегда начинается с «/»). Обрабатывает и публичный путь («/en/catalog»), и внутренний
 * после rewrite в proxy («/uk/catalog»), поэтому на сервере и в браузере результат совпадает.
 */
export function stripLocalePrefix(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) {
      return "/";
    }
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
  }
  return pathname || "/";
}

/** Публичный путь для локали: по умолчанию без префикса, иначе — под «/<locale>». */
export function addLocalePrefix(path: string, locale: Locale): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) {
    return clean;
  }
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Локализованный адрес: берёт путь (с любым/без префикса) и приводит его к нужной локали. */
export function localeHref(locale: Locale, path: string): string {
  return addLocalePrefix(stripLocalePrefix(path.split("?")[0]) + queryOf(path), locale);
}

function queryOf(path: string): string {
  const index = path.indexOf("?");
  return index === -1 ? "" : path.slice(index);
}

/**
 * Тот же путь в другой локали с сохранением query-строки.
 * <c>pathname</c> — текущий путь (публичный или внутренний), <c>search</c> — «?a=b» или "".
 */
export function switchLocaleHref(pathname: string, search: string, target: Locale): string {
  const base = stripLocalePrefix(pathname);
  return addLocalePrefix(base, target) + (search && search !== "?" ? search : "");
}
