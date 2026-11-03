"use client";

import Link from "next/link";
import { Suspense } from "react";
import { CartLink } from "@/components/cart-link";
import { LanguageSwitcher, LanguageSwitcherFallback } from "@/components/language-switcher";
import { MobileMenu, type NavLink } from "@/components/mobile-menu";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";

export function SiteHeader() {
  const { locale, dict } = useI18n();

  const links: NavLink[] = [
    { href: localeHref(locale, "/catalog"), label: dict.header.catalog },
    { href: localeHref(locale, "/account"), label: dict.header.account },
    { href: localeHref(locale, "/login"), label: dict.header.login },
  ];

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-x-4 px-4 py-4">
        <Link href={localeHref(locale, "/catalog")} className="text-lg font-semibold tracking-tight">
          {dict.common.brand}
        </Link>

        {/* Десктоп: полная навигация */}
        <nav aria-label={dict.header.menu} className="hidden items-center gap-x-5 text-sm lg:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
          <CartLink />
          <Suspense fallback={<LanguageSwitcherFallback />}>
            <LanguageSwitcher />
          </Suspense>
        </nav>

        {/* Мобильные: корзина всегда видна, остальное — в выдвижном меню */}
        <div className="flex items-center gap-x-3 lg:hidden">
          <CartLink />
          <MobileMenu links={links} />
        </div>
      </div>
    </header>
  );
}
