import type { ProductCondition } from "@/lib/api";

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

const conditionLabels: Record<ProductCondition, string> = {
  New: "Новый",
  Used: "Б/у",
  Demo: "Демо",
};

export function conditionLabel(condition: ProductCondition): string {
  return conditionLabels[condition];
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

// Часовой пояс магазина (доставка — Новая почта). Фиксированный пояс даёт одинаковый текст
// на сервере и в браузере, без расхождений при гидратации.
const STORE_TIME_ZONE = "Europe/Kyiv";

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}
