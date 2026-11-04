"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { pluralWord, tpl } from "@/lib/i18n/util";
import { type CartItem, MAX_QUANTITY, removeFromCart, setCartQuantity, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import type { CartQuoteLine } from "@/lib/orders";
import { useCartQuote } from "@/lib/use-cart-quote";

export function CartView() {
  const { locale, dict } = useI18n();
  const items = useCart();
  const { quote, fresh, loading, error, reload } = useCartQuote(items);

  if (items === null) {
    return <p className="text-sm text-zinc-500">{dict.cart.loading}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-[2rem] leading-tight font-light">{dict.cart.title}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">{dict.cart.empty}</p>
        <Link href={localeHref(locale, "/catalog")} className="underline">
          {dict.cart.goToCatalog}
        </Link>
      </div>
    );
  }

  const lines = new Map(quote?.items.map((line) => [line.productId, line]));
  const hasProblems = quote?.items.some((line) => line.status !== "Ok") ?? false;
  const canCheckout = fresh && quote !== null && quote.canCheckout;
  const totalQuantity = quote?.totalQuantity ?? 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="cart-title" className="flex flex-col gap-4">
        <h1 id="cart-title" className="text-[2rem] leading-tight font-light">
          {dict.cart.title}
        </h1>

        {error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <span>{error}</span>
            <button type="button" onClick={reload} className="underline">
              {dict.common.retry}
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
        <h2 id="cart-summary-title" className="text-2xl leading-tight font-normal">
          {dict.cart.summaryTitle}
        </h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">{dict.cart.itemsLabel}</dt>
            <dd>{quote ? `${totalQuantity} ${pluralWord(locale, totalQuantity, dict.common.items)}` : "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 text-base">
            <dt className="font-medium">{dict.cart.sum}</dt>
            <dd className="font-semibold" aria-live="polite">
              {quote ? formatPrice(quote.total, locale) : "…"}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-zinc-500">{dict.common.deliveryNotIncluded}</p>
        {loading ? <p className="text-sm text-zinc-500">{dict.cart.recalculating}</p> : null}
        {hasProblems && fresh ? (
          <p className="text-sm text-red-700 dark:text-red-400">{dict.cart.fixProblems}</p>
        ) : null}
        {canCheckout ? (
          <Link
            href={localeHref(locale, "/checkout")}
            className="stage-button w-full text-center"
          >
            {dict.cart.checkout}
          </Link>
        ) : (
          <span aria-disabled="true" className="min-h-11 cursor-not-allowed rounded-md bg-zinc-300 px-4 py-3 text-center font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {dict.cart.checkout}
          </span>
        )}
      </aside>
    </div>
  );
}

function CartRow({ item, line }: { item: CartItem; line: CartQuoteLine | undefined }) {
  const { locale, dict } = useI18n();
  const name = line?.name ?? dict.cart.productFallback;
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
              <Link href={localeHref(locale, `/products/${line.slug}`)} className="font-medium hover:underline">
                {name}
              </Link>
            ) : (
              <span className="font-medium">{unavailable ? dict.cart.productUnavailable : line ? name : dict.cart.loadingItem}</span>
            )}
            {line?.unitPrice != null ? (
              <p className="text-sm text-zinc-500">{tpl(dict.cart.perUnit, { price: formatPrice(line.unitPrice, locale) })}</p>
            ) : null}
          </div>
          <p className="font-semibold">{lineTotal !== null ? formatPrice(lineTotal, locale) : null}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!unavailable ? (
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setCartQuantity(item.productId, item.quantity - 1)}
                disabled={item.quantity <= 1}
                aria-label={tpl(dict.cart.decrease, { name })}
                className="h-11 w-11 rounded-l-md border border-zinc-300 disabled:opacity-40 dark:border-zinc-700"
              >
                −
              </button>
              <label htmlFor={inputId} className="sr-only">
                {tpl(dict.cart.quantity, { name })}
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
                className="h-11 w-14 border-y border-zinc-300 text-center dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={() => setCartQuantity(item.productId, item.quantity + 1)}
                disabled={item.quantity >= maxQuantity}
                aria-label={tpl(dict.cart.increase, { name })}
                className="h-11 w-11 rounded-r-md border border-zinc-300 disabled:opacity-40 dark:border-zinc-700"
              >
                +
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => removeFromCart(item.productId)}
            aria-label={tpl(dict.cart.removeAria, { name })}
            className="inline-flex min-h-11 items-center text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            {dict.cart.remove}
          </button>
        </div>

        {line && line.status !== "Ok" ? (
          <p id={problemId} className="text-sm text-red-700 dark:text-red-400">
            {unavailable ? (
              dict.cart.unavailableRemove
            ) : line.availableStock > 0 ? (
              <>
                {tpl(dict.cart.onlyNLeft, { count: line.availableStock })}
                <button
                  type="button"
                  onClick={() => setCartQuantity(item.productId, line.availableStock)}
                  className="underline"
                >
                  {tpl(dict.cart.keepN, { count: line.availableStock })}
                </button>
              </>
            ) : (
              dict.cart.soldOut
            )}
          </p>
        ) : null}
      </div>
    </li>
  );
}
