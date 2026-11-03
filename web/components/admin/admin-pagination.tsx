"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/util";

/** Постраничная навигация списков админки; номер страницы живёт в адресной строке (?page=). */
export function AdminPagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (page: number) => string }) {
  const { dict } = useI18n();
  if (totalPages <= 1) {
    return null;
  }
  const linkClass = "inline-flex min-h-11 items-center underline underline-offset-2";
  const disabledClass = "inline-flex min-h-11 items-center text-zinc-400";
  return (
    <nav aria-label={dict.admin.common.pagesLabel} className="flex items-center justify-center gap-4 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass}>
          {dict.pagination.prev}
        </Link>
      ) : (
        <span className={disabledClass}>{dict.pagination.prev}</span>
      )}
      <span aria-current="page">{tpl(dict.pagination.pageOf, { page, total: totalPages })}</span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={linkClass}>
          {dict.pagination.next}
        </Link>
      ) : (
        <span className={disabledClass}>{dict.pagination.next}</span>
      )}
    </nav>
  );
}

/** Адрес списка с заменёнными параметрами; пустые значения убираются. */
export function listHref(basePath: string, current: URLSearchParams, overrides: Record<string, string | null>): string {
  const next = new URLSearchParams(current.toString());
  for (const [name, value] of Object.entries(overrides)) {
    if (value === null || value.trim() === "") {
      next.delete(name);
    } else {
      next.set(name, value);
    }
  }
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}
