"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { OrderDetailsView, OrderStatusBadge } from "@/components/order-details";
import { clearToken, readToken } from "@/lib/auth";
import { authHeaders } from "@/lib/client-api";
import { formatDateTime, formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { localeHref } from "@/lib/i18n/routing";
import { pluralWord, tpl } from "@/lib/i18n/util";
import { type OrderDetails, type OrderSummary } from "@/lib/orders";
import type { PagedResult } from "@/lib/api";

type Load<T> =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "not-found" }
  | { status: "error"; httpStatus: number | null }
  | { status: "ready"; data: T };

/** GET с bearer-токеном из localStorage. 401 — токен устарел: удаляем его. */
async function loadWithToken<T>(path: string): Promise<Load<T>> {
  const token = readToken();
  if (!token) {
    return { status: "anonymous" };
  }
  try {
    const response = await fetch(path, { headers: authHeaders(token) });
    if (response.status === 401) {
      clearToken();
      return { status: "anonymous" };
    }
    if (response.status === 404) {
      return { status: "not-found" };
    }
    if (!response.ok) {
      return { status: "error", httpStatus: response.status };
    }
    return { status: "ready", data: (await response.json()) as T };
  } catch {
    return { status: "error", httpStatus: null };
  }
}

function useAuthorizedJson<T>(path: string): Load<T> {
  const [state, setState] = useState<{ path: string; load: Load<T> } | null>(null);

  useEffect(() => {
    let active = true;
    loadWithToken<T>(path).then((load) => {
      if (active) {
        setState({ path, load });
      }
    });
    return () => {
      active = false;
    };
  }, [path]);

  return state?.path === path ? state.load : { status: "loading" };
}

function Anonymous({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <p className="text-sm">
      {dict.account.signInToSeeOrders}
      <Link href={localeHref(locale, "/login")} className="underline">
        {dict.account.login}
      </Link>
    </p>
  );
}

function errorMessage(httpStatus: number | null, dict: Dictionary): string {
  return httpStatus === null ? dict.common.noConnection : tpl(dict.account.ordersLoadError, { status: httpStatus });
}

const PAGE_SIZE = 10;

export function AccountOrderList() {
  const { locale, dict } = useI18n();
  const [page, setPage] = useState(1);
  const state = useAuthorizedJson<PagedResult<OrderSummary>>(`/api/account/orders?page=${page}&pageSize=${PAGE_SIZE}`);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[2rem] leading-tight font-light">{dict.account.ordersTitle}</h1>
        <Link href={localeHref(locale, "/account")} className="text-sm underline">
          {dict.account.profile}
        </Link>
      </div>

      {state.status === "loading" ? <p className="text-sm text-zinc-500">{dict.account.loading}</p> : null}
      {state.status === "anonymous" ? <Anonymous locale={locale} dict={dict} /> : null}
      {state.status === "error" || state.status === "not-found" ? (
        <p role="alert" className="text-sm text-red-600">
          {state.status === "error" ? errorMessage(state.httpStatus, dict) : dict.account.ordersNotFound}
        </p>
      ) : null}

      {state.status === "ready" ? (
        state.data.totalCount === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            {dict.account.noOrders}
            <Link href={localeHref(locale, "/catalog")} className="underline">
              {dict.account.goToCatalog}
            </Link>
          </p>
        ) : (
          <>
            <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {state.data.items.map((order) => (
                <li key={order.id}>
                  <Link
                    href={localeHref(locale, `/account/orders/${order.id}`)}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{tpl(dict.account.orderNumber, { number: order.number })}</span>
                      <span className="text-sm text-zinc-500">
                        <time dateTime={order.createdAt}>{formatDateTime(order.createdAt, locale)}</time> · {order.itemCount}{" "}
                        {pluralWord(locale, order.itemCount, dict.common.items)}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <OrderStatusBadge status={order.status} dict={dict} />
                      <span className="font-semibold">{formatPrice(order.total, locale)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {state.data.totalPages > 1 ? (
              <nav aria-label={dict.pagination.ordersLabel} className="flex items-center justify-center gap-4 text-sm">
                <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} className="inline-flex min-h-11 items-center underline disabled:text-zinc-400 disabled:no-underline">
                  {dict.pagination.prev}
                </button>
                <span>{tpl(dict.pagination.pageOf, { page: state.data.page, total: state.data.totalPages })}</span>
                <button
                  type="button"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= state.data.totalPages}
                  className="inline-flex min-h-11 items-center underline disabled:text-zinc-400 disabled:no-underline"
                >
                  {dict.pagination.next}
                </button>
              </nav>
            ) : null}
          </>
        )
      ) : null}
    </div>
  );
}

export function AccountOrder({ params }: { params: Promise<{ id: string }> }) {
  const { locale, dict } = useI18n();
  const { id } = use(params);
  const state = useAuthorizedJson<OrderDetails>(`/api/account/orders/${encodeURIComponent(id)}`);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href={localeHref(locale, "/account/orders")} className="w-fit text-sm underline">
        {dict.account.allOrders}
      </Link>

      {state.status === "loading" ? <p className="text-sm text-zinc-500">{dict.account.loading}</p> : null}
      {state.status === "anonymous" ? <Anonymous locale={locale} dict={dict} /> : null}
      {state.status === "not-found" ? <h1 className="text-[2rem] leading-tight font-light">{dict.account.orderNotFound}</h1> : null}
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage(state.httpStatus, dict)}
        </p>
      ) : null}

      {state.status === "ready" ? (
        <>
          <h1 className="text-[2rem] leading-tight font-light">{tpl(dict.account.orderNumber, { number: state.data.number })}</h1>
          <OrderDetailsView order={state.data} locale={locale} dict={dict} />
        </>
      ) : null}
    </div>
  );
}
