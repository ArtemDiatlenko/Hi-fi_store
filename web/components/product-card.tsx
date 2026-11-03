import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "@/components/icons";
import type { ProductListItem } from "@/lib/api";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";
import { formatPrice } from "@/lib/format";

/** Скидка в процентах (округлённая), если старая цена больше текущей; иначе null. */
export function discountPercent(price: number, oldPrice: number | null): number | null {
  if (oldPrice === null || oldPrice <= price || oldPrice <= 0) {
    return null;
  }
  const percent = Math.round(((oldPrice - price) / oldPrice) * 100);
  return percent > 0 ? percent : null;
}

interface Props {
  product: ProductListItem;
  locale: Locale;
  dict: Dictionary;
  /** Уровень заголовка карточки: h2 под заголовком страницы (каталог), h3 — внутри секции с h2. */
  headingLevel?: 2 | 3;
  /** Подсказка браузеру о ширине карточки в сетке. */
  sizes?: string;
}

/**
 * Карточка товара. Вся карточка кликабельна через «растянутую» ссылку на названии — одна ссылка
 * на товар (без дублей для скринридера), фокус с клавиатуры подсвечивает всю карточку.
 */
export function ProductCard({
  product,
  locale,
  dict,
  headingLevel = 2,
  sizes = "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 420px) 50vw, 100vw",
}: Props) {
  const href = localeHref(locale, `/products/${product.slug}`);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const discount = discountPercent(product.price, product.oldPrice);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-[border-color,box-shadow] duration-200 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-focus-ring hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:shadow-black/30">
      <div className="relative aspect-4/3 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt=""
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-600">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {discount !== null ? (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-zinc-950">
              <span aria-hidden="true">{tpl(dict.product.discount, { percent: discount })}</span>
              <span className="sr-only">{tpl(dict.product.discountLabel, { percent: discount })}</span>
            </span>
          ) : null}
          {product.condition !== "New" ? (
            <span className="rounded-full bg-zinc-950/80 px-2 py-0.5 text-xs font-medium text-white">
              {dict.conditions[product.condition]}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{product.brand.name}</p>
        <Heading className="text-base font-medium leading-snug">
          <Link
            href={href}
            className="rounded-sm outline-none after:absolute after:inset-0 after:content-[''] group-hover:text-accent"
          >
            {product.name}
          </Link>
        </Heading>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-3">
          <span className="text-lg font-semibold tabular-nums">{formatPrice(product.price, locale)}</span>
          {product.oldPrice !== null ? (
            <span className="text-sm text-zinc-600 tabular-nums line-through dark:text-zinc-400">
              <span className="sr-only">{dict.product.oldPrice} </span>
              {formatPrice(product.oldPrice, locale)}
            </span>
          ) : null}
        </div>
        <p
          className={`flex items-center gap-1.5 text-xs ${
            product.inStock ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${product.inStock ? "bg-emerald-600 dark:bg-emerald-400" : "bg-zinc-400"}`}
          />
          {product.inStock ? dict.product.inStockShort : dict.product.outOfStock}
        </p>
      </div>
    </article>
  );
}
