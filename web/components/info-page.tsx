import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MailIcon, PhoneIcon } from "@/components/icons";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";
import { STORE_CONTACTS, telHref } from "@/lib/site";

export type InfoPageKey = "delivery" | "returns" | "contacts";

const PAGES: InfoPageKey[] = ["delivery", "returns", "contacts"];

/** Логический путь информационной страницы (без префикса локали). */
export function infoPath(page: InfoPageKey): string {
  return `/info/${page}`;
}

/**
 * Информационная страница для покупателей (доставка, возврат, контакты). Текст — шаблонный,
 * из словаря (раздел info), и явно помечен плашкой «Зразок тексту», чтобы магазин заменил его
 * своими условиями.
 */
export async function InfoPage({ page }: { page: InfoPageKey }) {
  const { locale, dict } = await getI18n();
  const content = dict.info[page];

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs
        dict={dict}
        items={[{ label: dict.breadcrumbs.home, href: localeHref(locale, "/") }, { label: content.title }]}
      />

      <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-12">
        <nav aria-label={dict.info.navLabel} className="lg:sticky lg:top-6 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {PAGES.map((key) => {
              const active = key === page;
              return (
                <li key={key}>
                  <Link
                    href={localeHref(locale, infoPath(key))}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-full border px-4 text-sm lg:rounded-lg lg:border-0 lg:px-3 ${
                      active
                        ? "border-zinc-900 bg-zinc-900 font-medium text-white dark:border-amber-400/60 dark:bg-amber-400/10 dark:text-amber-400"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {dict.info[key].title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <article className="flex max-w-3xl flex-col gap-8">
          <header className="flex flex-col gap-4">
            <h1 className="text-4xl leading-tight font-light sm:text-5xl">{content.title}</h1>
            <p
              role="note"
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
            >
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-zinc-950">{dict.info.sampleBadge}</span>
              {dict.info.sampleNotice}
            </p>
            <p className="text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">{content.intro}</p>
          </header>

          {page === "contacts" ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              <li>
                <a
                  href={telHref(STORE_CONTACTS.phone)}
                  className="flex h-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    <PhoneIcon className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">{dict.footer.phone}</span>
                    <span className="font-medium">{STORE_CONTACTS.phone}</span>
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${STORE_CONTACTS.email}`}
                  className="flex h-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    <MailIcon className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">{dict.footer.email}</span>
                    <span className="font-medium">{STORE_CONTACTS.email}</span>
                  </span>
                </a>
              </li>
            </ul>
          ) : null}

          {content.sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <h2 className="text-[1.75rem] leading-tight font-normal">{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {paragraph}
                </p>
              ))}
              {section.list && section.list.length > 0 ? (
                <ul className="flex flex-col gap-2 text-zinc-700 dark:text-zinc-300">
                  {section.list.map((item) => (
                    <li key={item} className="flex gap-3 leading-relaxed">
                      <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
