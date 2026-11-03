import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Приватные/служебные разделы в обеих локалях закрываем от индексации (у них же стоит noindex
// в метаданных страниц). Карта сайта — абсолютным адресом.
const DISALLOW = [
  "/checkout",
  "/account",
  "/orders/",
  "/admin",
  "/en/checkout",
  "/en/account",
  "/en/orders/",
  "/en/admin",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: DISALLOW,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
