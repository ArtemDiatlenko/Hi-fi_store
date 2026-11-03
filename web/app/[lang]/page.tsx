import { redirect } from "next/navigation";
import { localeHref } from "@/lib/i18n/routing";
import { getLocale } from "@/lib/i18n/server";

export default async function HomePage() {
  const locale = await getLocale();
  redirect(localeHref(locale, "/catalog"));
}
