"use client";

import Link from "next/link";
import { useState } from "react";
import { addToCart, MAX_QUANTITY, useCart } from "@/lib/cart";

interface Props {
  productId: string;
  stock: number;
}

/** Кнопка «В корзину» на карточке товара. Количество ограничено остатком; окончательно его проверит сервер. */
export function AddToCart({ productId, stock }: Props) {
  const items = useCart();
  const [added, setAdded] = useState(false);
  const inCart = items?.find((item) => item.productId === productId)?.quantity ?? 0;
  const limit = Math.min(stock, MAX_QUANTITY);
  const canAdd = stock > 0 && inCart < limit;

  if (stock <= 0) {
    return (
      <button type="button" disabled className="w-full rounded-md bg-zinc-200 px-6 py-3 font-medium text-zinc-500 sm:w-fit dark:bg-zinc-800">
        Нет в наличии
      </button>
    );
  }

  function add() {
    addToCart(productId, 1, limit);
    setAdded(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={add}
        disabled={!canAdd}
        className="w-full rounded-md bg-zinc-900 px-6 py-3 font-medium text-white disabled:opacity-60 sm:w-fit dark:bg-zinc-100 dark:text-zinc-900"
      >
        {inCart > 0 ? "Добавить ещё" : "В корзину"}
      </button>
      <p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
        {inCart > 0 ? (
          <>
            {added ? "Добавлено. " : null}В корзине: {inCart} шт.
            {inCart >= limit ? " Это весь доступный остаток." : null}{" "}
            <Link href="/cart" className="underline">
              Перейти в корзину
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
