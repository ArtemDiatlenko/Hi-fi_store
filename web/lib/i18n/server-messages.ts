// ───────────────────────────────────────────────────────────────────────────────────────────
// Шов локализации серверных сообщений.
//
// Бэкенд в этой задаче менять нельзя, а он отдаёт сообщения валидации не на языке интерфейса:
//  • оформление заказа (POST /api/orders) — по-русски, с ключами по именам полей (fullName, phone…);
//  • административный API (/api/admin/...) — по-русски: ошибки по полям (price, specs.power_w,
//    images[0].url) и тексты конфликтов 409 (занятый slug, удаление используемой записи) — см. ADMIN_*;
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
//  • новое сообщение админки — в ADMIN_EXACT или ADMIN_PATTERNS (группы regex по порядку
//    получают имена из names и подставляются в перевод: names: ["slug"] → {slug});
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

// ── Административный API ──────────────────────────────────────────────────────────────────────
// Точные сообщения AdminProductService, AdminCategoryService, AdminBrandService, ValidationErrors,
// AdminControllerBase и AdminOrdersController.
const ADMIN_EXACT: Record<string, Translations> = {
  "Проверьте введённые данные.": { uk: "Перевірте введені дані.", en: "Check the entered data." },
  "Некорректное значение: проверьте тип и формат поля.": {
    uk: "Некоректне значення: перевірте тип і формат поля.",
    en: "Invalid value: check the field type and format.",
  },
  "Некорректное значение.": { uk: "Некоректне значення.", en: "Invalid value." },
  "Передайте тело запроса — JSON-объект.": {
    uk: "Передайте тіло запиту — JSON-об’єкт.",
    en: "Send the request body as a JSON object.",
  },
  "Slug может содержать только строчные латинские буквы, цифры и дефисы между ними, например «aurora-i-80».": {
    uk: "Slug може містити лише малі латинські літери, цифри та дефіси між ними, наприклад «aurora-i-80».",
    en: "The slug may contain only lowercase Latin letters, digits and hyphens between them, e.g. “aurora-i-80”.",
  },
  "Не удалось сформировать slug из названия — укажите его явно.": {
    uk: "Не вдалося сформувати slug із назви — вкажіть його явно.",
    en: "Could not generate a slug from the name — enter it explicitly.",
  },
  // Бренды.
  "Бренд не найден.": { uk: "Бренд не знайдено.", en: "Brand not found." },
  "Укажите название бренда.": { uk: "Вкажіть назву бренду.", en: "Enter the brand name." },
  // Разделы и характеристики.
  "Раздел не найден.": { uk: "Розділ не знайдено.", en: "Category not found." },
  "Характеристика не найдена.": { uk: "Характеристику не знайдено.", en: "Specification not found." },
  "Укажите название раздела.": { uk: "Вкажіть назву розділу.", en: "Enter the category name." },
  "Родительский раздел не найден.": { uk: "Батьківський розділ не знайдено.", en: "Parent category not found." },
  "Нельзя вложить раздел в самого себя или в собственный подраздел.": {
    uk: "Не можна вкласти розділ у самого себе або у власний підрозділ.",
    en: "A category cannot be placed inside itself or its own subcategory.",
  },
  "Укажите ключ характеристики.": { uk: "Вкажіть ключ характеристики.", en: "Enter the specification key." },
  "Ключ может содержать только строчные латинские буквы, цифры и подчёркивание (до 64 символов), например «power_w».": {
    uk: "Ключ може містити лише малі латинські літери, цифри та підкреслення (до 64 символів), наприклад «power_w».",
    en: "The key may contain only lowercase Latin letters, digits and underscores (up to 64 characters), e.g. “power_w”.",
  },
  "Укажите название характеристики.": { uk: "Вкажіть назву характеристики.", en: "Enter the specification name." },
  "Укажите тип значения: Text, Number или Boolean.": {
    uk: "Оберіть тип значення: текст, число або так/ні.",
    en: "Choose the value type: text, number or yes/no.",
  },
  // Товары.
  "Товар не найден.": { uk: "Товар не знайдено.", en: "Product not found." },
  "Укажите артикул.": { uk: "Вкажіть артикул.", en: "Enter the SKU." },
  "Укажите название товара.": { uk: "Вкажіть назву товару.", en: "Enter the product name." },
  "Укажите цену.": { uk: "Вкажіть ціну.", en: "Enter the price." },
  "Цена не может быть отрицательной.": { uk: "Ціна не може бути від’ємною.", en: "The price cannot be negative." },
  "Слишком большая цена.": { uk: "Завелика ціна.", en: "The price is too large." },
  "Старая цена не может быть отрицательной.": {
    uk: "Стара ціна не може бути від’ємною.",
    en: "The old price cannot be negative.",
  },
  "Старая цена должна быть больше текущей. Если скидки нет, оставьте поле пустым.": {
    uk: "Стара ціна має бути більшою за поточну. Якщо знижки немає, залиште поле порожнім.",
    en: "The old price must be greater than the current price. If there is no discount, leave it empty.",
  },
  "Остаток не может быть отрицательным.": { uk: "Залишок не може бути від’ємним.", en: "Stock cannot be negative." },
  "Допустимые значения: New, Used, Demo.": {
    uk: "Допустимі значення: новий, вживаний, демо.",
    en: "Allowed values: new, used, demo.",
  },
  "Укажите раздел.": { uk: "Оберіть розділ.", en: "Choose a category." },
  "Укажите бренд.": { uk: "Оберіть бренд.", en: "Choose a brand." },
  "Товар с таким артикулом или slug уже существует.": {
    uk: "Товар із таким артикулом або slug вже існує.",
    en: "A product with this SKU or slug already exists.",
  },
  "Передайте объект specs: ключ характеристики → значение.": {
    uk: "Передайте об’єкт specs: ключ характеристики → значення.",
    en: "Send a specs object: specification key → value.",
  },
  "Ожидается число.": { uk: "Потрібне число.", en: "A number is expected." },
  "Слишком большое число.": { uk: "Завелике число.", en: "The number is too large." },
  "Ожидается true или false.": { uk: "Потрібно «так» або «ні».", en: "Yes or no is expected." },
  "Ожидается непустая строка.": { uk: "Потрібен непорожній текст.", en: "A non-empty value is expected." },
  "Передайте список изображений; пустой список удаляет все изображения.": {
    uk: "Передайте список зображень; порожній список видаляє всі зображення.",
    en: "Send a list of images; an empty list removes all images.",
  },
  "Укажите адрес и описание изображения.": {
    uk: "Вкажіть адресу та опис зображення.",
    en: "Enter the image URL and description.",
  },
  "Укажите адрес изображения.": { uk: "Вкажіть адресу зображення.", en: "Enter the image URL." },
  "Ожидается адрес http(s) или путь от корня сайта, например /images/amp.png.": {
    uk: "Потрібна адреса http(s) або шлях від кореня сайту, наприклад /images/amp.png.",
    en: "Expected an http(s) URL or a path from the site root, e.g. /images/amp.png.",
  },
  "Ожидается идентификатор (GUID).": { uk: "Потрібен ідентифікатор (GUID).", en: "An identifier (GUID) is expected." },
  // Заказы.
  "Такой переход статуса невозможен.": {
    uk: "Такий перехід статусу неможливий.",
    en: "This status change is not possible.",
  },
};

