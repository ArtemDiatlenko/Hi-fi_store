"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";
import { addToCart, MAX_QUANTITY, useCart } from "@/lib/cart";

interface Props {
  productId: string;
  stock: number;
}

/** Кнопка «У кошик» на карточке товара. Количество ограничено остатком; окончательно его проверит сервер. */
export function AddToCart({ productId, stock }: Props) {
  const { locale, dict } = useI18n();
  const items = useCart();
  const [added, setAdded] = useState(false);
  const inCart = items?.find((item) => item.productId === productId)?.quantity ?? 0;
  const limit = Math.min(stock, MAX_QUANTITY);
  const canAdd = stock > 0 && inCart < limit;

  if (stock <= 0) {
    return (
      <button type="button" disabled className="min-h-12 w-full rounded-sm border border-zinc-800 px-6 py-3 font-medium text-zinc-500 sm:w-fit">
        {dict.product.outOfStock}
      </button>
    );
  }

  function add() {
    addToCart(productId, 1, limit);
    setAdded(true);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={add}
        disabled={!canAdd}
        className="stage-button w-full sm:w-fit sm:min-w-56"
      >
        {inCart > 0 ? dict.product.addMore : dict.product.addToCart}
      </button>
      <p role="status" aria-live="polite" className="text-sm text-zinc-400 empty:hidden motion-safe:animate-fade">
        {inCart > 0 ? (
          <>
            {added ? dict.product.added : null}
            {tpl(dict.product.inCart, { count: inCart })}
            {inCart >= limit ? ` ${dict.product.allStockInCart}` : null}{" "}
            <Link href={localeHref(locale, "/cart")} className="text-amber-400 underline underline-offset-4">
              {dict.product.goToCart}
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
