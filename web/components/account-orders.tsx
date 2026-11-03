"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { OrderDetailsView, OrderStatusBadge } from "@/components/order-details";
import { clearToken, readToken } from "@/lib/auth";
import { authHeaders } from "@/lib/client-api";
import { formatDateTime, formatPrice } from "@/lib/format";
import { itemsWord, type OrderDetails, type OrderSummary } from "@/lib/orders";
import type { PagedResult } from "@/lib/api";

type Load<T> =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "not-found" }
  | { status: "error"; message: string }
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
      return { status: "error", message: `Не удалось загрузить данные (${response.status}).` };
    }
    return { status: "ready", data: (await response.json()) as T };
  } catch {
    return { status: "error", message: "Нет связи с сервером." };
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

function Anonymous() {
  return (
    <p className="text-sm">
      Войдите, чтобы увидеть свои заказы.{" "}
      <Link href="/login" className="underline">
        Войти
      </Link>
    </p>
  );
}

const PAGE_SIZE = 10;

export function AccountOrderList() {
  const [page, setPage] = useState(1);
  const state = useAuthorizedJson<PagedResult<OrderSummary>>(`/api/account/orders?page=${page}&pageSize=${PAGE_SIZE}`);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Мои заказы</h1>
        <Link href="/account" className="text-sm underline">
          Профиль
        </Link>
      </div>

      {state.status === "loading" ? <p className="text-sm text-zinc-500">Загрузка…</p> : null}
      {state.status === "anonymous" ? <Anonymous /> : null}
      {state.status === "error" || state.status === "not-found" ? (
        <p role="alert" className="text-sm text-red-600">
          {state.status === "error" ? state.message : "Заказы не найдены."}
        </p>
      ) : null}

      {state.status === "ready" ? (
        state.data.totalCount === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            Заказов пока нет.{" "}
            <Link href="/catalog" className="underline">
              Перейти в каталог
            </Link>
          </p>
        ) : (
          <>
            <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {state.data.items.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">Заказ №{order.number}</span>
                      <span className="text-sm text-zinc-500">
                        <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time> · {order.itemCount}{" "}
                        {itemsWord(order.itemCount)}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <OrderStatusBadge status={order.status} />
                      <span className="font-semibold">{formatPrice(order.total)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {state.data.totalPages > 1 ? (
              <nav aria-label="Страницы заказов" className="flex items-center justify-center gap-4 text-sm">
                <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} className="underline disabled:text-zinc-400 disabled:no-underline">
                  Назад
                </button>
                <span>
                  Страница {state.data.page} из {state.data.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= state.data.totalPages}
                  className="underline disabled:text-zinc-400 disabled:no-underline"
                >
                  Вперёд
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
  const { id } = use(params);
  const state = useAuthorizedJson<OrderDetails>(`/api/account/orders/${encodeURIComponent(id)}`);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/account/orders" className="w-fit text-sm underline">
        ← Все заказы
      </Link>

      {state.status === "loading" ? <p className="text-sm text-zinc-500">Загрузка…</p> : null}
      {state.status === "anonymous" ? <Anonymous /> : null}
      {state.status === "not-found" ? <h1 className="text-2xl font-semibold">Заказ не найден</h1> : null}
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      ) : null}

      {state.status === "ready" ? (
        <>
          <h1 className="text-2xl font-semibold">Заказ №{state.data.number}</h1>
          <OrderDetailsView order={state.data} />
        </>
      ) : null}
    </div>
  );
}
