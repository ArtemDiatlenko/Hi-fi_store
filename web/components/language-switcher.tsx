"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { type Locale, locales } from "@/lib/i18n/config";
import { addLocalePrefix, switchLocaleHref } from "@/lib/i18n/routing";

const shortLabel: Record<Locale, string> = { uk: "УКР", en: "ENG" };

const groupClass =
  "inline-flex overflow-hidden rounded-md border border-zinc-300 text-xs font-semibold dark:border-zinc-700";

function itemClass(active: boolean): string {
  return `flex min-h-11 min-w-11 items-center justify-center px-3 ${
    active
      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
  }`;
}

/**
 * Статическая заглушка для Suspense: usePathname — динамические данные (под Cache Components их
 * нужно стримить), поэтому в статической оболочке показываем переключатель со ссылками на
 * домашнюю страницу каждой локали. После гидратации его заменяет полноценный LanguageSwitcher,
 * сохраняющий текущий путь и параметры.
 */
export function LanguageSwitcherFallback() {
  const { locale, dict } = useI18n();
  const names: Record<Locale, string> = { uk: dict.header.switchToUk, en: dict.header.switchToEn };
  return (
    <div role="group" aria-label={dict.header.language} className={groupClass}>
      {locales.map((target) => (
        <Link
          key={target}
          href={addLocalePrefix("/", target)}
          prefetch={false}
          hrefLang={target}
          lang={target}
          aria-current={target === locale ? "true" : undefined}
          className={itemClass(target === locale)}
        >
          {shortLabel[target]}
          <span className="sr-only"> — {names[target]}</span>
        </Link>
      ))}
    </div>
  );
}

/**
 * Переключатель языка: тот же путь в другой локали с сохранением параметров.
 * href указывает на базовый путь (работает без JS и при открытии в новой вкладке);
 * при обычном клике перехватываем переход и добавляем текущую query-строку, поэтому
 * фильтры каталога сохраняются. useSearchParams не используем — шапка остаётся статической.
 *
 * prefetch={false}: смена языка меняет корневой макет ([lang]) — это всегда полная загрузка
 * документа, предзагрузка бесполезна. Хуже того, предзагрузка «/en» учит клиентский роутер шаблону
 * «/[lang]», и он начинает угадывать украинские адреса без префикса («/catalog?…») как lang=catalog
 * — лишние запросы с 404 в консоли.
 */
export function LanguageSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  const names: Record<Locale, string> = { uk: dict.header.switchToUk, en: dict.header.switchToEn };

  return (
    <div role="group" aria-label={dict.header.language} className={groupClass}>
      {locales.map((target) => {
        const active = target === locale;
        return (
          <Link
            key={target}
            href={switchLocaleHref(pathname, "", target)}
            prefetch={false}
            hrefLang={target}
            lang={target}
            aria-current={active ? "true" : undefined}
            onClick={(event) => {
              if (!active) {
                const search = typeof window === "undefined" ? "" : window.location.search;
                event.preventDefault();
                router.push(switchLocaleHref(pathname, search, target));
              }
              onNavigate?.();
            }}
            className={itemClass(active)}
          >
            {shortLabel[target]}
            <span className="sr-only"> — {names[target]}</span>
          </Link>
        );
      })}
    </div>
  );
}
