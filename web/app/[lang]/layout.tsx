import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { htmlLang, type Locale, locales, ogLocale } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/client";
import { addLocalePrefix } from "@/lib/i18n/routing";
import { getI18n, getLocale } from "@/lib/i18n/server";
import { SITE_URL } from "@/lib/site";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Статически генерируем обе локали. С Cache Components для корневого параметра нужно хотя бы
// одно значение, иначе сборка упадёт.
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

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

  return (
    <html lang={htmlLang[locale]} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale} dict={dict}>
          <a
            href="#main-content"
            className="sr-only rounded-md bg-zinc-900 px-4 py-2 font-medium text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {dict.common.skipToContent}
          </a>
          <SiteHeader />
          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none">
            {children}
          </main>
          <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
            {dict.footer.tagline}
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
