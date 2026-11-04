"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { cartQuantity, useCart } from "@/lib/cart";
import { pluralWord, tpl } from "@/lib/i18n/util";

/** Ссылка на корзину в шапке со счётчиком товаров. До гидратации счётчик не показывается. */
export function CartLink() {
  const { locale, dict } = useI18n();
  const items = useCart();
  const count = cartQuantity(items);
  const word = pluralWord(locale, count, dict.common.items);
  const label = count > 0 ? tpl(dict.header.cartWithCount, { count, word }) : dict.header.cart;

  return (
    <Link href={localeHref(locale, "/cart")} aria-label={label} className="inline-flex items-center gap-1.5 hover:underline">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2" />
        <circle cx="9.5" cy="19.5" r="1.3" />
        <circle cx="17" cy="19.5" r="1.3" />
      </svg>
      <span className="hidden sm:inline">{dict.header.cart}</span>
      {/* aria-live: об изменении числа товаров сообщается скринридеру */}
      <span aria-live="polite" aria-atomic="true" className="contents">
        {count > 0 ? (
          <span className="min-w-6 rounded-full bg-zinc-900 px-1.5 text-center text-xs font-semibold leading-6 text-white dark:bg-amber-400 dark:text-zinc-950 dark:shadow-[0_0_10px_rgb(255_177_92/0.5)]">
            {count}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
