// Форматирование цен, чисел и дат по активной локали. Валюта задаётся в одном месте (CURRENCY),
// чтобы сменить её позже можно было здесь, а не по всему интерфейсу.

import { intlLocale, type Locale } from "@/lib/i18n/config";

/** Валюта магазина. Единственное место, где она задаётся. */
export const CURRENCY = "UAH";

// Часовой пояс магазина (доставка — Нова пошта). Фиксированный пояс даёт одинаковый текст
// на сервере и в браузере, без расхождений при гидратации.
export const STORE_TIME_ZONE = "Europe/Kyiv";

const priceFormatters: Partial<Record<Locale, Intl.NumberFormat>> = {};
const numberFormatters: Partial<Record<Locale, Intl.NumberFormat>> = {};
const dateTimeFormatters: Partial<Record<Locale, Intl.DateTimeFormat>> = {};

function priceFormatter(locale: Locale): Intl.NumberFormat {
  return (priceFormatters[locale] ??= new Intl.NumberFormat(intlLocale[locale], {
    style: "currency",
    currency: CURRENCY,
    // narrowSymbol показывает «₴» и в en-US (иначе там вывелось бы «UAH»); копеек нет.
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }));
}

function numberFormatter(locale: Locale): Intl.NumberFormat {
  return (numberFormatters[locale] ??= new Intl.NumberFormat(intlLocale[locale], {
    maximumFractionDigits: 2,
  }));
}

function dateTimeFormatter(locale: Locale): Intl.DateTimeFormat {
  return (dateTimeFormatters[locale] ??= new Intl.DateTimeFormat(intlLocale[locale], {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: STORE_TIME_ZONE,
  }));
}

/** Цена в гривнях (₴) по правилам локали, без копеек. */
export function formatPrice(value: number, locale: Locale): string {
  return priceFormatter(locale).format(value);
}

export function formatNumber(value: number, locale: Locale): string {
  return numberFormatter(locale).format(value);
}

export function formatDateTime(iso: string, locale: Locale): string {
  return dateTimeFormatter(locale).format(new Date(iso));
}

const dateFormatters: Partial<Record<Locale, Intl.DateTimeFormat>> = {};

/** Дата без времени: «12 жовтня 2026 р.». */
export function formatDate(iso: string, locale: Locale): string {
  return (dateFormatters[locale] ??= new Intl.DateTimeFormat(intlLocale[locale], {
    dateStyle: "long",
    timeZone: STORE_TIME_ZONE,
  })).format(new Date(iso));
}
