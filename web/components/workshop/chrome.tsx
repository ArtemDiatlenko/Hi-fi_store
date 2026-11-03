import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AccountNav } from "@/components/account-nav";
import { CartLink } from "@/components/cart-link";
import { SearchIcon } from "@/components/icons";
import { LanguageSwitcher, LanguageSwitcherFallback } from "@/components/language-switcher";
import { getI18n } from "@/lib/i18n/server";
import { localeHref } from "@/lib/i18n/routing";
import { workshopCopy } from "@/lib/i18n/workshop";
import styles from "./workshop.module.css";

export async function WorkshopChrome({ children }: { children: ReactNode }) {
  const { locale, dict } = await getI18n();
  const t = workshopCopy[locale];
  return (
    <div className={styles.workshop}>
      <header className={styles.header}>
        <Link href={localeHref(locale, "/")} className={styles.wordmark} aria-label={dict.header.homeLink}>hi-fi<span>store</span></Link>
        <nav aria-label={dict.header.menu} className={styles.navigation}>
          <Link href={localeHref(locale, "/catalog")}>{dict.header.catalog}</Link>
          <Link href={localeHref(locale, "/consultation")}>{dict.header.consultation}</Link>
          <Link href={localeHref(locale, "/info/contacts")}>{dict.info.contacts.title}</Link>
        </nav>
        <div className={styles.utilities}>
          <div className={styles.account}><AccountNav variant="desktop" /></div>
          <CartLink />
          <div className={styles.languages}><Suspense fallback={<LanguageSwitcherFallback />}><LanguageSwitcher /></Suspense></div>
        </div>
        <form action={localeHref(locale, "/catalog")} role="search" className={styles.search}>
          <label className="sr-only" htmlFor="workshop-search">{dict.header.searchLabel}</label>
          <input id="workshop-search" type="search" name="q" placeholder={dict.header.searchPlaceholder} />
          <button type="submit" aria-label={dict.header.searchSubmit}><SearchIcon className="h-4 w-4" /></button>
        </form>
      </header>
      <main id="main-content" tabIndex={-1} className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <div><span className={styles.wordmark}>hi-fi<span>store</span></span><p>{t.footer}</p></div>
        <nav aria-label={dict.footer.customersTitle}>
          <Link href={localeHref(locale, "/info/delivery")}>{dict.info.delivery.title}</Link>
          <Link href={localeHref(locale, "/info/returns")}>{dict.info.returns.title}</Link>
          <Link href={localeHref(locale, "/info/contacts")}>{dict.info.contacts.title}</Link>
          <Link href={localeHref(locale, "/account")}>{dict.header.account}</Link>
        </nav>
        <p className={styles.demoNote}>{dict.footer.tagline}</p>
      </footer>
    </div>
  );
}
