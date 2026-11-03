// Метаданные страниц с учётом локали: канонический адрес, hreflang-альтернативы и Open Graph.
// Корневой макет задаёт значения по умолчанию (для главной); страницы с собственным адресом
// переопределяют их этим помощником, иначе canonical всех страниц указывал бы на главную.

import type { Metadata } from "next";
import { defaultLocale, type Locale, ogLocale } from "@/lib/i18n/config";
import { addLocalePrefix } from "@/lib/i18n/routing";

/** canonical и hreflang для логического пути («/catalog») в активной локали. */
export function localizedAlternates(path: string, locale: Locale): NonNullable<Metadata["alternates"]> {
  return {
    canonical: addLocalePrefix(path, locale),
    languages: {
      uk: addLocalePrefix(path, "uk"),
      en: addLocalePrefix(path, "en"),
      "x-default": addLocalePrefix(path, defaultLocale),
    },
  };
}

interface PageMetadataInput {
  /** Заголовок страницы; подставляется в шаблон «%s — Hi-Fi Store» из макета, если не absolute. */
  title: string;
  description: string;
  path: string;
  locale: Locale;
  /** true — заголовок без шаблона (для главной). */
  absoluteTitle?: boolean;
}

export function pageMetadata({ title, description, path, locale, absoluteTitle = false }: PageMetadataInput): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: localizedAlternates(path, locale),
    openGraph: {
      type: "website",
      siteName: "Hi-Fi Store",
      title,
      description,
      url: addLocalePrefix(path, locale),
      locale: ogLocale[locale],
    },
  };
}
