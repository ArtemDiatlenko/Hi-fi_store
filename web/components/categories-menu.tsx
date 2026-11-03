"use client";

import Link from "next/link";
import { type FocusEvent, type KeyboardEvent, use, useCallback, useEffect, useId, useRef, useState } from "react";
import { catalogTriggerClass } from "@/components/header-styles";
import { ArrowRightIcon, CategoryIcon, ChevronDownIcon } from "@/components/icons";
import type { CategoryNode } from "@/lib/api";
import { categoryPath } from "@/lib/categories";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";

/**
 * Меню разделов каталога на десктопе — паттерн «disclosure»: кнопка с aria-expanded открывает
 * панель со ссылками. Клавиатура: Enter/Space/↓ открывают (↓ — сразу с фокусом на первой ссылке),
 * ↑/↓/Home/End ходят по ссылкам, Esc закрывает и возвращает фокус на кнопку, уход фокуса или клик
 * мимо — закрывают. Панель всегда в DOM (атрибут hidden), поэтому ссылки разделов видны поисковикам.
 * Если разделы не загрузились, остаётся обычная ссылка на каталог.
 */
export function CategoriesMenu({ categories }: { categories: Promise<CategoryNode[]> }) {
  const tree = use(categories);
  const { locale, dict } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusFirstOnOpen = useRef(false);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  const links = useCallback(
    () => Array.from(panelRef.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? []),
    [],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    if (focusFirstOnOpen.current) {
      focusFirstOnOpen.current = false;
      links()[0]?.focus();
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, links]);

  if (tree.length === 0) {
    return (
      <Link href={localeHref(locale, "/catalog")} className={catalogTriggerClass}>
        {dict.header.catalog}
      </Link>
    );
  }

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (open && next && !wrapperRef.current?.contains(next)) {
      setOpen(false);
    }
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (open) {
        links()[0]?.focus();
      } else {
        focusFirstOnOpen.current = true;
        setOpen(true);
      }
    }
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = links();
    const index = items.indexOf(document.activeElement as HTMLAnchorElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") {
      next = index < 0 ? 0 : (index + 1) % items.length;
    } else if (event.key === "ArrowUp") {
      next = index <= 0 ? items.length - 1 : index - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = items.length - 1;
    }
    if (next !== null) {
      event.preventDefault();
      items[next]?.focus();
    }
  }

  return (
    <div ref={wrapperRef} className="relative" onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onButtonKeyDown}
        className={`${catalogTriggerClass} aria-expanded:bg-zinc-100 dark:aria-expanded:bg-zinc-900`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
        {dict.header.categories}
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div
        id={panelId}
        ref={panelRef}
        hidden={!open}
        onKeyDown={onPanelKeyDown}
        className="absolute left-0 top-full z-50 mt-2 w-[min(52rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/50"
      >
        <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-zinc-200 pb-4 text-sm dark:border-zinc-800">
          <Link
            href={localeHref(locale, "/catalog")}
            onClick={close}
            className="inline-flex items-center gap-1.5 font-semibold text-zinc-950 hover:text-accent dark:text-white"
          >
            {dict.header.allProducts}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href={localeHref(locale, "/catalog?sort=newest")}
            onClick={close}
            className="text-zinc-700 hover:text-accent dark:text-zinc-300"
          >
            {dict.header.newArrivals}
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-x-8 gap-y-6 xl:grid-cols-4">
          {tree.map((node) => (
            <li key={node.id}>
              <Link
                href={localeHref(locale, categoryPath(node.slug))}
                onClick={close}
                className="group/top flex items-center gap-2.5 font-semibold text-zinc-950 hover:text-accent dark:text-white"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 group-hover/top:bg-amber-100 group-hover/top:text-amber-800 dark:bg-zinc-900 dark:text-zinc-300 dark:group-hover/top:bg-amber-400/15 dark:group-hover/top:text-amber-300">
                  <CategoryIcon slug={node.slug} name={node.name} className="h-5 w-5" />
                </span>
                {node.name}
              </Link>
              {node.children.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-0.5 pl-[2.875rem] text-sm">
                  {node.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={localeHref(locale, categoryPath(child.slug))}
                        onClick={close}
                        className="block py-1 text-zinc-600 hover:text-accent dark:text-zinc-400"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
