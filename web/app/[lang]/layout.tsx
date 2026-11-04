import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono, Manrope } from "next/font/google";
import { htmlLang, type Locale, locales, ogLocale } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/client";
import { addLocalePrefix } from "@/lib/i18n/routing";
import { getI18n, getLocale } from "@/lib/i18n/server";
import { SITE_URL } from "@/lib/site";
import "../globals.css";

// Кириллица нужна для украинского интерфейса и названий товаров из API.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

// Шрифты витрины («Сцена»): антиква для заголовков и гротеск для текста. Подключаются в .stage (globals.css).
const stageDisplay = Cormorant_Garamond({
  variable: "--font-stage-display",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
});

const stageBody = Manrope({
  variable: "--font-stage-body",
  subsets: ["latin", "cyrillic"],
});

// Статически генерируем обе локали. С Cache Components для корневого параметра нужно хотя бы
// одно значение, иначе сборка упадёт.
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

// [lang] принимает только локали из generateStaticParams, остальное — 404 (аналог dynamicParams = false,
// который с Cache Components недоступен). Это важно и для клиентского роутера: украинские адреса живут
// без префикса (proxy переписывает «/catalog» → «/uk/catalog»), а роутер с Partial Prefetching угадывает
// маршрут по форме адреса. Выучив на английских страницах шаблон «/[lang]/…», он принимал бы «/catalog»
// за lang=catalog и запрашивал несуществующий сегмент (404 в консоли), например после смены языка.
// Для закрытого параметра роутер не угадывает маршрут, а спрашивает сервер (проходит через proxy).
export const unstable_paramMatching = { lang: "not-found" };

const descriptions: Record<Locale, string> = {
  uk: "Інтернет-магазин hi-fi техніки: підсилювачі, акустика, програвачі, кабелі.",
  en: "Hi-fi equipment online store: amplifiers, speakers, turntables and cables.",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: "Hi-Fi Store",
      template: "%s — Hi-Fi Store",
    },
    description: descriptions[locale],
    alternates: {
      canonical: addLocalePrefix("/", locale),
      languages: {
        uk: "/",
        en: "/en",
        "x-default": "/",
      },
    },
    openGraph: {
      type: "website",
      siteName: "Hi-Fi Store",
      title: "Hi-Fi Store",
      description: descriptions[locale],
      url: addLocalePrefix("/", locale),
      locale: ogLocale[locale],
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const { locale, dict } = await getI18n();

  // Шапка и подвал витрины — в app/[lang]/(store)/layout.tsx, у админки своя оболочка (app/[lang]/admin).
  return (
    <html lang={htmlLang[locale]} className={`${geistSans.variable} ${geistMono.variable} ${stageDisplay.variable} ${stageBody.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale} dict={dict}>
          <a
            href="#main-content"
            className="sr-only rounded-md bg-zinc-900 px-4 py-2 font-medium text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {dict.common.skipToContent}
          </a>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
