// Компонент без состояния и без хуков: используется и на сервере (страница подтверждения),
// и в клиентском личном кабинете. Поэтому локаль и словарь приходят пропсами, а не через
// root-params/контекст — так модуль работает в обоих деревьях.

import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatDateTime, formatPrice } from "@/lib/format";
import { tpl } from "@/lib/i18n/util";
import { type OrderDetails, type OrderStatus } from "@/lib/orders";

const statusStyles: Record<OrderStatus, string> = {
  New: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  Confirmed: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  Shipped: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  Completed: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  Cancelled: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function OrderStatusBadge({ status, dict }: { status: OrderStatus; dict: Dictionary }) {
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-sm font-medium ${statusStyles[status]}`}>
      {dict.orderStatus[status]}
    </span>
  );
}

export function OrderDetailsView({ order, locale, dict }: { order: OrderDetails; locale: Locale; dict: Dictionary }) {
  const { delivery, customer } = order;

  return (
    <div className="flex flex-col gap-8">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-zinc-500">{dict.order.number}</dt>
        <dd className="font-medium">№{order.number}</dd>
        <dt className="text-zinc-500">{dict.order.status}</dt>
        <dd>
          <OrderStatusBadge status={order.status} dict={dict} />
        </dd>
        <dt className="text-zinc-500">{dict.order.placedAt}</dt>
        <dd>
          <time dateTime={order.createdAt}>{formatDateTime(order.createdAt, locale)}</time>
        </dd>
      </dl>

      <section aria-labelledby={`order-${order.id}-items`}>
        <h2 id={`order-${order.id}-items`} className="mb-3 text-lg font-medium">
          {dict.order.itemsTitle}
        </h2>
        <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {order.items.map((item) => (
            <li key={item.productId} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3">
              <span className="min-w-0">
                <span className="font-medium">{item.name}</span>
                <span className="block text-zinc-500">
                  {tpl(dict.order.skuShort, { sku: item.sku })} · {formatPrice(item.unitPrice, locale)} × {item.quantity}
                </span>
              </span>
              <span className="font-medium">{formatPrice(item.lineTotal, locale)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between gap-4 border-t border-zinc-200 pt-3 text-base dark:border-zinc-800">
          <span className="font-medium">{dict.order.total}</span>
          <span className="font-semibold">{formatPrice(order.total, locale)}</span>
        </p>
        <p className="mt-1 text-xs text-zinc-500">{dict.common.deliveryNotIncluded}</p>
      </section>

      <div className="grid gap-8 sm:grid-cols-2">
        <section aria-labelledby={`order-${order.id}-delivery`}>
          <h2 id={`order-${order.id}-delivery`} className="mb-3 text-lg font-medium">
            {dict.order.deliveryAndPayment}
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-zinc-500">{dict.order.deliveryMethod}</dt>
              <dd>{dict.delivery[delivery.method].label}</dd>
            </div>
            {delivery.city ? (
              <div>
                <dt className="text-zinc-500">{dict.order.city}</dt>
                <dd>{delivery.city}</dd>
              </div>
            ) : null}
            {delivery.warehouse ? (
              <div>
                <dt className="text-zinc-500">{dict.order.warehouse}</dt>
                <dd>{delivery.warehouse}</dd>
              </div>
            ) : null}
            {delivery.address ? (
              <div>
                <dt className="text-zinc-500">{dict.order.address}</dt>
                <dd>{delivery.address}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-500">{dict.order.payment}</dt>
              <dd>{dict.payment[order.paymentMethod].label}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby={`order-${order.id}-customer`}>
          <h2 id={`order-${order.id}-customer`} className="mb-3 text-lg font-medium">
            {dict.order.recipient}
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-zinc-500">{dict.order.name}</dt>
              <dd>{customer.fullName}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">{dict.order.phone}</dt>
              <dd>{customer.phone}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">{dict.order.email}</dt>
              <dd className="break-all">{customer.email}</dd>
            </div>
            {order.comment ? (
              <div>
                <dt className="text-zinc-500">{dict.order.comment}</dt>
                <dd className="whitespace-pre-line">{order.comment}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>
    </div>
  );
}
