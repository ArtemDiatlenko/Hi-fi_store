import Form from "next/form";
import { SearchIcon } from "@/components/icons";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localeHref } from "@/lib/i18n/routing";

interface Props {
  locale: Locale;
  dict: Dictionary;
  /** Уникальный id поля: в шапке две формы (десктоп и мобильная), видна одна. */
  id: string;
  className?: string;
}

/**
 * Поиск по каталогу: GET-форма на /catalog?q=… . next/form переходит без перезагрузки страницы,
 * а без JavaScript работает как обычная форма.
 */
export function SearchForm({ locale, dict, id, className = "" }: Props) {
  return (
    <Form role="search" action={localeHref(locale, "/catalog")} className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {dict.header.searchLabel}
      </label>
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
      <input
        id={id}
        name="q"
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        placeholder={dict.header.searchPlaceholder}
        className="h-11 w-full rounded-full border border-zinc-300 bg-zinc-50 pl-11 pr-24 text-sm text-zinc-900 placeholder:text-zinc-500 hover:border-zinc-400 focus:border-zinc-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:hover:border-zinc-600 dark:focus:border-zinc-500 dark:focus:bg-zinc-900 [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="submit"
        className="absolute right-1 top-1 h-9 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {dict.header.searchSubmit}
      </button>
    </Form>
  );
}
