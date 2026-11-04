"use client";

import Image from "next/image";
import { type KeyboardEvent, type ReactNode, useRef, useState, ViewTransition } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ImageIcon } from "@/components/icons";
import type { ProductImage } from "@/lib/api";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/util";
import { productMorphName } from "@/lib/view-transitions";

// Фото стоит на чёрной сцене: без рамки, края растворяются (виньетка), снизу — отражение.
const frame = "stage-reflect relative aspect-4/3 overflow-hidden bg-zinc-950";
// Под фото — немного «пола» для отражения. Видимая часть отражения короткая: на снимках обычно
// есть пол под аппаратом, а на настоящих фото на чёрном отражение часто уже есть в кадре.
const stageSpace = "mb-[7%]";
const imageClass = "stage-vignette object-cover motion-safe:animate-fade";

/** Общий переход с карточкой товара: фото «перелетает» из списка на страницу. */
function Morph({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <ViewTransition name={productMorphName(slug)} share="product-morph" default="none">
      <div className="absolute inset-0">{children}</div>
    </ViewTransition>
  );
}

/**
 * Галерея товара: большое изображение и миниатюры. Миниатюры — кнопки с aria-pressed и подписью
 * «Показати зображення N з M»; ←/→ (а также Home/End) на миниатюре переключают изображение и
 * переносят на неё фокус. Кнопки «назад/вперёд» на большом изображении — для мыши и тач-экранов.
 * Смена изображения объявляется скринридеру через aria-live. Alt — из API, иначе название товара.
 * Новое фото проявляется плавно; первое участвует в переходе со страницы каталога (Morph).
 */
export function ProductGallery({ images, name, slug }: { images: ProductImage[]; name: string; slug: string }) {
  const { dict } = useI18n();
  const [index, setIndex] = useState(0);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const total = images.length;

  if (total === 0) {
    return (
      <div className={`${frame} ${stageSpace} flex items-center justify-center text-zinc-600`}>
        <ImageIcon className="h-14 w-14" />
        <span className="sr-only">{dict.product.noImage}</span>
      </div>
    );
  }

  const current = images[Math.min(index, total - 1)];
  const alt = (image: ProductImage) => image.alt?.trim() || name;

  if (total === 1) {
    return (
      <div className={`${frame} ${stageSpace}`}>
        <Morph slug={slug}>
          <Image src={current.url} alt={alt(current)} fill sizes="(min-width: 1024px) 48rem, 100vw" className={imageClass} preload />
        </Morph>
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
      <div className={`group relative ${stageSpace}`}>
        <div className={frame}>
          <Morph slug={slug}>
            <Image
              key={current.url}
              src={current.url}
              alt={alt(current)}
              fill
              sizes="(min-width: 1024px) 48rem, 100vw"
              className={imageClass}
              preload={index === 0}
            />
          </Morph>
        </div>
        <button
          type="button"
          onClick={() => select(index - 1)}
          aria-label={dict.product.prevImage}
          className="absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-zinc-950/60 text-zinc-100 opacity-70 backdrop-blur transition-[opacity,color,border-color] duration-300 group-hover:opacity-100 hover:border-amber-400/60 hover:text-amber-400 focus-visible:opacity-100"
        >
          <ChevronLeftIcon className="h-5 w-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => select(index + 1)}
          aria-label={dict.product.nextImage}
          className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-zinc-950/60 text-zinc-100 opacity-70 backdrop-blur transition-[opacity,color,border-color] duration-300 group-hover:opacity-100 hover:border-amber-400/60 hover:text-amber-400 focus-visible:opacity-100"
        >
          <ChevronRightIcon className="h-5 w-5" strokeWidth={2} />
        </button>
        <p
          aria-live="polite"
          aria-atomic="true"
          className="absolute right-3 top-3 rounded-full bg-zinc-950/70 px-2.5 py-1 text-xs font-medium tabular-nums text-zinc-300 backdrop-blur"
        >
          <span className="sr-only">{tpl(dict.product.imageOf, { n: index + 1, total })}</span>
          <span aria-hidden="true">
            {index + 1} / {total}
          </span>
        </p>
      </div>

      <div ref={thumbsRef} role="group" aria-label={dict.product.gallery} className="flex flex-wrap justify-center gap-2 sm:gap-3">
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
              className={`relative aspect-4/3 w-20 overflow-hidden rounded-sm border bg-zinc-950 transition-[border-color,opacity,box-shadow] duration-300 sm:w-24 ${
                active
                  ? "border-amber-400 shadow-[0_0_14px_rgb(255_177_92/0.35)]"
                  : "border-zinc-800 opacity-60 hover:border-zinc-600 hover:opacity-100"
              }`}
            >
              <Image src={image.url} alt="" fill sizes="6rem" className="object-cover" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
