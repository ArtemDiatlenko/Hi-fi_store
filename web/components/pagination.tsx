import Link from "next/link";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";
import { tpl } from "@/lib/i18n/util";
import { hrefWith, type SearchParams } from "@/lib/query";

interface Props {
  page: number;
  totalPages: number;
  params: SearchParams;
}

export async function Pagination({ page, totalPages, params }: Props) {
  if (totalPages <= 1) {
    return null;
  }

  const { locale, dict } = await getI18n();
  const catalogPath = localeHref(locale, "/catalog");

  return (
    <nav aria-label={dict.pagination.label} className="flex items-center justify-center gap-4 text-sm">
      {page > 1 ? (
        <Link href={hrefWith(catalogPath, params, { page: String(page - 1) })} className="inline-flex min-h-11 items-center underline">
          {dict.pagination.prev}
        </Link>
      ) : (
        <span className="inline-flex min-h-11 items-center text-zinc-400">{dict.pagination.prev}</span>
      )}
      <span>{tpl(dict.pagination.pageOf, { page, total: totalPages })}</span>
      {page < totalPages ? (
        <Link href={hrefWith(catalogPath, params, { page: String(page + 1) })} className="inline-flex min-h-11 items-center underline">
          {dict.pagination.next}
        </Link>
      ) : (
        <span className="inline-flex min-h-11 items-center text-zinc-400">{dict.pagination.next}</span>
      )}
    </nav>
  );
}
