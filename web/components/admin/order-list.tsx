"use client";

// Список заказов: фильтр по статусу (вкладки-ссылки), поиск по номеру, телефону, email или имени,
// постраничный вывод. Всё состояние — в адресной строке.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AdminPagination, listHref } from "@/components/admin/admin-pagination";
import { OrderStatusBadge } from "@/components/order-details";
import { buttonClass, Field, LoadError, PageHeader } from "@/components/admin/ui";
import type { PagedResult } from "@/lib/api";
import { type AdminOrderSummary, orderStatuses } from "@/lib/admin/types";
import { useAdminQuery } from "@/lib/admin/session";
import { formatDateTime, formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";
import type { OrderStatus } from "@/lib/orders";
import { formatPhone } from "@/lib/phone";

const PAGE_SIZE = 20;

export function OrderList() {
  const { locale, dict } = useI18n();
  const t = dict.admin.orders;
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = localeHref(locale, "/admin/orders");

  const rawStatus = searchParams.get("status") ?? "";
  const status = (orderStatuses as string[]).includes(rawStatus) ? (rawStatus as OrderStatus) : null;
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const apiQuery = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (status) {
    apiQuery.set("status", status);
  }
  if (q) {
    apiQuery.set("q", q);
  }
  // ?customerId=… — заказы одного клиента (ссылка из карточки клиента); вкладки и поиск его сохраняют.
  const customerId = searchParams.get("customerId");
  if (customerId) {
    apiQuery.set("customerId", customerId);
  }
  const orders = useAdminQuery<PagedResult<AdminOrderSummary>>(`/api/admin/orders?${apiQuery.toString()}`);
  const data = orders.data;

  const tabs: { value: OrderStatus | null; label: string }[] = [
    { value: null, label: t.allStatuses },
    ...orderStatuses.map((value) => ({ value, label: dict.orderStatus[value] })),
  ];

  return (
    <>
      <PageHeader title={t.title} />

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <nav aria-label={t.statusFilter}>
          <ul className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const active = tab.value === status;
              return (
                <li key={tab.label}>
                  <Link
                    href={listHref(basePath, searchParams, { status: tab.value, page: null })}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${
                      active
                        ? "border-zinc-900 bg-zinc-900 font-medium text-white dark:border-amber-400 dark:bg-amber-400 dark:text-zinc-950"
                        : "border-zinc-300 bg-white hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <OrderSearch key={q} initial={q} onSearch={(value) => router.push(listHref(basePath, searchParams, { q: value, page: null }))} />
      </div>

      {orders.error ? (
        <LoadError
          message={orders.error.status === 0 ? dict.admin.common.noConnection : tpl(dict.admin.common.loadError, { status: orders.error.status })}
          onRetry={orders.reload}
        />
      ) : null}
      {data === null && !orders.error ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.admin.common.loading}</p> : null}

      {data ? (
        <div aria-busy={orders.loading} className={`flex flex-col gap-4 ${orders.loading ? "opacity-60" : ""}`}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
            {tpl(dict.admin.common.found, { count: data.totalCount })}
          </p>
          {data.items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:text-zinc-400 dark:border-zinc-700">{t.empty}</p>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 md:block dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        {t.colNumber}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        {t.colDate}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        {t.colCustomer}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        {t.colItems}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        {t.colTotal}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        {t.colStatus}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {data.items.map((order) => (
                      <tr key={order.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                        <td className="whitespace-nowrap px-4 py-3">
                          <Link href={localeHref(locale, `/admin/order/${order.id}`)} className="font-medium underline underline-offset-2">
                            №{order.number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          <time dateTime={order.createdAt}>{formatDateTime(order.createdAt, locale)}</time>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block">{order.customerName}</span>
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                            {formatPhone(order.customerPhone)} · <span className="break-all">{order.customerEmail}</span>
                          </span>
                          <span className="block text-xs text-zinc-500 dark:text-zinc-400">{order.isGuest ? t.guest : t.registered}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{order.itemCount}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{formatPrice(order.total, locale)}</td>
                        <td className="px-4 py-3">
                          <OrderStatusBadge status={order.status} dict={dict} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="flex flex-col gap-3 md:hidden">
                {data.items.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={localeHref(locale, `/admin/order/${order.id}`)}
                      className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">№{order.number}</span>
                        <OrderStatusBadge status={order.status} dict={dict} />
                      </span>
                      <span>{order.customerName}</span>
                      <span className="break-all text-xs text-zinc-500 dark:text-zinc-400">
                        {formatPhone(order.customerPhone)} · {order.customerEmail}
                      </span>
                      <span className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <time dateTime={order.createdAt}>{formatDateTime(order.createdAt, locale)}</time>
                        <span className="text-sm font-medium text-zinc-900 tabular-nums dark:text-zinc-100">{formatPrice(order.total, locale)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <AdminPagination page={data.page} totalPages={data.totalPages} hrefFor={(target) => listHref(basePath, searchParams, { page: String(target) })} />
        </div>
      ) : null}
    </>
  );
}

function OrderSearch({ initial, onSearch }: { initial: string; onSearch: (value: string) => void }) {
  const { dict } = useI18n();
  const t = dict.admin.orders;
  const [value, setValue] = useState(initial);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(value.trim());
  }

  return (
    <form role="search" aria-label={t.filtersLabel} onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field label={t.search} className="flex-1">
        {(control) => <input {...control} type="search" maxLength={200} value={value} onChange={(event) => setValue(event.target.value)} />}
      </Field>
      <button type="submit" className={buttonClass.primary}>
        {t.searchSubmit}
      </button>
    </form>
  );
}
