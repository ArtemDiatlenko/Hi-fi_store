"use client";

// Обёртка фильтров каталога. На десктопе — обычная боковая колонка. На мобильных — кнопка
// «Фільтри», открывающая выдвижную панель (с ловушкой фокуса и Esc). До гидратации (и без JS)
// фильтры показываются как есть, поэтому формой можно пользоваться и без скриптов.

import { type ReactNode, useCallback, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useHydrated } from "@/lib/use-hydrated";

export function FiltersPanel({ children }: { children: ReactNode }) {
  const { dict } = useI18n();
  const mounted = useHydrated();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useFocusTrap(mounted && open, panelRef, close);

  // Общие классы десктопа: фильтры всегда видны боковой колонкой независимо от состояния drawer.
  const desktop =
    "lg:static lg:block lg:h-auto lg:w-auto lg:max-w-none lg:overflow-visible lg:bg-transparent lg:p-0 lg:shadow-none lg:dark:bg-transparent lg:sticky lg:top-6";

  let mobile: string;
  if (!mounted) {
    mobile = "block"; // без JS — показываем inline
  } else if (open) {
    mobile =
      "fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] overflow-y-auto bg-white p-6 shadow-xl dark:bg-zinc-950 motion-safe:transition-transform";
  } else {
    mobile = "hidden";
  }

  return (
    <>
      {mounted ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="catalog-filters"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-zinc-300 px-4 font-medium lg:hidden dark:border-zinc-700"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          {dict.catalog.filters}
        </button>
      ) : null}

      {mounted && open ? (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={close}
          className="fixed inset-0 z-40 h-full w-full cursor-default bg-black/40 lg:hidden"
        />
      ) : null}

      <div id="catalog-filters" ref={panelRef} className={`${mobile} ${desktop}`}>
        {mounted && open ? (
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <span className="text-lg font-semibold">{dict.catalog.filters}</span>
            <button
              type="button"
              onClick={close}
              aria-label={dict.catalog.closeFilters}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-700"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </>
  );
}
