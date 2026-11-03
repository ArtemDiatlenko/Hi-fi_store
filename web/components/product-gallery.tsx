"use client";

import Image from "next/image";
import { type KeyboardEvent, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ImageIcon } from "@/components/icons";
import type { ProductImage } from "@/lib/api";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/util";

const frame = "relative aspect-4/3 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800";

/**
 * Галерея товара: большое изображение и миниатюры. Миниатюры — кнопки с aria-pressed и подписью
 * «Показати зображення N з M»; ←/→ (а также Home/End) на миниатюре переключают изображение и
 * переносят на неё фокус. Кнопки «назад/вперёд» на большом изображении — для мыши и тач-экранов.
 * Смена изображения объявляется скринридеру через aria-live. Alt — из API, иначе название товара.
 */
export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const { dict } = useI18n();
  const [index, setIndex] = useState(0);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const total = images.length;

  if (total === 0) {
    return (
      <div className={`${frame} flex items-center justify-center text-zinc-400 dark:text-zinc-500`}>
        <ImageIcon className="h-14 w-14" />
        <span className="sr-only">{dict.product.noImage}</span>
      </div>
    );
  }

  const current = images[Math.min(index, total - 1)];
  const alt = (image: ProductImage) => image.alt?.trim() || name;

  if (total === 1) {
    return (
      <div className={frame}>
        <Image src={current.url} alt={alt(current)} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" preload />
      </div>
    );
  }

  function select(next: number, focus = false) {
    const wrapped = (next + total) % total;
    setIndex(wrapped);
    if (focus) {
      thumbsRef.current?.querySelectorAll<HTMLButtonElement>("button")[wrapped]?.focus();
    }
  }

  function onThumbKeyDown(event: KeyboardEvent<HTMLButtonElement>, position: number) {
    const moves: Record<string, number> = {
      ArrowRight: position + 1,
      ArrowDown: position + 1,
      ArrowLeft: position - 1,
      ArrowUp: position - 1,
      Home: 0,
      End: total - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      select(moves[event.key], true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`${frame} group`}>
        <Image
          key={current.url}
          src={current.url}
          alt={alt(current)}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          preload={index === 0}
        />
        <button
          type="button"
          onClick={() => select(index - 1)}
          aria-label={dict.product.prevImage}
          className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-md hover:bg-white dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          <ChevronLeftIcon className="h-5 w-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => select(index + 1)}
          aria-label={dict.product.nextImage}
          className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-md hover:bg-white dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          <ChevronRightIcon className="h-5 w-5" strokeWidth={2} />
        </button>
        <p
          aria-live="polite"
          aria-atomic="true"
          className="absolute bottom-3 right-3 rounded-full bg-zinc-950/75 px-2.5 py-1 text-xs font-medium tabular-nums text-white"
        >
          <span className="sr-only">{tpl(dict.product.imageOf, { n: index + 1, total })}</span>
          <span aria-hidden="true">
            {index + 1} / {total}
          </span>
        </p>
      </div>

      <div ref={thumbsRef} role="group" aria-label={dict.product.gallery} className="grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3">
        {images.map((image, position) => {
          const active = position === index;
          return (
            <button
              key={`${image.url}-${position}`}
              type="button"
              onClick={() => select(position)}
              onKeyDown={(event) => onThumbKeyDown(event, position)}
              aria-pressed={active}
              aria-label={tpl(dict.product.showImage, { n: position + 1, total })}
              className={`relative aspect-4/3 overflow-hidden rounded-xl border-2 bg-zinc-100 transition-colors dark:bg-zinc-800 ${
                active
                  ? "border-zinc-900 dark:border-amber-400"
                  : "border-transparent opacity-80 hover:border-zinc-300 hover:opacity-100 dark:hover:border-zinc-600"
              }`}
            >
              <Image src={image.url} alt="" fill sizes="(min-width: 1024px) 10vw, 25vw" className="object-cover" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
