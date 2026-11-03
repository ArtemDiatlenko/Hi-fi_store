"use client";

// Огляд: счётчики из существующих списков (pageSize=1 → totalCount) и последние заказы.

import Link from "next/link";
import { OrderStatusBadge } from "@/components/order-details";
import { buttonClass, LoadError, PageHeader } from "@/components/admin/ui";
import type { PagedResult } from "@/lib/api";
import type { AdminOrderSummary } from "@/lib/admin/types";
import { useAdminQuery } from "@/lib/admin/session";
import { formatDateTime, formatNumber, formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";

interface Count {
  count: number | null;
  errorStatus: number | null;
  reload: () => void;
}

function useCount(path: string): Count {
  const query = useAdminQuery<PagedResult<unknown>>(path);
  return { count: query.data?.totalCount ?? null, errorStatus: query.error?.status ?? null, reload: query.reload };
}

function loadErrorText(status: number, dict: Dictionary): string {
  return status === 0 ? dict.admin.common.noConnection : tpl(dict.admin.common.loadError, { status });
}

interface Card {
  label: string;
  value: number | null;
  accent: string;
  detail?: string | null;
  links: { href: string; label: string; srSuffix?: string }[];
}

export function AdminDashboard() {
  const { locale, dict } = useI18n();
  const t = dict.admin.dashboard;

  const newOrders = useCount("/api/admin/orders?status=New&pageSize=1");
  const newInquiries = useCount("/api/admin/inquiries?status=New&pageSize=1");
  const confirmed = useCount("/api/admin/orders?status=Confirmed&pageSize=1");
  const shipped = useCount("/api/admin/orders?status=Shipped&pageSize=1");
  const products = useCount("/api/admin/products?pageSize=1");
  const unpublished = useCount("/api/admin/products?published=false&pageSize=1");
  const recent = useAdminQuery<PagedResult<AdminOrderSummary>>("/api/admin/orders?pageSize=5");

  const counts = [newOrders, newInquiries, confirmed, shipped, products, unpublished];
  const failedStatus = counts.find((item) => item.errorStatus !== null)?.errorStatus ?? null;
  const inProgress = confirmed.count !== null && shipped.count !== null ? confirmed.count + shipped.count : null;

  const cards: Card[] = [
    {
      label: t.newInquiries,
      value: newInquiries.count,
      accent: "border-l-emerald-500 dark:border-l-emerald-400",
      links: [{ href: "/admin/inquiries?status=New", label: t.open, srSuffix: t.newInquiries }],
    },
    {
      label: t.newOrders,
      value: newOrders.count,
      accent: "border-l-amber-500 dark:border-l-amber-400",
      links: [{ href: "/admin/orders?status=New", label: t.open, srSuffix: t.newOrders }],
    },
    {
      label: t.inProgress,
      value: inProgress,
      accent: "border-l-amber-300 dark:border-l-amber-200",
      detail:
        confirmed.count !== null && shipped.count !== null
          ? tpl(t.inProgressBreakdown, { confirmed: confirmed.count, shipped: shipped.count })
          : null,
      links: [
        { href: "/admin/orders?status=Confirmed", label: dict.orderStatus.Confirmed },
        { href: "/admin/orders?status=Shipped", label: dict.orderStatus.Shipped },
      ],
    },
    {
      label: t.totalProducts,
      value: products.count,
      accent: "border-l-zinc-900 dark:border-l-zinc-200",
      links: [{ href: "/admin/products", label: t.open, srSuffix: t.totalProducts }],
    },
    {
      label: t.unpublished,
      value: unpublished.count,
      accent: "border-l-zinc-400 dark:border-l-zinc-500",
      links: [{ href: "/admin/products?published=false", label: t.open, srSuffix: t.unpublished }],
    },
  ];

  return (
    <>
      <PageHeader title={t.title} />

      {failedStatus !== null ? (
        <LoadError message={loadErrorText(failedStatus, dict)} onRetry={() => counts.forEach((item) => item.reload())} />
      ) : null}

      <ul className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <li key={card.label} className={`flex flex-col gap-1 rounded-2xl border border-l-4 border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${card.accent}`}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{card.label}</p>
            <p className="text-3xl font-semibold tabular-nums">
              {card.value === null ? <span className="text-zinc-400">…</span> : formatNumber(card.value, locale)}
            </p>
            {card.detail ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{card.detail}</p> : null}
            <div className="mt-auto flex flex-wrap gap-x-4">
              {card.links.map((link) => (
                <Link key={link.href} href={localeHref(locale, link.href)} className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
                  {link.label}
                  {link.srSuffix ? <span className="sr-only">: {link.srSuffix}</span> : null}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <section aria-labelledby="admin-quick-actions" className="flex flex-col gap-3">
        <h2 id="admin-quick-actions" className="text-lg font-medium">
          {t.quickActions}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link href={localeHref(locale, "/admin/product/new")} className={buttonClass.primary}>
            {t.addProduct}
          </Link>
          <Link href={localeHref(locale, "/admin/category/new")} className={buttonClass.secondary}>
            {t.addCategory}
          </Link>
          <Link href={localeHref(locale, "/admin/brands")} className={buttonClass.secondary}>
            {t.addBrand}
          </Link>
        </div>
      </section>

      <section aria-labelledby="admin-recent-orders" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="admin-recent-orders" className="text-lg font-medium">
            {t.recentOrders}
          </h2>
          <Link href={localeHref(locale, "/admin/orders")} className="text-sm underline underline-offset-2">
            {t.allOrders}
          </Link>
        </div>
        {recent.error ? <LoadError message={loadErrorText(recent.error.status, dict)} onRetry={recent.reload} /> : null}
        {recent.data === null && !recent.error ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.admin.common.loading}</p> : null}
        {recent.data && recent.data.items.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.noOrders}</p> : null}
        {recent.data && recent.data.items.length > 0 ? (
          <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            {recent.data.items.map((order) => (
              <li key={order.id}>
                <Link
                  href={localeHref(locale, `/admin/order/${order.id}`)}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{tpl(dict.admin.orders.orderTitle, { number: order.number })}</span>
                    <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                      {order.customerName} · <time dateTime={order.createdAt}>{formatDateTime(order.createdAt, locale)}</time>
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <OrderStatusBadge status={order.status} dict={dict} />
                    <span className="font-semibold tabular-nums">{formatPrice(order.total, locale)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}
