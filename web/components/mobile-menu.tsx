"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n/client";
import { useFocusTrap } from "@/lib/use-focus-trap";

export interface NavLink {
  href: string;
  label: string;
}

/**
 * Мобильное меню (гамбургер): выдвижная панель с навигацией и переключателем языка.
 * Доступно с клавиатуры — Esc закрывает, фокус заперт внутри панели, при закрытии
 * возвращается на кнопку. Анимация уважает prefers-reduced-motion. Пункты закрывают меню
 * сами (onClick), поэтому отдельного эффекта на смену маршрута не нужно.
 */
export function MobileMenu({ links }: { links: NavLink[] }) {
  const { dict } = useI18n();
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
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-700"
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
            className="absolute inset-0 h-full w-full cursor-default bg-black/40 motion-safe:transition-opacity"
          />
          <div
            id="mobile-menu"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={dict.header.menu}
            className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto border-l border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{dict.common.brand}</span>
              <button
                type="button"
                onClick={close}
                aria-label={dict.header.closeMenu}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-zinc-300 dark:border-zinc-700"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav aria-label={dict.header.menu}>
              <ul className="flex flex-col gap-1 text-base">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={close}
                      className="flex min-h-11 items-center rounded-md px-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-auto flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide text-zinc-500">{dict.header.language}</span>
              <LanguageSwitcher onNavigate={close} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
