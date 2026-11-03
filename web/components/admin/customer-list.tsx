"use client";

// Зарегистрированные пользователи: поиск по email или имени, постраничный вывод. Состояние — в адресной строке.
// Покупки считаются только по заказам, оформленным после входа (гостевые к аккаунту не привязаны).

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AdminPagination, listHref } from "@/components/admin/admin-pagination";
import { buttonClass, Field, LoadError, PageHeader } from "@/components/admin/ui";
import type { PagedResult } from "@/lib/api";
import type { AdminCustomerSummary } from "@/lib/admin/types";
import { useAdminQuery } from "@/lib/admin/session";
import { formatDateTime, formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";

const PAGE_SIZE = 20;

/** Отметки клиента: администратор, email не подтверждён, вход заблокирован. */
export function CustomerBadges({ customer, dict }: { customer: Pick<AdminCustomerSummary, "isAdmin" | "emailConfirmed" | "isLockedOut">; dict: Dictionary }) {
  const t = dict.admin.customers;
  const badge = "rounded px-1.5 py-0.5 text-xs font-medium";
  return (
    <span className="flex flex-wrap gap-1">
      {customer.isAdmin ? (
        <span className={`${badge} bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200`}>{t.admin}</span>
      ) : null}
      {customer.emailConfirmed ? null : (
        <span className={`${badge} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`}>{t.emailNotConfirmed}</span>
      )}
      {customer.isLockedOut ? (
        <span className={`${badge} bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300`}>{t.lockedOut}</span>
      ) : null}
    </span>
  );
}

export function CustomerList() {
  const { locale, dict } = useI18n();
  const t = dict.admin.customers;
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = localeHref(locale, "/admin/customers");

  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const apiQuery = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) {
    apiQuery.set("q", q);
  }
  const customers = useAdminQuery<PagedResult<AdminCustomerSummary>>(`/api/admin/customers?${apiQuery.toString()}`);
  const data = customers.data;
  const empty = dict.admin.common.emptyValue;

  return (
    <>
      <PageHeader title={t.title} />

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <CustomerSearch key={q} initial={q} onSearch={(value) => router.push(listHref(basePath, searchParams, { q: value, page: null }))} />
      </div>

      {customers.error ? (
        <LoadError
          message={customers.error.status === 0 ? dict.admin.common.noConnection : tpl(dict.admin.common.loadError, { status: customers.error.status })}
          onRetry={customers.reload}
        />
      ) : null}
      {data === null && !customers.error ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.admin.common.loading}</p> : null}

      {data ? (
        <div aria-busy={customers.loading} className={`flex flex-col gap-4 ${customers.loading ? "opacity-60" : ""}`}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
            {tpl(dict.admin.common.found, { count: data.totalCount })}
          </p>
          {data.items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">{t.empty}</p>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                    <tr>
                      <th scope="col" className="px-4 py-3">{t.colCustomer}</th>
                      <th scope="col" className="px-4 py-3">{t.colRegistered}</th>
                      <th scope="col" className="px-4 py-3 text-right">{t.colOrders}</th>
                      <th scope="col" className="px-4 py-3 text-right">{t.colTotal}</th>
                      <th scope="col" className="px-4 py-3">{t.colLastOrder}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {data.items.map((customer) => (
                      <tr key={customer.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                        <td className="px-4 py-3">
                          <Link href={localeHref(locale, `/admin/customer/${customer.id}`)} className="break-all font-medium underline underline-offset-2">
                            {customer.email}
                          </Link>
                          {customer.fullName ? <span className="block text-xs text-zinc-500 dark:text-zinc-400">{customer.fullName}</span> : null}
                          <span className="mt-1 block">
                            <CustomerBadges customer={customer} dict={dict} />
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {customer.registeredAt ? <time dateTime={customer.registeredAt}>{formatDateTime(customer.registeredAt, locale)}</time> : empty}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{customer.orderCount}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{formatPrice(customer.ordersTotal, locale)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {customer.lastOrderAt ? <time dateTime={customer.lastOrderAt}>{formatDateTime(customer.lastOrderAt, locale)}</time> : empty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="flex flex-col gap-3 md:hidden">
                {data.items.map((customer) => (
                  <li key={customer.id}>
                    <Link
                      href={localeHref(locale, `/admin/customer/${customer.id}`)}
                      className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-3 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
                    >
                      <span className="break-all font-medium">{customer.email}</span>
                      {customer.fullName ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{customer.fullName}</span> : null}
                      <CustomerBadges customer={customer} dict={dict} />
                      <span className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>
                          {t.colOrders}: {customer.orderCount}
                        </span>
                        <span className="text-sm font-medium text-zinc-900 tabular-nums dark:text-zinc-100">{formatPrice(customer.ordersTotal, locale)}</span>
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

function CustomerSearch({ initial, onSearch }: { initial: string; onSearch: (value: string) => void }) {
  const { dict } = useI18n();
  const t = dict.admin.customers;
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
