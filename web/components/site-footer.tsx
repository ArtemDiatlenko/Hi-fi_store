import Link from "next/link";
import { Suspense } from "react";
import { MailIcon, PhoneIcon } from "@/components/icons";
import { Logo } from "@/components/site-header";
import type { CategoryNode } from "@/lib/api";
import { categoryPath } from "@/lib/categories";
import type { Locale } from "@/lib/i18n/config";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";
import { STORE_CONTACTS, telHref } from "@/lib/site";

const linkClass = "rounded-sm text-zinc-400 hover:text-white hover:underline";
const headingClass = "text-sm font-semibold uppercase tracking-wider text-zinc-100";

/**
 * Подвал: о магазине, разделы каталога (потоково, из того же промиса, что и шапка), информация
 * для покупателей и контакты. Тёмный в обеих темах — визуально «закрывает» страницу.
 */
export async function SiteFooter({ categories }: { categories: Promise<CategoryNode[]> }) {
  const { locale, dict } = await getI18n();

  const customerLinks = [
    { href: "/consultation", label: dict.header.consultation },
    { href: "/info/delivery", label: dict.info.delivery.title },
    { href: "/info/returns", label: dict.info.returns.title },
    { href: "/info/contacts", label: dict.info.contacts.title },
    { href: "/account", label: dict.header.account },
    { href: "/cart", label: dict.header.cart },
  ];

  return (
    <footer className="mt-16 bg-zinc-950 text-zinc-300 [color-scheme:dark]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:py-16">
        <div className="flex flex-col gap-4">
          <span className="text-white">
            <Logo href={localeHref(locale, "/")} label={dict.header.homeLink} brand={dict.common.brand} tone="dark" />
          </span>
          <p className="max-w-xs text-sm leading-relaxed text-zinc-400">{dict.footer.about}</p>
        </div>

        <nav aria-labelledby="footer-catalog">
          <h2 id="footer-catalog" className={headingClass}>
            {dict.footer.catalogTitle}
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm">
            <li>
              <Link href={localeHref(locale, "/catalog")} className={linkClass}>
                {dict.header.allProducts}
              </Link>
            </li>
            <li>
              <Link href={localeHref(locale, "/catalog?sort=newest")} className={linkClass}>
                {dict.header.newArrivals}
              </Link>
            </li>
            <Suspense fallback={null}>
              <FooterCategories categories={categories} locale={locale} />
            </Suspense>
          </ul>
        </nav>

        <nav aria-labelledby="footer-customers">
          <h2 id="footer-customers" className={headingClass}>
            {dict.footer.customersTitle}
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm">
            {customerLinks.map((link) => (
              <li key={link.href}>
                <Link href={localeHref(locale, link.href)} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="footer-contacts">
          <h2 id="footer-contacts" className={`${headingClass} flex flex-wrap items-center gap-2`}>
            {dict.footer.contactsTitle}
            {STORE_CONTACTS.placeholder ? (
              <span
                title={dict.footer.sampleNote}
                className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[0.6875rem] font-medium normal-case tracking-normal text-amber-300"
              >
                {dict.footer.sampleBadge}
              </span>
            ) : null}
          </h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            <li>
              <a href={telHref(STORE_CONTACTS.phone)} className={`${linkClass} inline-flex items-center gap-2`}>
                <PhoneIcon className="h-4 w-4" />
                <span className="sr-only">{dict.footer.phone}: </span>
                {STORE_CONTACTS.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${STORE_CONTACTS.email}`} className={`${linkClass} inline-flex items-center gap-2`}>
                <MailIcon className="h-4 w-4" />
                <span className="sr-only">{dict.footer.email}: </span>
                {STORE_CONTACTS.email}
              </a>
            </li>
            <li>
              <Link href={localeHref(locale, "/info/contacts")} className={linkClass}>
                {dict.footer.allContacts}
              </Link>
            </li>
          </ul>
        </section>
      </div>

      <div className="border-t border-zinc-800">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-zinc-400">{dict.footer.tagline}</p>
      </div>
    </footer>
  );
}

async function FooterCategories({ categories, locale }: { categories: Promise<CategoryNode[]>; locale: Locale }) {
  const tree = await categories;
  return tree.map((node) => (
    <li key={node.id}>
      <Link href={localeHref(locale, categoryPath(node.slug))} className={linkClass}>
        {node.name}
      </Link>
    </li>
  ));
}
