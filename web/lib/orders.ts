// Типы и подписи для корзины и заказов (см. api/src/HiFiStore.Infrastructure/Orders/OrderDtos.cs).

export type OrderStatus = "New" | "Confirmed" | "Shipped" | "Completed" | "Cancelled";
export type DeliveryMethod = "NovaPoshtaWarehouse" | "NovaPoshtaCourier" | "Pickup";
export type PaymentMethod = "CashOnDelivery" | "BankTransfer";
export type CartLineStatus = "Ok" | "InsufficientStock" | "Unavailable";

export interface CartQuoteLine {
  productId: string;
  sku: string | null;
  name: string | null;
  slug: string | null;
  imageUrl: string | null;
  unitPrice: number | null;
  oldPrice: number | null;
  quantity: number;
  lineTotal: number;
  availableStock: number;
  status: CartLineStatus;
}

export interface CartQuote {
  items: CartQuoteLine[];
  totalQuantity: number;
  total: number;
  canCheckout: boolean;
}

export interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderDetails {
  id: string;
  number: number;
  status: OrderStatus;
  customer: { fullName: string; phone: string; email: string };
  delivery: {
    method: DeliveryMethod;
    city: string | null;
    cityRef: string | null;
    warehouse: string | null;
    warehouseRef: string | null;
    address: string | null;
  };
  paymentMethod: PaymentMethod;
  comment: string | null;
  items: OrderItem[];
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderSummary {
  id: string;
  number: number;
  status: OrderStatus;
  itemCount: number;
  total: number;
  createdAt: string;
}

export interface CheckoutResponse {
  token: string;
  order: OrderDetails;
}

export interface StockShortage {
  productId: string;
  name: string;
  requested: number;
  available: number;
}

const statusLabels: Record<OrderStatus, string> = {
  New: "Новый",
  Confirmed: "Подтверждён",
  Shipped: "Отправлен",
  Completed: "Выполнен",
  Cancelled: "Отменён",
};

export const deliveryOptions: { value: DeliveryMethod; label: string; hint: string }[] = [
  { value: "NovaPoshtaWarehouse", label: "Новая почта — отделение или почтомат", hint: "Нужны город и номер отделения." },
  { value: "NovaPoshtaCourier", label: "Новая почта — курьер", hint: "Доставка по адресу." },
  { value: "Pickup", label: "Самовывоз из магазина", hint: "Менеджер сообщит адрес и время." },
];

export const paymentOptions: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: "CashOnDelivery", label: "Оплата при получении", hint: "Наложенный платёж или оплата при самовывозе." },
  { value: "BankTransfer", label: "Безналичный расчёт", hint: "Пришлём счёт после подтверждения заказа." },
];

export function statusLabel(status: OrderStatus): string {
  return statusLabels[status] ?? status;
}

export function deliveryLabel(method: DeliveryMethod): string {
  return deliveryOptions.find((option) => option.value === method)?.label ?? method;
}

export function paymentLabel(method: PaymentMethod): string {
  return paymentOptions.find((option) => option.value === method)?.label ?? method;
}

/** Склонение «товар/товара/товаров». */
export function itemsWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return "товар";
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "товара";
  }
  return "товаров";
}
