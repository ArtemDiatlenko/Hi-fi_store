import Link from "next/link";
import { hrefWith, type SearchParams } from "@/lib/query";

interface Props {
  page: number;
  totalPages: number;
  params: SearchParams;
}

export function Pagination({ page, totalPages, params }: Props) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav aria-label="Страницы" className="flex items-center justify-center gap-4 text-sm">
      {page > 1 ? (
        <Link href={hrefWith(params, { page: String(page - 1) })} className="underline">
          Назад
        </Link>
      ) : (
        <span className="text-zinc-400">Назад</span>
      )}
      <span>
        Страница {page} из {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefWith(params, { page: String(page + 1) })} className="underline">
          Вперёд
        </Link>
      ) : (
        <span className="text-zinc-400">Вперёд</span>
      )}
    </nav>
  );
}
