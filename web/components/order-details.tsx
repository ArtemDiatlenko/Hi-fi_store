import { formatDateTime, formatPrice } from "@/lib/format";
import { deliveryLabel, type OrderDetails, type OrderStatus, paymentLabel, statusLabel } from "@/lib/orders";

// Компонент без состояния: используется и на сервере (страница подтверждения), и в клиентском личном кабинете.

const statusStyles: Record<OrderStatus, string> = {
  New: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  Confirmed: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  Shipped: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  Completed: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  Cancelled: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-sm font-medium ${statusStyles[status]}`}>
      {statusLabel(status)}
    </span>
  );
}

export function OrderDetailsView({ order }: { order: OrderDetails }) {
  const { delivery, customer } = order;

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-zinc-500">Номер заказа</dt>
        <dd className="font-medium">№{order.number}</dd>
        <dt className="text-zinc-500">Статус</dt>
        <dd>
          <OrderStatusBadge status={order.status} />
        </dd>
        <dt className="text-zinc-500">Оформлен</dt>
        <dd>
          <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
        </dd>
      </dl>

      <section aria-labelledby={`order-${order.id}-items`}>
        <h2 id={`order-${order.id}-items`} className="mb-3 text-lg font-medium">
          Товары
        </h2>
        <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {order.items.map((item) => (
            <li key={item.productId} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3">
              <span className="min-w-0">
                <span className="font-medium">{item.name}</span>
                <span className="block text-zinc-500">
                  Арт. {item.sku} · {formatPrice(item.unitPrice)} × {item.quantity}
                </span>
              </span>
              <span className="font-medium">{formatPrice(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between gap-4 border-t border-zinc-200 pt-3 text-base dark:border-zinc-800">
          <span className="font-medium">Итого</span>
          <span className="font-semibold">{formatPrice(order.total)}</span>
        </p>
        <p className="mt-1 text-xs text-zinc-500">Доставка в сумму заказа не входит.</p>
      </section>

      <div className="grid gap-8 sm:grid-cols-2">
        <section aria-labelledby={`order-${order.id}-delivery`}>
          <h2 id={`order-${order.id}-delivery`} className="mb-3 text-lg font-medium">
            Доставка и оплата
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-zinc-500">Способ доставки</dt>
              <dd>{deliveryLabel(delivery.method)}</dd>
            </div>
            {delivery.city ? (
              <div>
                <dt className="text-zinc-500">Город</dt>
                <dd>{delivery.city}</dd>
              </div>
            ) : null}
            {delivery.warehouse ? (
              <div>
                <dt className="text-zinc-500">Отделение</dt>
                <dd>{delivery.warehouse}</dd>
              </div>
            ) : null}
            {delivery.address ? (
              <div>
                <dt className="text-zinc-500">Адрес</dt>
                <dd>{delivery.address}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-500">Оплата</dt>
              <dd>{paymentLabel(order.paymentMethod)}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby={`order-${order.id}-customer`}>
          <h2 id={`order-${order.id}-customer`} className="mb-3 text-lg font-medium">
            Получатель
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-zinc-500">Имя</dt>
              <dd>{customer.fullName}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Телефон</dt>
              <dd>{customer.phone}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Email</dt>
              <dd className="break-all">{customer.email}</dd>
            </div>
            {order.comment ? (
              <div>
                <dt className="text-zinc-500">Комментарий</dt>
                <dd className="whitespace-pre-line">{order.comment}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>
    </div>
  );
}
