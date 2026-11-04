import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";
import { ImageIcon } from "@/components/icons";
import type { ProductListItem } from "@/lib/api";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";
import { formatPrice } from "@/lib/format";
import { productMorphName } from "@/lib/view-transitions";

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
  /**
   * Фото «перелетает» на страницу товара при переходе (общий ViewTransition с галереей).
   * Имя перехода должно быть уникальным на странице, поэтому выключайте там, где товар
   * может встретиться дважды (например, «Знижки» рядом с «Новинками»).
   */
  morph?: boolean;
}

/**
 * Карточка товара: аппарат на чёрной сцене с отражением, при наведении за ним загорается тёплый свет.
 * Вся карточка кликабельна через «растянутую» ссылку на названии — одна ссылка на товар (без дублей
 * для скринридера), фокус с клавиатуры подсвечивает всю карточку.
 */
export function ProductCard({
  product,
  locale,
  dict,
  headingLevel = 2,
  sizes = "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 420px) 50vw, 100vw",
  morph = false,
}: Props) {
  const href = localeHref(locale, `/products/${product.slug}`);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const discount = discountPercent(product.price, product.oldPrice);

  const image = product.imageUrl ? (
    <Image
      src={product.imageUrl}
      alt=""
      fill
      sizes={sizes}
      className="stage-vignette object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.04]"
    />
  ) : (
    <div className="flex h-full items-center justify-center text-zinc-600">
      <ImageIcon className="h-10 w-10" />
    </div>
  );

  return (
    <article className="group relative isolate flex h-full flex-col rounded-sm has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-focus-ring has-[a:focus-visible]:ring-offset-8 has-[a:focus-visible]:ring-offset-zinc-950">
      {/* Под фото — короткое отражение на «полу» сцены. */}
      <div className="relative mb-[6%]">
        <div
          aria-hidden="true"
          className="absolute -inset-[12%] -z-10 bg-[radial-gradient(50%_50%_at_50%_45%,rgb(255_160_70/0.22),transparent_70%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        />
        <div className="stage-reflect-short relative aspect-4/3 overflow-hidden bg-zinc-950">
          {morph && product.imageUrl ? (
            <ViewTransition name={productMorphName(product.slug)} share="product-morph" default="none">
              <div className="absolute inset-0">{image}</div>
            </ViewTransition>
          ) : (
            image
          )}
        </div>
        <div className="absolute left-2 top-2 flex flex-wrap gap-1 sm:left-3 sm:top-3 sm:gap-1.5">
          {discount !== null ? (
            <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-zinc-950 sm:px-2 sm:text-xs">
              <span aria-hidden="true">{tpl(dict.product.discount, { percent: discount })}</span>
              <span className="sr-only">{tpl(dict.product.discountLabel, { percent: discount })}</span>
            </span>
          ) : null}
          {product.condition !== "New" ? (
            <span className="rounded-full border border-white/10 bg-zinc-950/80 px-1.5 py-0.5 text-[0.6875rem] font-medium text-zinc-200 backdrop-blur sm:px-2 sm:text-xs">
              {dict.conditions[product.condition]}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <p className="truncate text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-zinc-400 sm:text-[0.6875rem] sm:tracking-[0.2em]">{product.brand.name}</p>
        <Heading className="font-display text-lg leading-tight font-normal break-words sm:text-[1.375rem]">
          <Link
            href={href}
            className="rounded-sm outline-none transition-colors duration-300 after:absolute after:inset-0 after:content-[''] group-hover:text-amber-400"
          >
            {product.name}
          </Link>
        </Heading>
        <span aria-hidden="true" className="mt-1 h-px w-8 bg-amber-400/50 transition-[width,background-color] duration-500 group-hover:w-16 group-hover:bg-amber-400" />
        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-2 sm:pt-3">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold tabular-nums text-zinc-100 sm:text-base">{formatPrice(product.price, locale)}</span>
            {product.oldPrice !== null ? (
              <span className="text-xs text-zinc-400 tabular-nums line-through sm:text-sm">
                <span className="sr-only">{dict.product.oldPrice} </span>
                {formatPrice(product.oldPrice, locale)}
              </span>
            ) : null}
          </div>
          <p className={`flex items-center gap-1.5 text-xs ${product.inStock ? "text-emerald-400" : "text-zinc-400"}`}>
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${product.inStock ? "bg-emerald-400 shadow-[0_0_6px_rgb(52_211_153/0.8)]" : "bg-zinc-500"}`}
            />
            {product.inStock ? dict.product.inStockShort : dict.product.outOfStock}
          </p>
        </div>
      </div>
    </article>
  );
}
