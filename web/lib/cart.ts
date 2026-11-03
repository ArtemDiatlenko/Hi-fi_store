// Корзина живёт только в браузере (localStorage) и хранит лишь id товаров и количество.
// Названия, цены и наличие всегда берутся из API (POST /api/cart/quote), поэтому устаревшая
// цена в корзине невозможна. Модуль используется только из Client Components.

import { useSyncExternalStore } from "react";

export interface CartItem {
  productId: string;
  quantity: number;
}

export const CART_STORAGE_KEY = "hifistore.cart";

/** Совпадает с CheckoutValidator.MaxQuantity на сервере. */
export const MAX_QUANTITY = 99;

/** Совпадает с CheckoutValidator.MaxLines на сервере. */
export const MAX_LINES = 50;

const EMPTY: CartItem[] = [];
const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedItems: CartItem[] = EMPTY;
// Если localStorage недоступен (приватный режим, переполнение), корзина живёт в памяти до перезагрузки.
let memoryOnly = false;

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === "string" &&
    item.productId.length > 0 &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1
  );
}

function parse(raw: string | null): CartItem[] {
  if (!raw) {
    return EMPTY;
  }
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return EMPTY;
    }
    return data
      .filter(isCartItem)
      .slice(0, MAX_LINES)
      .map((item) => ({ productId: item.productId, quantity: Math.min(item.quantity, MAX_QUANTITY) }));
  } catch {
    return EMPTY;
  }
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): CartItem[] {
  if (memoryOnly) {
    return cachedItems;
  }
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedItems = parse(raw);
  }
  return cachedItems;
}

function getServerSnapshot(): null {
  return null;
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function write(items: CartItem[]) {
  const raw = JSON.stringify(items);
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CART_STORAGE_KEY, raw);
    }
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  cachedRaw = items.length === 0 ? null : raw;
  cachedItems = items.length === 0 ? EMPTY : items;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Изменения из других вкладок.
  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_STORAGE_KEY || event.key === null) {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Текущая корзина. На сервере и во время гидратации — <c>null</c> (содержимое ещё неизвестно),
 * после гидратации — массив строк.
 */
export function useCart(): CartItem[] | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function cartQuantity(items: CartItem[] | null): number {
  return items ? items.reduce((sum, item) => sum + item.quantity, 0) : 0;
}

/** Добавляет товар; <c>limit</c> — сколько всего можно положить (например, остаток на складе). */
export function addToCart(productId: string, quantity = 1, limit = MAX_QUANTITY): void {
  const items = getSnapshot();
  const cap = Math.max(0, Math.min(limit, MAX_QUANTITY));
  const existing = items.find((item) => item.productId === productId);
  if (existing) {
    const next = Math.min(existing.quantity + quantity, cap);
    write(items.map((item) => (item.productId === productId ? { ...item, quantity: Math.max(next, 1) } : item)));
    return;
  }
  if (cap < 1 || items.length >= MAX_LINES) {
    return;
  }
  write([...items, { productId, quantity: Math.min(quantity, cap) }]);
}

export function setCartQuantity(productId: string, quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return;
  }
  const next = Math.min(quantity, MAX_QUANTITY);
  write(getSnapshot().map((item) => (item.productId === productId ? { ...item, quantity: next } : item)));
}

export function removeFromCart(productId: string): void {
  write(getSnapshot().filter((item) => item.productId !== productId));
}

export function clearCart(): void {
  write([]);
}
