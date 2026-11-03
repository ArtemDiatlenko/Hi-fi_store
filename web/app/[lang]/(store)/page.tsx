import type { Metadata } from "next";
import Link from "next/link";
import { cache, type ReactNode, Suspense } from "react";
import {
  ArrowRightIcon,
  CategoryIcon,
  HeadsetIcon,
  ShieldIcon,
  TruckIcon,
  WalletIcon,
} from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { type CategoryNode, getCategories, getFacets, getProducts, type ProductListItem } from "@/lib/api";
import { categoryPath } from "@/lib/categories";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

const NEW_ARRIVALS = 8;
const SALE_ITEMS = 8;
// В API нет фильтра «со скидкой», поэтому скидки ищем среди последних поступлений.
const SALE_SCAN = 100;

const productGrid = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4";
const productSizes = "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, dict } = await getI18n();
  return pageMetadata({
    title: dict.home.metaTitle,
    description: dict.home.metaDescription,
    path: "/",
    locale,
    absoluteTitle: true,
  });
}

/** Последние товары одним запросом — из них берутся и «Новинки», и «Знижки». */
const getLatestProducts = cache(async (): Promise<ProductListItem[]> => {
  const query = new URLSearchParams({ sort: "newest", pageSize: String(SALE_SCAN) });
  const result = await getProducts(query);
  return result?.items ?? [];
});

export default async function HomePage() {
  const { locale, dict } = await getI18n();

  // Разметка WebSite с поиском по каталогу — для расширенного сниппета в поисковиках.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: dict.common.brand,
    url: `${SITE_URL}${localeHref(locale, "/")}`,
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}${localeHref(locale, "/catalog")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="flex flex-col gap-16 lg:gap-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <Hero />

      <section aria-labelledby="home-categories">
        <SectionHeader
          id="home-categories"
          title={dict.home.categoriesTitle}
          link={{ href: localeHref(locale, "/catalog"), label: dict.home.categoriesAll }}
        />
        <Suspense fallback={<TilesSkeleton label={dict.common.loading} />}>
          <CategoryTiles />
        </Suspense>
      </section>

      <Suspense fallback={<ProductsSkeleton label={dict.common.loading} />}>
        <ProductSections />
      </Suspense>

      <Suspense fallback={null}>
        <BrandsStrip />
      </Suspense>

      <WhyUs />

      <section aria-labelledby="home-consultation" className="flex flex-col items-start gap-5 rounded-3xl bg-amber-50 p-6 sm:p-10 dark:bg-amber-400/10">
        <HeadsetIcon className="h-8 w-8 text-amber-700 dark:text-amber-300" />
        <h2 id="home-consultation" className="text-2xl font-semibold tracking-tight sm:text-3xl">{dict.consultation.ctaTitle}</h2>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-300">{dict.consultation.ctaText}</p>
        <Link href={localeHref(locale, "/consultation")} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-zinc-900 px-6 font-semibold text-white hover:bg-zinc-700 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-amber-300">
          {dict.consultation.ctaButton}
          <ArrowRightIcon className="h-5 w-5" />
        </Link>
      </section>
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────────────────── */

async function Hero() {
  const { locale, dict } = await getI18n();
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden rounded-3xl bg-zinc-950 px-6 py-12 text-white ring-1 ring-zinc-900 [color-scheme:dark] dark:ring-zinc-800 sm:px-10 sm:py-16 lg:px-14 lg:py-20"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(48rem_28rem_at_88%_10%,rgba(251,191,36,0.18),transparent_65%),radial-gradient(36rem_24rem_at_0%_110%,rgba(113,113,122,0.28),transparent_65%)]"
      />
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400 sm:text-sm">{dict.home.heroEyebrow}</p>
          <h1 id="hero-title" className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {dict.home.heroTitle}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">{dict.home.heroText}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={localeHref(locale, "/catalog")}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-amber-400 px-6 font-semibold text-zinc-950 transition-colors hover:bg-amber-300"
            >
              {dict.home.heroCta}
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
            <Link
              href={localeHref(locale, "/catalog?sort=newest")}
              className="inline-flex min-h-12 items-center rounded-full border border-zinc-700 px-6 font-medium text-white transition-colors hover:border-zinc-500 hover:bg-white/5"
            >
              {dict.home.heroSecondary}
            </Link>
          </div>
        </div>
        <HeroArt />
      </div>
    </section>
  );
}

