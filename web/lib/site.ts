// Базовый адрес витрины для абсолютных URL в метаданных, sitemap и robots.
// Переопределяется переменной окружения SITE_URL (например, https://hifistore.example).

export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Контакты магазина для подвала и страницы «Контакти».
 * ЗАГЛУШКА: замените телефон и email на настоящие и выставьте placeholder: false —
 * тогда пропадёт пометка «Зразок» рядом с контактами.
 */
export const STORE_CONTACTS = {
  phone: "+380 00 000 00 00",
  email: "info@example.com",
  placeholder: true,
} as const;

/** Номер для ссылки tel: — только цифры и ведущий «+». */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
