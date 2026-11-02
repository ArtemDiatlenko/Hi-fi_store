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