/** Декоративная пластинка с тонармом (SVG, без внешних изображений). */
function HeroArt() {
  const grooves = [176, 162, 148, 134, 120, 106, 92];
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 400 400" className="hidden w-full lg:block">
      <defs>
        <radialGradient id="hero-disc" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#27272a" />
          <stop offset="100%" stopColor="#09090b" />
        </radialGradient>
        <linearGradient id="hero-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="190" cy="210" r="186" fill="url(#hero-disc)" stroke="#3f3f46" strokeWidth="2" />
      {grooves.map((r) => (
        <circle key={r} cx="190" cy="210" r={r} fill="none" stroke="#3f3f46" strokeOpacity="0.55" strokeWidth="1" />
      ))}
      <circle cx="190" cy="210" r="186" fill="url(#hero-sheen)" />
      <circle cx="190" cy="210" r="62" fill="#f59e0b" />
      <circle cx="190" cy="210" r="62" fill="none" stroke="#fbbf24" strokeWidth="2" />
      <circle cx="190" cy="210" r="40" fill="none" stroke="#b45309" strokeOpacity="0.6" strokeWidth="1.5" />
      <circle cx="190" cy="210" r="7" fill="#09090b" />
      {/* Тонарм */}
      <circle cx="356" cy="52" r="22" fill="#18181b" stroke="#52525b" strokeWidth="2" />
      <circle cx="356" cy="52" r="8" fill="#a1a1aa" />
      <path d="M356 52 L340 250 L268 318" fill="none" stroke="#d4d4d8" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="248" y="306" width="34" height="20" rx="4" transform="rotate(-42 265 316)" fill="#e4e4e7" />
    </svg>
  );
}

/* ── Общие элементы секций ────────────────────────────────────────────────────────────── */

