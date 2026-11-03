import Link from "next/link";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { locale, dict } = await getI18n();
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-sm text-zinc-500">{dict.notFound.code}</p>
      <h1 className="text-2xl font-semibold">{dict.notFound.title}</h1>
      <Link href={localeHref(locale, "/catalog")} className="underline">
        {dict.notFound.backToCatalog}
      </Link>
    </div>
  );
}
