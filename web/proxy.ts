// Маршрутизация локалей. Украинская (по умолчанию) живёт на «/» без префикса, английская — под «/en».
// Все страницы физически лежат под app/[lang], поэтому:
//   • «/en/...»  → отдаём как есть (сегмент [lang] = en);
//   • «/uk/...»  → редиректим на чистый адрес без префикса (канонический URL);
//   • всё прочее → внутренне переписываем на «/uk/...» (адрес в браузере не меняется).
//
// В Next.js 16 middleware переименован в proxy (функциональность та же).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale } from "@/lib/i18n/config";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Английская локаль обслуживается своим префиксом напрямую.
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return NextResponse.next();
  }

  // Явный префикс локали по умолчанию убираем — канонические адреса без «/uk».
  if (pathname === `/${defaultLocale}` || pathname.startsWith(`/${defaultLocale}/`)) {
    const stripped = pathname.slice(defaultLocale.length + 1) || "/";
    const url = request.nextUrl.clone();
    url.pathname = stripped;
    return NextResponse.redirect(url);
  }

  // Путь без префикса — это локаль по умолчанию: переписываем на внутренний /uk/...
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Пропускаем API (их проксирует next.config), ассеты Next, файлы метаданных и статические файлы
  // демо-каталога из public/demo и оформления из public/design.
  matcher: ["/((?!api|_next/static|_next/image|demo/|design/|favicon.ico|sitemap.xml|robots.txt).*)"],
};