function SectionHeader({
  id,
  title,
  text,
  link,
}: {
  id: string;
  title: string;
  text?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 sm:mb-8">
      <div>
        <h2 id={id} className="scroll-mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {text ? <p className="mt-1.5 text-zinc-600 dark:text-zinc-400">{text}</p> : null}
      </div>
      {link ? (
        <Link href={link.href} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent hover:underline">
          {link.label}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/70 ${className}`} />;
}

function TilesSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-48" />
        ))}
      </div>
    </div>
  );
}

function ProductsSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        <Skeleton className="mb-8 h-9 w-48" />
        <div className={productGrid}>
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="aspect-[3/4]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
      {children}
    </p>
  );
}

/* ── Разделы каталога ─────────────────────────────────────────────────────────────────── */

async function CategoryTiles() {
  const { locale, dict } = await getI18n();
  let tree: CategoryNode[];
  try {
    tree = await getCategories();
  } catch {
    return <Notice>{dict.home.unavailable}</Notice>;
  }
  if (tree.length === 0) {
    return null;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tree.map((node) => (
        <li
          key={node.id}
          className="group relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 transition-[border-color,box-shadow] duration-200 hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-900/5 has-[h3_a:focus-visible]:ring-2 has-[h3_a:focus-visible]:ring-focus-ring dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:shadow-black/30"
        >
          <div className="flex items-start justify-between">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 transition-colors group-hover:bg-amber-100 group-hover:text-amber-900 dark:bg-zinc-800 dark:text-zinc-200 dark:group-hover:bg-amber-400/15 dark:group-hover:text-amber-300">
              <CategoryIcon slug={node.slug} name={node.name} className="h-7 w-7" />
            </span>
            <ArrowRightIcon className="h-5 w-5 text-zinc-400 transition-transform duration-200 group-hover:text-accent motion-safe:group-hover:translate-x-1" />
          </div>
          <h3 className="mt-5 text-lg font-semibold">
            <Link
              href={localeHref(locale, categoryPath(node.slug))}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl after:content-['']"
            >
              {node.name}
            </Link>
          </h3>
          {node.children.length > 0 ? (
            <ul className="relative z-10 mt-3 flex flex-wrap gap-2">
              {node.children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={localeHref(locale, categoryPath(child.slug))}
                    className="inline-flex min-h-8 items-center rounded-full border border-zinc-200 bg-white px-3 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white"
                  >
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/* ── Новинки и скидки ─────────────────────────────────────────────────────────────────── */

async function ProductSections() {
  const { locale, dict } = await getI18n();
  let latest: ProductListItem[];
  try {
    latest = await getLatestProducts();
  } catch {
    // Недоступность API уже показана в блоке разделов — здесь просто пропускаем секции.
    return null;
  }
  if (latest.length === 0) {
    return null;
  }

  const newArrivals = latest.slice(0, NEW_ARRIVALS);
  const sale = latest.filter((product) => product.oldPrice !== null && product.oldPrice > product.price).slice(0, SALE_ITEMS);

  return (
    <>
      <section aria-labelledby="home-new">
        <SectionHeader
          id="home-new"
          title={dict.home.newTitle}
          text={dict.home.newText}
          link={{ href: localeHref(locale, "/catalog?sort=newest"), label: dict.home.newAll }}
        />
        <ul className={productGrid}>
          {newArrivals.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} locale={locale} dict={dict} headingLevel={3} sizes={productSizes} />
            </li>
          ))}
        </ul>
      </section>

      {sale.length > 0 ? (
        <section aria-labelledby="home-sale" className="rounded-3xl bg-amber-50 p-5 sm:p-8 lg:p-10 dark:bg-amber-400/[0.06]">
          <SectionHeader id="home-sale" title={dict.home.saleTitle} text={dict.home.saleText} />
          <ul className={productGrid}>
            {sale.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} locale={locale} dict={dict} headingLevel={3} sizes={productSizes} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/* ── Бренды ───────────────────────────────────────────────────────────────────────────── */

async function BrandsStrip() {
  const { locale, dict } = await getI18n();
  let brands;
  try {
    brands = (await getFacets())?.brands ?? [];
  } catch {
    return null;
  }
  if (brands.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="home-brands"
      className="grid gap-6 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 lg:grid-cols-[18rem_1fr] lg:items-center lg:p-10 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div>
        <h2 id="home-brands" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {dict.home.brandsTitle}
        </h2>
        <p className="mt-1.5 text-zinc-600 dark:text-zinc-400">{dict.home.brandsText}</p>
      </div>
      <ul className="flex flex-wrap gap-3">
        {brands.map((brand) => (
          <li key={brand.slug}>
            <Link
              href={localeHref(locale, `/catalog?brand=${encodeURIComponent(brand.slug)}`)}
              className="inline-flex min-h-12 items-center rounded-xl border border-zinc-200 px-5 text-base font-semibold tracking-wide text-zinc-800 transition-colors hover:border-zinc-900 hover:bg-zinc-900 hover:text-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-amber-400 dark:hover:bg-amber-400 dark:hover:text-zinc-950"
            >
              {brand.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Почему мы ────────────────────────────────────────────────────────────────────────── */

async function WhyUs() {
  const { locale, dict } = await getI18n();
  const items = [
    { icon: TruckIcon, title: dict.home.deliveryTitle, text: dict.home.deliveryText, href: "/info/delivery" },
    { icon: WalletIcon, title: dict.home.paymentTitle, text: dict.home.paymentText, href: "/info/delivery" },
    { icon: ShieldIcon, title: dict.home.warrantyTitle, text: dict.home.warrantyText, href: "/info/returns" },
    { icon: HeadsetIcon, title: dict.home.consultTitle, text: dict.home.consultText, href: "/consultation" },
  ];

  return (
    <section aria-labelledby="home-why">
      <SectionHeader id="home-why" title={dict.home.whyTitle} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text, href }) => (
          <li key={title} className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-950 text-amber-400 dark:bg-amber-400/15 dark:text-amber-300">
              <Icon className="h-6 w-6" />
            </span>
            <h3 className="mt-5 text-lg font-semibold">{title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{text}</p>
            <Link href={localeHref(locale, href)} className="mt-4 inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              {dict.home.learnMore}
              <span className="sr-only">: {title}</span>
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
