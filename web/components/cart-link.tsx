"use client";

import Link from "next/link";
import { cartQuantity, useCart } from "@/lib/cart";
import { itemsWord } from "@/lib/orders";

/** Ссылка на корзину в шапке со счётчиком товаров. До гидратации счётчик не показывается. */
export function CartLink() {
  const items = useCart();
  const count = cartQuantity(items);
  const label = count > 0 ? `Корзина: ${count} ${itemsWord(count)}` : "Корзина";

  return (
    <Link href="/cart" aria-label={label} className="inline-flex items-center gap-1.5 hover:underline">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2" />
        <circle cx="9.5" cy="19.5" r="1.3" />
        <circle cx="17" cy="19.5" r="1.3" />
      </svg>
      <span>Корзина</span>
      {count > 0 ? (
        <span className="min-w-5 rounded-full bg-zinc-900 px-1.5 text-center text-xs font-semibold leading-5 text-white dark:bg-zinc-100 dark:text-zinc-900">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
