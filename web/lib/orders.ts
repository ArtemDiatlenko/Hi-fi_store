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
  /** Номер отправления (ТТН), когда заказ передан в доставку. */
  trackingNumber: string | null;
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

// Порядок вариантов доставки и оплаты в форме оформления. Подписи и подсказки берутся из словаря
// (dict.delivery / dict.payment) по значению — текст локализуется, значения остаются стабильными.
export const deliveryMethods: DeliveryMethod[] = ["NovaPoshtaWarehouse", "NovaPoshtaCourier", "Pickup"];

export const paymentMethods: PaymentMethod[] = ["CashOnDelivery", "BankTransfer"];

/** Ссылка на отслеживание Новой почты — только для 14-значной ТТН (как в письме API). */
export function novaPoshtaTrackingUrl(trackingNumber: string | null): string | null {
  return trackingNumber && /^\d{14}$/.test(trackingNumber)
    ? `https://novaposhta.ua/tracking/?cargo_number=${trackingNumber}`
    : null;
}
