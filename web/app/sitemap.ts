import type { MetadataRoute } from "next";
import { addLocalePrefix, localeHref } from "@/lib/i18n/routing";
import { SITE_URL } from "@/lib/site";

// Публичные индексируемые маршруты (без checkout/account/orders — те noindex). Контент товаров
// в sitemap не включаем: он требует обращения к API, а сборка витрины идёт без запущенного API.
const PUBLIC_PATHS = ["/catalog", "/login", "/register"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${localeHref("uk", path)}`,
    lastModified: now,
    alternates: {
      languages: {
        uk: `${SITE_URL}${addLocalePrefix(path, "uk")}`,
        en: `${SITE_URL}${addLocalePrefix(path, "en")}`,
        "x-default": `${SITE_URL}${addLocalePrefix(path, "uk")}`,
      },
    },
  }));
}
