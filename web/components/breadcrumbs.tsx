import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export interface Crumb {
  label: string;
  /** Без href — текущая страница (последний элемент). */
  href?: string;
}

/**
 * Навигационная цепочка: nav + упорядоченный список, текущая страница — aria-current="page".
 * Разделители декоративные (aria-hidden), скринридер их не читает. Длинные названия переносятся.
 */
export function Breadcrumbs({ items, dict }: { items: Crumb[]; dict: Dictionary }) {
  return (
    <nav aria-label={dict.breadcrumbs.label} className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-zinc-600 dark:text-zinc-400">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-x-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">
                  /
                </span>
              ) : null}
              {item.href && !last ? (
                <Link href={item.href} className="rounded-sm hover:text-zinc-900 hover:underline dark:hover:text-zinc-100">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="font-medium text-zinc-900 dark:text-zinc-100">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
