import Link from "next/link";
import { Suspense } from "react";
import { AccountNav } from "@/components/account-nav";
import { CartLink } from "@/components/cart-link";
import { CategoriesMenu } from "@/components/categories-menu";
import { catalogTriggerClass } from "@/components/header-styles";
import { LogoMark } from "@/components/icons";
import { LanguageSwitcher, LanguageSwitcherFallback } from "@/components/language-switcher";
import { MobileMenu } from "@/components/mobile-menu";
import { SearchForm } from "@/components/search-form";
import type { CategoryNode } from "@/lib/api";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";

/** Логотип-ссылка на главную. Используется в шапке и подвале. */
export function Logo({ href, label, brand, tone = "auto" }: { href: string; label: string; brand: string; tone?: "auto" | "dark" }) {
  return (
    <Link href={href} aria-label={label} className="inline-flex shrink-0 items-center gap-2.5 rounded-md text-lg font-semibold tracking-tight">
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
          tone === "dark" ? "bg-amber-400 text-zinc-950" : "bg-zinc-950 text-amber-400 dark:bg-amber-400 dark:text-zinc-950"
        }`}
      >
        <LogoMark className="h-6 w-6" />
      </span>
      <span>{brand}</span>
    </Link>
  );
}

/**
 * Шапка витрины. Статическая оболочка (логотип, поиск, корзина) рендерится сразу; разделы каталога
 * приходят промисом из макета и подставляются потоково (Suspense), а состояние входа и ссылка на
 * админ-панель определяются в браузере по токену (AccountNav).
 *
 * Раскладка: телефоны — логотип, корзина, меню, под ними поиск; планшеты — поиск в строке;
 * десктоп (lg) — меню разделов, поиск, аккаунт, корзина и язык.
 */
export async function SiteHeader({ categories }: { categories: Promise<CategoryNode[]> }) {
  const { locale, dict } = await getI18n();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:h-[4.5rem] lg:gap-4">
        <Logo href={localeHref(locale, "/")} label={dict.header.homeLink} brand={dict.common.brand} />

        <nav aria-label={dict.header.categoriesMenu} className="hidden lg:block">
          <Suspense
            fallback={
              <Link href={localeHref(locale, "/catalog")} className={catalogTriggerClass}>
                {dict.header.catalog}
              </Link>
            }
          >
            <CategoriesMenu categories={categories} />
          </Suspense>
        </nav>

        <div className="hidden lg:block">
          <Link href={localeHref(locale, "/consultation")} className={catalogTriggerClass}>
            {dict.header.consultation}
          </Link>
        </div>

        <SearchForm locale={locale} dict={dict} id="site-search" className="hidden min-w-0 flex-1 md:block lg:max-w-xl" />

        <nav aria-label={dict.header.menu} className="ml-auto hidden items-center gap-1 lg:flex">
          <AccountNav variant="desktop" />
          <span className="px-2">
            <CartLink />
          </span>
          <Suspense fallback={<LanguageSwitcherFallback />}>
            <LanguageSwitcher />
          </Suspense>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0 lg:hidden">
          <CartLink />
          <MobileMenu categories={categories} />
        </div>
      </div>

      <div className="px-4 pb-3 md:hidden">
        <SearchForm locale={locale} dict={dict} id="site-search-mobile" />
      </div>
    </header>
  );
}