// Русские названия статусов из OrderLabels — для подстановки в переведённые сообщения.
const ORDER_STATUS_LABELS: Record<string, Translations> = {
  Новый: { uk: "Новий", en: "New" },
  Подтверждён: { uk: "Підтверджено", en: "Confirmed" },
  Отправлен: { uk: "Відправлено", en: "Shipped" },
  Выполнен: { uk: "Виконано", en: "Completed" },
  Отменён: { uk: "Скасовано", en: "Cancelled" },
};

// Сообщения с переменными частями. Группы regex по порядку получают имена из names и подставляются
// в перевод ({name}, {slug}…); values — перевод значений групп (например, русских названий статусов).
const ADMIN_PATTERNS: {
  test: RegExp;
  names: string[];
  translations: Translations;
  values?: Record<string, Translations>;
}[] = [
  {
    test: /^Не длиннее (\d+) символов\.$/,
    names: ["n"],
    translations: { uk: "Не довше {n} символів.", en: "No longer than {n} characters." },
  },
  {
    test: /^Не больше (\d+) изображений\.$/,
    names: ["n"],
    translations: { uk: "Не більше {n} зображень.", en: "No more than {n} images." },
  },
  {
    test: /^Ожидается целое число от 1 до (\d+)\.$/,
    names: ["n"],
    translations: { uk: "Потрібне ціле число від 1 до {n}.", en: "An integer from 1 to {n} is expected." },
  },
  {
    test: /^Строка поиска — не больше (\d+) символов\.$/,
    names: ["n"],
    translations: {
      uk: "Рядок пошуку — не більше {n} символів.",
      en: "The search string must be at most {n} characters long.",
    },
  },
  {
    test: /^Неизвестный статус\. Допустимые значения: (.+)\.$/,
    names: ["values"],
    translations: { uk: "Невідомий статус. Допустимі значення: {values}.", en: "Unknown status. Allowed values: {values}." },
  },
  {
    test: /^Укажите статус: (.+)\.$/,
    names: ["values"],
    translations: { uk: "Вкажіть статус: {values}.", en: "Specify the status: {values}." },
  },
  {
    test: /^Заказ в статусе «(.+)» нельзя перевести в статус «(.+)»\.$/,
    names: ["from", "to"],
    translations: {
      uk: "Замовлення в статусі «{from}» не можна перевести в статус «{to}».",
      en: "An order with the status “{from}” cannot be moved to “{to}”.",
    },
    values: ORDER_STATUS_LABELS,
  },
  // Бренды.
  {
    test: /^Бренд со slug «(.+)» уже существует\. Укажите другой slug\.$/,
    names: ["slug"],
    translations: {
      uk: "Бренд зі slug «{slug}» вже існує. Вкажіть інший slug.",
      en: "A brand with the slug “{slug}” already exists. Enter a different slug.",
    },
  },
  {
    test: /^Нельзя удалить бренд «(.+)»: у него есть товары \((\d+)\)\. Сначала удалите эти товары или укажите у них другой бренд\.$/,
    names: ["name", "n"],
    translations: {
      uk: "Не можна видалити бренд «{name}»: у нього є товари ({n}). Спочатку видаліть ці товари або вкажіть для них інший бренд.",
      en: "Cannot delete the brand “{name}”: it has products ({n}). Delete these products or assign them another brand first.",
    },
  },
  {
    test: /^Нельзя удалить бренд «(.+)»: у него появились товары\.$/,
    names: ["name"],
    translations: {
      uk: "Не можна видалити бренд «{name}»: у нього з’явилися товари.",
      en: "Cannot delete the brand “{name}”: products have just been added to it.",
    },
  },
  // Разделы.
  {
    test: /^Раздел со slug «(.+)» уже существует\. Укажите другой slug\.$/,
    names: ["slug"],
    translations: {
      uk: "Розділ зі slug «{slug}» вже існує. Вкажіть інший slug.",
      en: "A category with the slug “{slug}” already exists. Enter a different slug.",
    },
  },
  {
    test: /^Нельзя удалить раздел «(.+)»: в нём есть подразделы \((\d+)\) и товары \((\d+)\)\. Сначала удалите или перенесите их\.$/,
    names: ["name", "children", "products"],
    translations: {
      uk: "Не можна видалити розділ «{name}»: у ньому є підрозділи ({children}) і товари ({products}). Спочатку видаліть або перенесіть їх.",
      en: "Cannot delete the category “{name}”: it has subcategories ({children}) and products ({products}). Delete or move them first.",
    },
  },
  {
    test: /^Нельзя удалить раздел «(.+)»: в нём есть подразделы \((\d+)\)\. Сначала удалите или перенесите их\.$/,
    names: ["name", "children"],
    translations: {
      uk: "Не можна видалити розділ «{name}»: у ньому є підрозділи ({children}). Спочатку видаліть або перенесіть їх.",
      en: "Cannot delete the category “{name}”: it has subcategories ({children}). Delete or move them first.",
    },
  },
  {
    test: /^Нельзя удалить раздел «(.+)»: в нём есть товары \((\d+)\)\. Сначала удалите или перенесите их\.$/,
    names: ["name", "products"],
    translations: {
      uk: "Не можна видалити розділ «{name}»: у ньому є товари ({products}). Спочатку видаліть або перенесіть їх.",
      en: "Cannot delete the category “{name}”: it has products ({products}). Delete or move them first.",
    },
  },
  {
    test: /^Нельзя удалить раздел «(.+)»: в нём появились подразделы или товары\.$/,
    names: ["name"],
    translations: {
      uk: "Не можна видалити розділ «{name}»: у ньому з’явилися підрозділи або товари.",
      en: "Cannot delete the category “{name}”: subcategories or products have just been added to it.",
    },
  },
  {
    test: /^Нельзя перенести раздел: характеристики с ключами (.+) уже есть в новом родительском разделе или выше\. Ключи в одной ветке каталога должны быть уникальны\.$/,
    names: ["keys"],
    translations: {
      uk: "Не можна перенести розділ: характеристики з ключами {keys} вже є в новому батьківському розділі або вище. Ключі в одній гілці каталогу мають бути унікальними.",
      en: "Cannot move the category: specifications with the keys {keys} already exist in the new parent category or above. Keys must be unique within a catalog branch.",
    },
  },
  {
    test: /^Нельзя перенести раздел: у его товаров заданы характеристики прежних родительских разделов \((.+)\)\. Сначала удалите эти значения у товаров\.$/,
    names: ["keys"],
    translations: {
      uk: "Не можна перенести розділ: у його товарів задано характеристики колишніх батьківських розділів ({keys}). Спочатку видаліть ці значення в товарів.",
      en: "Cannot move the category: its products have values for specifications of former parent categories ({keys}). Remove these values from the products first.",
    },
  },
  // Характеристики разделов.
  {
    test: /^Нельзя изменить тип характеристики «(.+)»: значения уже заданы у товаров \((\d+)\)\. Сначала удалите эти значения\.$/,
    names: ["name", "n"],
    translations: {
      uk: "Не можна змінити тип характеристики «{name}»: значення вже задано в товарів ({n}). Спочатку видаліть ці значення.",
      en: "Cannot change the type of the specification “{name}”: products already have values for it ({n}). Remove these values first.",
    },
  },
  {
    test: /^Характеристика с ключом «(.+)» уже есть в этом разделе\.$/,
    names: ["key"],
    translations: {
      uk: "Характеристика з ключем «{key}» вже є в цьому розділі.",
      en: "A specification with the key “{key}” already exists in this category.",
    },
  },
  {
    test: /^Характеристика с ключом «(.+)» уже есть в разделе «(.+)»\. Ключи в одной ветке каталога \(раздел, его предки и подразделы\) должны быть уникальны\.$/,
    names: ["key", "category"],
    translations: {
      uk: "Характеристика з ключем «{key}» вже є в розділі «{category}». Ключі в одній гілці каталогу (розділ, його предки й підрозділи) мають бути унікальними.",
      en: "A specification with the key “{key}” already exists in the category “{category}”. Keys must be unique within a catalog branch (the category, its ancestors and subcategories).",
    },
  },
  // Товары.
  {
    test: /^Товар с артикулом «(.+)» уже существует\.$/,
    names: ["sku"],
    translations: {
      uk: "Товар з артикулом «{sku}» вже існує.",
      en: "A product with the SKU “{sku}” already exists.",
    },
  },
  {
    test: /^Товар со slug «(.+)» уже существует\. Укажите другой slug\.$/,
    names: ["slug"],
    translations: {
      uk: "Товар зі slug «{slug}» вже існує. Вкажіть інший slug.",
      en: "A product with the slug “{slug}” already exists. Enter a different slug.",
    },
  },
  {
    test: /^Нельзя удалить товар «(.+)»: на него ссылаются другие записи\. Снимите товар с публикации\.$/,
    names: ["name"],
    translations: {
      uk: "Не можна видалити товар «{name}»: на нього посилаються інші записи. Зніміть товар із публікації.",
      en: "Cannot delete the product “{name}”: other records reference it. Unpublish it instead.",
    },
  },
  {
    test: /^Характеристика «(.+)» не относится к разделу «(.+)» и его родительским разделам\.$/,
    names: ["key", "category"],
    translations: {
      uk: "Характеристика «{key}» не належить до розділу «{category}» і його батьківських розділів.",
      en: "The specification “{key}” does not belong to the category “{category}” or its parent categories.",
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
  // Неверный или просроченный код из письма (сброс пароля, подтверждение email).
  InvalidToken: {
    uk: "Посилання недійсне або застаріло. Запросіть нове.",
    en: "The link is invalid or has expired. Request a new one.",
  },
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
 * Переводит одно серверное сообщение валидации (оформление заказа, административный API)
 * на активную локаль. Неизвестный текст возвращается как есть — чтобы ничего не потерять.
 */
export function translateServerMessage(message: string, locale: Locale): string {
  const trimmed = message.trim();
  const exact = EXACT[trimmed] ?? ADMIN_EXACT[trimmed];
  if (exact) {
    return exact[locale];
  }
  for (const { test, translations } of PATTERNS) {
    const match = test.exec(trimmed);
    if (match) {
      return tpl(translations[locale], { n: match[1] });
    }
  }
  for (const { test, names, translations, values } of ADMIN_PATTERNS) {
    const match = test.exec(trimmed);
    if (match) {
      const vars: Record<string, string> = {};
      names.forEach((name, index) => {
        const value = match[index + 1] ?? "";
        vars[name] = values?.[value]?.[locale] ?? value;
      });
      return tpl(translations[locale], vars);
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
