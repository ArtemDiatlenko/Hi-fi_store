"use client";

// Карточка клиента: профиль, покупки, последние заказы (оформленные после входа) и действия —
// снять блокировку входа, повторно отправить письмо подтверждения email.

import Link from "next/link";
import { use, useId, useRef, useState } from "react";
import { CustomerBadges } from "@/components/admin/customer-list";
import { buttonClass, FormAlert, type FormProblem, LoadError, Notice, PageHeader } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/order-details";
import type { PagedResult } from "@/lib/api";
import { describeFailure } from "@/lib/admin/forms";
import { ADMIN_ROLE, type AdminCustomerDetails, type AdminOrderSummary } from "@/lib/admin/types";
import { useAdminQuery, useAdminRequest } from "@/lib/admin/session";
import { useAfterCommit } from "@/lib/admin/use-after-commit";
import { formatDateTime, formatNumber, formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";

const RECENT_ORDERS = 10;

export function CustomerView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { locale, dict } = useI18n();
  const t = dict.admin.customers;
  const request = useAdminRequest();
  const customer = useAdminQuery<AdminCustomerDetails>(`/api/admin/customers/${encodeURIComponent(id)}`);
  const orders = useAdminQuery<PagedResult<AdminOrderSummary>>(
    `/api/admin/orders?customerId=${encodeURIComponent(id)}&pageSize=${RECENT_ORDERS}`,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [busy, setBusy] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const afterCommit = useAfterCommit();
  const actionsId = useId();
  const statsId = useId();
  const ordersId = useId();
  const back = { href: localeHref(locale, "/admin/customers"), label: t.backToList };
  const empty = dict.admin.common.emptyValue;

  if (customer.error && !customer.data) {
    return (
      <>
        <PageHeader title={t.itemTitle} back={back} />
        <LoadError
          message={customer.error.status === 404 ? dict.admin.common.notFound : tpl(dict.admin.common.loadError, { status: customer.error.status })}
          onRetry={customer.error.status === 404 ? undefined : customer.reload}
        />
      </>
    );
  }

  if (!customer.data) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.admin.common.loading}</p>;
  }

  const data = customer.data;

  async function unlock() {
    setBusy(true);
    setNotice(null);
    setProblem(null);
    const outcome = await request<AdminCustomerDetails>(`/api/admin/customers/${data.id}/unlock`, { method: "POST" });
    setBusy(false);
    if (outcome.ok) {
      customer.setData(outcome.data);
      setNotice(t.unlocked);
    } else if (outcome.status !== 401 && outcome.status !== 403) {
      setProblem(describeFailure(outcome, locale, dict, () => null).problem);
      afterCommit(() => alertRef.current?.focus());
    }
  }

  // Публичный эндпоинт Identity: отвечает 200 всегда, письмо уходит, если такой пользователь есть.
  async function resendConfirmation() {
    setBusy(true);
    setNotice(null);
    setProblem(null);
    try {
      const response = await fetch("/api/auth/resendConfirmationEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      if (response.ok) {
        setNotice(tpl(t.resendSent, { email: data.email }));
      } else {
        setProblem({ title: tpl(dict.admin.common.genericError, { status: response.status }), messages: [] });
      }
    } catch {
      setProblem({ title: dict.admin.common.noConnection, messages: [] });
    }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title={<span className="break-all">{data.email}</span>} back={back}>
        <CustomerBadges customer={{ ...data, isAdmin: data.roles.includes(ADMIN_ROLE) }} dict={dict} />
      </PageHeader>

      <Notice message={notice} onDismiss={() => setNotice(null)} />
      <FormAlert ref={alertRef} problem={problem} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <aside className="flex flex-col gap-4 lg:order-2">
          {data.isLockedOut || !data.emailConfirmed ? (
            <section aria-labelledby={actionsId} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 id={actionsId} className="font-medium">
                {dict.admin.common.actions}
              </h2>
              {data.isLockedOut && data.lockoutEnd ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{tpl(t.lockoutUntil, { date: formatDateTime(data.lockoutEnd, locale) })}</p>
              ) : null}
              {data.isLockedOut ? (
                <button type="button" onClick={unlock} disabled={busy} className={buttonClass.primary}>
                  {t.unlock}
                </button>
              ) : null}
              {data.emailConfirmed ? null : (
                <button type="button" onClick={resendConfirmation} disabled={busy} className={buttonClass.secondary}>
                  {t.resendConfirmation}
                </button>
              )}
            </section>
          ) : null}

          <section aria-labelledby={statsId} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 id={statsId} className="font-medium">
              {t.stats}
            </h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">{t.colOrders}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{formatNumber(data.orderCount, locale)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">{t.colTotal}</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatPrice(data.ordersTotal, locale)}</dd>
              </div>
            </dl>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.totalsNote}</p>
          </section>
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 font-medium">{t.profile}</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-zinc-500 dark:text-zinc-400">{t.email}</dt>
              <dd className="break-all">
                {data.email}
                <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {data.emailConfirmed ? t.emailConfirmed : t.emailNotConfirmed}
                </span>
              </dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{t.name}</dt>
              <dd>{data.fullName ?? empty}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{t.phone}</dt>
              <dd>{data.phoneNumber ?? empty}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{t.roles}</dt>
              <dd>{data.roles.length > 0 ? data.roles.join(", ") : empty}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{t.registered}</dt>
              <dd>{data.registeredAt ? <time dateTime={data.registeredAt}>{formatDateTime(data.registeredAt, locale)}</time> : empty}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">{t.failedAttempts}</dt>
              <dd className="tabular-nums">{data.accessFailedCount}</dd>
            </dl>
          </section>

          <section aria-labelledby={ordersId} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={ordersId} className="text-lg font-medium">
                {t.ordersTitle}
              </h2>
              {orders.data && orders.data.totalCount > RECENT_ORDERS ? (
                <Link href={localeHref(locale, `/admin/orders?customerId=${data.id}`)} className="text-sm underline underline-offset-2">
                  {t.allOrders}
                </Link>
              ) : null}
            </div>
            {orders.error ? (
              <LoadError message={tpl(dict.admin.common.loadError, { status: orders.error.status })} onRetry={orders.reload} />
            ) : null}
            {orders.data === null && !orders.error ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.admin.common.loading}</p> : null}
            {orders.data && orders.data.items.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.noOrders}</p> : null}
            {orders.data && orders.data.items.length > 0 ? (
              <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                {orders.data.items.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={localeHref(locale, `/admin/order/${order.id}`)}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="font-medium">{tpl(dict.admin.orders.orderTitle, { number: order.number })}</span>
                        <time dateTime={order.createdAt} className="text-sm text-zinc-500 dark:text-zinc-400">
                          {formatDateTime(order.createdAt, locale)}
                        </time>
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
        </div>
      </div>
    </>
  );
}
