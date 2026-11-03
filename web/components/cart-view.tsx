"use client";

import Image from "next/image";
import Link from "next/link";
import { type CartItem, MAX_QUANTITY, removeFromCart, setCartQuantity, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { type CartQuoteLine, itemsWord } from "@/lib/orders";
import { useCartQuote } from "@/lib/use-cart-quote";

export function CartView() {
  const items = useCart();
  const { quote, fresh, loading, error, reload } = useCartQuote(items);

  if (items === null) {
    return <p className="text-sm text-zinc-500">Загрузка корзины…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-2xl font-semibold">Корзина</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Корзина пуста.</p>
        <Link href="/catalog" className="underline">
          Перейти в каталог
        </Link>
      </div>
    );
  }

  const lines = new Map(quote?.items.map((line) => [line.productId, line]));
  const hasProblems = quote?.items.some((line) => line.status !== "Ok") ?? false;
  const canCheckout = fresh && quote !== null && quote.canCheckout;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="cart-title" className="flex flex-col gap-4">
        <h1 id="cart-title" className="text-2xl font-semibold">
          Корзина
        </h1>

        {error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <span>{error}</span>
            <button type="button" onClick={reload} className="underline">
              Повторить
            </button>
          </div>
        ) : null}

        <ul aria-busy={loading} className={`divide-y divide-zinc-200 dark:divide-zinc-800 ${loading ? "opacity-70" : ""}`}>
          {items.map((item) => (
            <CartRow key={item.productId} item={item} line={lines.get(item.productId)} />
          ))}
        </ul>
      </section>

      <aside aria-labelledby="cart-summary-title" className="flex h-fit flex-col gap-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800 lg:sticky lg:top-6">
        <h2 id="cart-summary-title" className="text-lg font-medium">
          Итого
        </h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Товаров</dt>
            <dd>{quote ? `${quote.totalQuantity} ${itemsWord(quote.totalQuantity)}` : "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 text-base">
            <dt className="font-medium">Сумма</dt>
            <dd className="font-semibold" aria-live="polite">
              {quote ? formatPrice(quote.total) : "…"}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500">Доставка в сумму заказа не входит.</p>
        {loading ? <p className="text-sm text-zinc-500">Пересчитываем цены…</p> : null}
        {hasProblems && fresh ? (
          <p className="text-sm text-red-700 dark:text-red-400">Исправьте позиции, отмеченные выше, чтобы оформить заказ.</p>
        ) : null}
        {canCheckout ? (
          <Link
            href="/checkout"
            className="rounded-md bg-zinc-900 px-4 py-3 text-center font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Оформить заказ
          </Link>
        ) : (
          <span aria-disabled="true" className="cursor-not-allowed rounded-md bg-zinc-300 px-4 py-3 text-center font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            Оформить заказ
          </span>
        )}
      </aside>
    </div>
  );
}

function CartRow({ item, line }: { item: CartItem; line: CartQuoteLine | undefined }) {
  const name = line?.name ?? "Товар";
  const unavailable = line?.status === "Unavailable";
  const maxQuantity = line && !unavailable ? Math.max(1, Math.min(line.availableStock, MAX_QUANTITY)) : MAX_QUANTITY;
  const inputId = `qty-${item.productId}`;
  const problemId = `problem-${item.productId}`;
  // Сумма строки — из расчёта сервера, если он уже учёл текущее количество.
  const lineTotal =
    line && line.unitPrice !== null
      ? line.quantity === item.quantity
        ? line.lineTotal
        : line.unitPrice * item.quantity
      : null;

  return (
    <li className="flex gap-4 py-4">
      <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
        {line?.imageUrl ? <Image src={line.imageUrl} alt="" fill sizes="96px" className="object-cover" /> : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            {line?.slug ? (
              <Link href={`/products/${line.slug}`} className="font-medium hover:underline">
                {name}
              </Link>
            ) : (
              <span className="font-medium">{unavailable ? "Товар недоступен" : line ? name : "Загрузка…"}</span>
            )}
            {line?.unitPrice != null ? (
              <p className="text-sm text-zinc-500">{formatPrice(line.unitPrice)} за шт.</p>
            ) : null}
          </div>
          <p className="font-semibold">{lineTotal !== null ? formatPrice(lineTotal) : null}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!unavailable ? (
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setCartQuantity(item.productId, item.quantity - 1)}
                disabled={item.quantity <= 1}
                aria-label={`Уменьшить количество: ${name}`}
                className="h-9 w-9 rounded-l-md border border-zinc-300 disabled:opacity-40 dark:border-zinc-700"
              >
                −
              </button>
              <label htmlFor={inputId} className="sr-only">
                Количество: {name}
              </label>
              <input
                id={inputId}
                type="number"
                inputMode="numeric"
                min={1}
                max={maxQuantity}
                value={item.quantity}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isInteger(value) && value >= 1) {
                    setCartQuantity(item.productId, Math.min(value, MAX_QUANTITY));
                  }
                }}
                aria-describedby={line && line.status !== "Ok" ? problemId : undefined}
                aria-invalid={line?.status === "InsufficientStock" ? true : undefined}
                className="h-9 w-14 border-y border-zinc-300 text-center dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={() => setCartQuantity(item.productId, item.quantity + 1)}
                disabled={item.quantity >= maxQuantity}
                aria-label={`Увеличить количество: ${name}`}
                className="h-9 w-9 rounded-r-md border border-zinc-300 disabled:opacity-40 dark:border-zinc-700"
              >
                +
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => removeFromCart(item.productId)}
            aria-label={`Удалить из корзины: ${name}`}
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            Удалить
          </button>
        </div>

        {line && line.status !== "Ok" ? (
          <p id={problemId} className="text-sm text-red-700 dark:text-red-400">
            {unavailable ? (
              "Товар больше не продаётся — удалите его из корзины."
            ) : line.availableStock > 0 ? (
              <>
                В наличии только {line.availableStock} шт.{" "}
                <button
                  type="button"
                  onClick={() => setCartQuantity(item.productId, line.availableStock)}
                  className="underline"
                >
                  Оставить {line.availableStock}
                </button>
              </>
            ) : (
              "Товар закончился — удалите его из корзины."
            )}
          </p>
        ) : null}
      </div>
    </li>
  );
}
