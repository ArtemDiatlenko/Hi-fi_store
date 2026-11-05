import { defaultLocale, type Locale } from "@/lib/i18n/config";

/**
 * Адрес эндпоинта Identity с языком витрины: письмо (подтверждение email, восстановление пароля) придёт
 * на этом языке и со ссылкой на ту же версию сайта.
 */
export function authUrl(path: string, locale: Locale): string {
  return locale === defaultLocale ? path : `${path}?lang=${locale}`;
}
