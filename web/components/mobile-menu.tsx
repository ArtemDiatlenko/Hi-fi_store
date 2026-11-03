"use client";

import Link from "next/link";
import { Suspense, use, useCallback, useRef, useState } from "react";
import { AccountNav } from "@/components/account-nav";
import { CategoryIcon, LogoMark } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { CategoryNode } from "@/lib/api";
import { categoryPath } from "@/lib/categories";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { useFocusTrap } from "@/lib/use-focus-trap";

const itemClass = "flex min-h-11 items-center gap-3 rounded-lg px-2 text-base hover:bg-zinc-100 dark:hover:bg-zinc-900";

/**
 * Мобильное меню (гамбургер): выдвижная панель с разделами каталога, аккаунтом (и админ-панелью
 * для администратора) и переключателем языка. Доступно с клавиатуры — Esc закрывает, фокус заперт
 * внутри панели, при закрытии возвращается на кнопку. Анимация уважает prefers-reduced-motion.
 * Пункты закрывают меню сами (onClick), поэтому отдельного эффекта на смену маршрута не нужно.
 */
export function MobileMenu({ categories }: { categories: Promise<CategoryNode[]> }) {
  const { locale, dict } = useI18n();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useFocusTrap(open, panelRef, close);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? dict.header.closeMenu : dict.header.openMenu}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-black/50 motion-safe:transition-opacity"
          />
          <div
            id="mobile-menu"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={dict.header.menu}
            className="absolute right-0 top-0 flex h-full w-80 max-w-[88vw] flex-col gap-6 overflow-y-auto border-l border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-amber-400 dark:bg-amber-400 dark:text-zinc-950">
                  <LogoMark className="h-5 w-5" />
                </span>
                {dict.common.brand}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label={dict.header.closeMenu}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav aria-label={dict.header.menu} className="flex flex-col gap-5">
              <ul className="flex flex-col gap-1">
                <li>
                  <Link href={localeHref(locale, "/")} onClick={close} className={itemClass}>
                    {dict.breadcrumbs.home}
                  </Link>
                </li>
                <li>
                  <Link href={localeHref(locale, "/catalog")} onClick={close} className={`${itemClass} font-medium`}>
                    {dict.header.allProducts}
                  </Link>
                </li>
                <li>
                  <Link href={localeHref(locale, "/catalog?sort=newest")} onClick={close} className={itemClass}>
                    {dict.header.newArrivals}
                  </Link>
                </li>
                <li>
                  <Link href={localeHref(locale, "/consultation")} onClick={close} className={itemClass}>
                    {dict.header.consultation}
                  </Link>
                </li>
              </ul>

              <Suspense fallback={<p className="px-2 text-sm text-zinc-600 dark:text-zinc-400">{dict.common.loading}</p>}>
                <MobileCategories categories={categories} onNavigate={close} />
              </Suspense>

              <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <AccountNav variant="mobile" onNavigate={close} />
              </div>
            </nav>

            <div className="mt-auto flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{dict.header.language}</span>
              <LanguageSwitcher onNavigate={close} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileCategories({ categories, onNavigate }: { categories: Promise<CategoryNode[]>; onNavigate: () => void }) {
  const { locale, dict } = useI18n();
  const tree = use(categories);
  if (tree.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <h2 className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
        {dict.header.categoriesMenu}
      </h2>
      <ul className="flex flex-col gap-1">
        {tree.map((node) => (
          <li key={node.id}>
            <Link href={localeHref(locale, categoryPath(node.slug))} onClick={onNavigate} className={`${itemClass} font-medium`}>
              <CategoryIcon slug={node.slug} name={node.name} className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
              {node.name}
            </Link>
            {node.children.length > 0 ? (
              <ul className="mb-1 flex flex-col pl-10">
                {node.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={localeHref(locale, categoryPath(child.slug))}
                      onClick={onNavigate}
                      className="flex min-h-11 items-center rounded-lg px-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
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
  );
}
