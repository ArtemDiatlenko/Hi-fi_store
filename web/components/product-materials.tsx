"use client";

// Материалы мастера на странице товара: огляд з відео, підключення, догляд, питання, відгуки.
// Сейчас наполняется демо-шаблонами (lib/demo-content.ts) и помечен плашкой «Демо».
// Вкладки — по шаблону WAI-ARIA Tabs: стрелки влево/вправо, Home/End.

import Image from "next/image";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import type { DemoMaterials } from "@/lib/demo-content";
import { formatDate, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/util";

type Tab = "review" | "setup" | "care" | "faq" | "reviews";
const TABS: Tab[] = ["review", "setup", "care", "faq", "reviews"];

function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex gap-0.5 text-amber-500">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 ${star <= Math.round(rating) ? "fill-current" : "fill-zinc-300 dark:fill-zinc-700"}`}>
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
    </span>
  );
}

function VideoPlaceholder({ video }: { video: DemoMaterials["video"] }) {
  const { dict } = useI18n();
  const t = dict.product.materials;
  const [clicked, setClicked] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-900">
      {video.poster ? <Image src={video.poster} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover opacity-70" /> : null}
      <button
        type="button"
        onClick={() => setClicked(true)}
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/70 via-black/10 to-transparent text-white"
      >
        <span className="sr-only">{tpl(t.play, { title: video.title })}</span>
        <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 text-zinc-950 shadow-lg">
          <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <span aria-hidden="true" className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 text-left">
          <span className="text-sm font-medium sm:text-base">{video.title}</span>
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-xs tabular-nums">{video.duration}</span>
        </span>
      </button>
      {clicked ? (
        <p role="status" className="absolute inset-x-4 top-4 rounded-lg bg-zinc-950/85 px-3 py-2 text-sm text-white">
          {t.videoDemo}
        </p>
      ) : null}
    </div>
  );
}

export function ProductMaterials({ materials }: { materials: DemoMaterials }) {
  const { locale, dict } = useI18n();
  const t = dict.product.materials;
  const [active, setActive] = useState<Tab>("review");
  const baseId = useId();
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ review: null, setup: null, care: null, faq: null, reviews: null });
  const average = materials.reviews.reduce((sum, review) => sum + review.rating, 0) / Math.max(materials.reviews.length, 1);

  const label = (tab: Tab) => (tab === "reviews" ? tpl(t.reviews, { count: materials.reviews.length }) : t[tab]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.indexOf(active);
    const next =
      event.key === "ArrowRight" ? TABS[(index + 1) % TABS.length]
      : event.key === "ArrowLeft" ? TABS[(index - 1 + TABS.length) % TABS.length]
      : event.key === "Home" ? TABS[0]
      : event.key === "End" ? TABS[TABS.length - 1]
      : null;
    if (next) {
      event.preventDefault();
      setActive(next);
      tabRefs.current[next]?.focus();
    }
  }

  return (
    <section aria-labelledby={`${baseId}-title`} className="flex flex-col gap-5 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id={`${baseId}-title`} className="text-2xl font-semibold tracking-tight">
            {t.title}
          </h2>
          <span className="rounded-full border border-amber-500/40 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
            {t.demoBadge}
          </span>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t.demoNote} {t.contentLanguage}
        </p>
      </div>

      <div role="tablist" aria-label={t.tabsLabel} className="-mx-4 flex gap-1 overflow-x-auto border-b border-zinc-200 px-4 dark:border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab}
            ref={(element) => {
              tabRefs.current[tab] = element;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab}`}
            aria-selected={active === tab}
            aria-controls={`${baseId}-panel-${tab}`}
            tabIndex={active === tab ? 0 : -1}
            onClick={() => setActive(tab)}
            onKeyDown={onKeyDown}
            className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 text-sm font-medium ${
              active === tab
                ? "border-amber-500 text-zinc-950 dark:text-white"
                : "border-transparent text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            {label(tab)}
          </button>
        ))}
      </div>

      {TABS.map((tab) => (
        <div
          key={tab}
          role="tabpanel"
          id={`${baseId}-panel-${tab}`}
          aria-labelledby={`${baseId}-tab-${tab}`}
          hidden={active !== tab}
          tabIndex={0}
          className="outline-none"
        >
          {tab === "review" ? (
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <VideoPlaceholder video={materials.video} />
              <div className="flex flex-col gap-3">
                <h3 className="font-semibold">{t.authorReview}</h3>
                {materials.review.map((paragraph) => (
                  <p key={paragraph} className="leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "setup" ? (
            <ol className="flex max-w-3xl flex-col gap-3">
              {materials.setup.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-amber-400 dark:bg-amber-400 dark:text-zinc-950">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 leading-relaxed text-zinc-700 dark:text-zinc-300">{step}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {tab === "care" ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {materials.care.map((item) => (
                <li key={item.title} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <h3 className="mb-1 font-semibold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{item.text}</p>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "faq" ? (
            <div className="flex max-w-3xl flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {materials.faq.map((item) => (
                <details key={item.question} className="group p-4">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium">
                    {item.question}
                    <span aria-hidden="true" className="text-zinc-500 group-open:rotate-45 motion-safe:transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="mt-2 leading-relaxed text-zinc-700 dark:text-zinc-300">{item.answer}</p>
                </details>
              ))}
            </div>
          ) : null}

          {tab === "reviews" ? (
            <div className="flex flex-col gap-4">
              <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Stars rating={average} label={tpl(t.rating, { rating: formatNumber(average, locale) })} />
                {tpl(t.reviewsSummary, { rating: formatNumber(Math.round(average * 10) / 10, locale), count: materials.reviews.length })}
              </p>
              <ul className="grid gap-3 md:grid-cols-3">
                {materials.reviews.map((review) => (
                  <li key={review.text} className="flex flex-col gap-2 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                    <Stars rating={review.rating} label={tpl(t.rating, { rating: review.rating })} />
                    <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{review.text}</p>
                    <p className="mt-auto text-xs text-zinc-500 dark:text-zinc-400">
                      {review.author}, {review.city} · <time dateTime={review.date}>{formatDate(review.date, locale)}</time>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}
