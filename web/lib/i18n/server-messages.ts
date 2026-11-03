// ───────────────────────────────────────────────────────────────────────────────────────────
// Шов локализации серверных сообщений.
//
// Бэкенд в этой задаче менять нельзя, а он отдаёт сообщения валидации не на языке интерфейса:
//  • оформление заказа (POST /api/orders) — по-русски, с ключами по именам полей (fullName, phone…);
//  • регистрация (POST /api/auth/register) — стандартный ASP.NET Core Identity, по-английски,
//    с ключами по КОДУ ошибки Identity (PasswordTooShort, DuplicateUserName…).
//
// Здесь известные сообщения сопоставляются с активной локалью. Неизвестное сообщение НЕ теряется —
// возвращается исходный текст сервера (fallback). Так новые/непредвиденные ошибки всё равно видны.
//
// Это временный шов: правильное решение — локализация на бэкенде (отдельная задача). Когда бэкенд
// научится отдавать коды ошибок или уважать Accept-Language, этот модуль можно будет упростить.
//
// Как расширять:
//  • новое сообщение заказа — добавьте точное русское в EXACT или шаблон с числом в PATTERNS;
//  • новая ошибка Identity — добавьте её код в IDENTITY.
// ───────────────────────────────────────────────────────────────────────────────────────────

import type { Locale } from "@/lib/i18n/config";
import { tpl } from "@/lib/i18n/util";

type Translations = Record<Locale, string>;

// Точные русские сообщения CheckoutValidator → перевод. Константы валидатора (MaxLines=50,
// MaxQuantity=99 и т. д.) делают эти строки детерминированными; переменные варианты — в PATTERNS.
const EXACT: Record<string, Translations> = {
  "Корзина пуста.": { uk: "Кошик порожній.", en: "Your cart is empty." },
  "Не указан товар.": { uk: "Товар не вказано.", en: "Product not specified." },
  "Укажите имя и фамилию.": { uk: "Вкажіть ім’я та прізвище.", en: "Enter your full name." },
  "Укажите телефон.": { uk: "Вкажіть телефон.", en: "Enter your phone number." },
  "Некорректный номер телефона: нужно от 10 до 15 цифр, например +380 67 123 45 67.": {
    uk: "Некоректний номер телефону: потрібно від 10 до 15 цифр, наприклад +380 67 123 45 67.",
    en: "Invalid phone number: 10 to 15 digits are required, e.g. +380 67 123 45 67.",
  },
  "Укажите email.": { uk: "Вкажіть email.", en: "Enter your email." },
  "Некорректный email.": { uk: "Некоректний email.", en: "Invalid email." },
  "Выберите способ доставки.": { uk: "Оберіть спосіб доставки.", en: "Choose a delivery method." },
  "Выберите способ оплаты.": { uk: "Оберіть спосіб оплати.", en: "Choose a payment method." },
  "Укажите город.": { uk: "Вкажіть місто.", en: "Enter the city." },
  "Укажите отделение или почтомат Новой почты.": {
    uk: "Вкажіть відділення або поштомат Нової пошти.",
    en: "Enter the Nova Poshta branch or parcel locker.",
  },
  "Укажите адрес доставки: улицу, дом и квартиру.": {
    uk: "Вкажіть адресу доставки: вулицю, будинок і квартиру.",
    en: "Enter the delivery address: street, building and apartment.",
  },
};

// Сообщения с числом (границы из валидатора). Первая группа regex = число, подставляется в перевод.
const PATTERNS: { test: RegExp; translations: Translations }[] = [
  {
    test: /^В заказе может быть не больше (\d+) позиций\.$/,
    translations: {
      uk: "У замовленні може бути не більше {n} позицій.",
      en: "An order can have at most {n} items.",
    },
  },
  {
    test: /^Количество должно быть от 1 до (\d+)\.$/,
    translations: {
      uk: "Кількість має бути від 1 до {n}.",
      en: "Quantity must be from 1 to {n}.",
    },
  },
  {
    test: /^Имя должно содержать от 2 до (\d+) символов\.$/,
    translations: {
      uk: "Ім’я має містити від 2 до {n} символів.",
      en: "The name must be 2 to {n} characters long.",
    },
  },
  {
    test: /^Не больше (\d+) символов\.$/,
    translations: {
      uk: "Не більше {n} символів.",
      en: "No more than {n} characters.",
    },
  },
];

// Коды ошибок ASP.NET Core Identity (регистрация) → перевод. Длина пароля фиксирована (8).
const IDENTITY: Record<string, Translations> = {
  DuplicateUserName: {
    uk: "Користувач із таким email вже зареєстрований.",
    en: "A user with this email is already registered.",
  },
  DuplicateEmail: {
    uk: "Користувач із таким email вже зареєстрований.",
    en: "A user with this email is already registered.",
  },
  InvalidEmail: { uk: "Некоректний email.", en: "Invalid email." },
  InvalidUserName: { uk: "Некоректний email.", en: "Invalid email." },
  PasswordTooShort: {
    uk: "Пароль має містити щонайменше 8 символів.",
    en: "The password must be at least 8 characters long.",
  },
  PasswordRequiresDigit: {
    uk: "Пароль має містити хоча б одну цифру.",
    en: "The password must contain at least one digit.",
  },
  PasswordRequiresLower: {
    uk: "Пароль має містити хоча б одну малу літеру.",
    en: "The password must contain at least one lowercase letter.",
  },
  PasswordRequiresUpper: {
    uk: "Пароль має містити хоча б одну велику літеру.",
    en: "The password must contain at least one uppercase letter.",
  },
  PasswordRequiresNonAlphanumeric: {
    uk: "Пароль має містити хоча б один спеціальний символ.",
    en: "The password must contain at least one special character.",
  },
  PasswordRequiresUniqueChars: {
    uk: "Пароль має містити більше унікальних символів.",
    en: "The password must use more unique characters.",
  },
  PasswordMismatch: { uk: "Невірний email або пароль.", en: "Invalid email or password." },
};

/**
 * Переводит одно серверное сообщение валидации (оформление заказа) на активную локаль.
 * Неизвестный текст возвращается как есть — чтобы ничего не потерять.
 */
export function translateServerMessage(message: string, locale: Locale): string {
  const trimmed = message.trim();
  const exact = EXACT[trimmed];
  if (exact) {
    return exact[locale];
  }
  for (const { test, translations } of PATTERNS) {
    const match = test.exec(trimmed);
    if (match) {
      return tpl(translations[locale], { n: match[1] });
    }
  }
  return message;
}

/**
 * Переводит ошибку ASP.NET Core Identity по её коду (регистрация). Неизвестный код → описание
 * сервера (англ.) как fallback. <c>code</c> — ключ из errors или поле code; <c>description</c> —
 * текст сервера.
 */
export function translateIdentityError(
  code: string | undefined,
  description: string,
  locale: Locale,
): string {
  if (code && IDENTITY[code]) {
    return IDENTITY[code][locale];
  }
  return description;
}
