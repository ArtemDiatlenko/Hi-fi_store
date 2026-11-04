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

/** Логотип-ссылка на главную. Используется в шапке и подвале: знак «светится», как разогретая лампа. */
export function Logo({ href, label, brand }: { href: string; label: string; brand: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="group/logo inline-flex shrink-0 items-center gap-2.5 rounded-sm font-display text-2xl leading-none tracking-wide text-zinc-100"
    >
      <span className="relative inline-flex h-9 w-9 items-center justify-center text-amber-400">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-amber-400/25 blur-md transition-opacity duration-700 motion-safe:animate-breathe group-hover/logo:bg-amber-400/40"
        />
        <LogoMark className="relative h-7 w-7" />
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
 * десктоп (xl) — меню разделов, поиск, аккаунт, корзина и язык.
 *
 * Шапка «липкая» и полупрозрачная; после первых пикселей прокрутки фон плотнеет (scroll-driven
 * анимация .stage-header). При переходах между страницами она остаётся на месте (viewTransitionName).
 */
export async function SiteHeader({ categories }: { categories: Promise<CategoryNode[]> }) {
  const { locale, dict } = await getI18n();

  return (
    <header className="sticky top-0 z-40 isolate" style={{ viewTransitionName: "site-header" }}>
      {/* Фон шапки — отдельным слоем: размытие на самой шапке «заперло» бы выезжающее меню внутри неё. */}
      <div aria-hidden="true" className="stage-header absolute inset-0 -z-10 border-b border-white/5 bg-zinc-950/60 backdrop-blur-xl" />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 xl:h-[4.5rem] xl:gap-4">
        <Logo href={localeHref(locale, "/")} label={dict.header.homeLink} brand={dict.common.brand} />

        <nav aria-label={dict.header.categoriesMenu} className="hidden xl:block">
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

        <div className="hidden xl:block">
          <Link href={localeHref(locale, "/consultation")} className={catalogTriggerClass}>
            {dict.header.consultation}
          </Link>
        </div>

        <SearchForm locale={locale} dict={dict} id="site-search" className="hidden min-w-0 flex-1 md:block xl:max-w-xl" />

        <nav aria-label={dict.header.menu} className="ml-auto hidden items-center gap-1 xl:flex">
          <AccountNav variant="desktop" />
          <span className="px-2">
            <CartLink />
          </span>
          <Suspense fallback={<LanguageSwitcherFallback />}>
            <LanguageSwitcher />
          </Suspense>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0 xl:hidden">
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
