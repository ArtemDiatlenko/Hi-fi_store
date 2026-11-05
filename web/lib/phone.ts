// Телефоны в международном формате E.164 (+380671234567): проверка и вид для людей.
// Без "use client" — нужно и серверным страницам (заказ, админка), и формам.

import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Номер похож на настоящий для своей страны (длина и формат по правилам libphonenumber). */
export function isValidInternationalPhone(value: string): boolean {
  return parsePhoneNumberFromString(value)?.isValid() ?? false;
}

/** Номер для показа людям: «+380 67 123 4567». Некорректный или старый номер (без кода страны) — как есть. */
export function formatPhone(value: string): string {
  const parsed = value.startsWith("+") ? parsePhoneNumberFromString(value) : undefined;
  return parsed?.isValid() ? parsed.formatInternational() : value;
}
