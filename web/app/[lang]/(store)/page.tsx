import type { Metadata } from "next";
import Image from "next/image";
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
import { formatPrice } from "@/lib/format";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

const NEW_ARRIVALS = 8;
const SALE_ITEMS = 8;
// В API нет фильтра «со скидкой», поэтому скидки ищем среди последних поступлений.
const SALE_SCAN = 100;

const productGrid = "grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-14 md:grid-cols-3 lg:grid-cols-4";
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

/** Последние товары одним запросом — из них берутся аппарат на сцене, «Новинки» и «Знижки». */
const getLatestProducts = cache(async (): Promise<ProductListItem[]> => {
  const query = new URLSearchParams({ sort: "newest", pageSize: String(SALE_SCAN) });
  const result = await getProducts(query);
  return result?.items ?? [];
});

/**
 * Главная в духе «сцены»: аппарат стоит в луче тёплого света на чёрном полу с отражением,
 * дальше — разделы, новинки, слово мастера и условия покупки. Блоки проявляются при прокрутке.
 */
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
    <div className="flex flex-col gap-24 lg:gap-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <Hero />

      <section aria-labelledby="home-categories" className="stage-reveal">
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

      <MakerWord />

      <Suspense fallback={null}>
        <BrandsStrip />
      </Suspense>

      <WhyUs />
    </div>
  );
}

/* ── Сцена ────────────────────────────────────────────────────────────────────────────── */

async function Hero() {
  const { locale, dict } = await getI18n();
  return (
    <section aria-labelledby="hero-title" className="relative isolate -mx-4 -mt-8 px-4 pt-6 text-center sm:-mx-6 sm:px-6 lg:-mt-10">
      {/* Луч света над сценой: загорается с мерцанием, как разогретые лампы, и дальше медленно «дышит». */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 motion-safe:animate-flicker-in">
        <div className="stage-glow motion-safe:animate-breathe" />
      </div>

      <Suspense fallback={<div aria-hidden="true" className="mx-auto aspect-4/3 w-full max-w-[40rem]" />}>
        <HeroStage />
      </Suspense>

      <div className="relative mx-auto mt-6 max-w-3xl">
        <p className="stage-kicker motion-safe:animate-rise motion-safe:[animation-delay:200ms]">{dict.home.heroEyebrow}</p>
        <h1
          id="hero-title"
          className="mt-5 text-[2.75rem] leading-[0.98] font-light sm:text-6xl lg:text-7xl motion-safe:animate-rise motion-safe:[animation-delay:350ms]"
        >
          {dict.home.heroTitle} <em className="text-amber-400">{dict.home.heroTitleAccent}</em>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg motion-safe:animate-rise motion-safe:[animation-delay:500ms]">
          {dict.home.heroText}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3 motion-safe:animate-rise motion-safe:[animation-delay:650ms]">
          <Link href={localeHref(locale, "/catalog")} className="stage-button">
            {dict.home.heroCta}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link href={localeHref(locale, "/consultation")} className="stage-button-ghost">
            {dict.home.heroSecondary}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Аппарат на сцене: последний товар с фото (лучше — в наличии). Без API сцена просто пустая. */
async function HeroStage() {
  const { locale, dict } = await getI18n();
  let latest: ProductListItem[];
  try {
    latest = await getLatestProducts();
  } catch {
    return <div aria-hidden="true" className="mx-auto aspect-[4/2] w-full max-w-[40rem]" />;
  }
  const featured = latest.find((product) => product.imageUrl && product.inStock) ?? latest.find((product) => product.imageUrl);
  if (!featured?.imageUrl) {
    return <div aria-hidden="true" className="mx-auto aspect-[4/2] w-full max-w-[40rem]" />;
  }

  return (
    <figure className="group mx-auto w-full max-w-[40rem]">
      <Link href={localeHref(locale, `/products/${featured.slug}`)} className="relative block rounded-sm">
        <span className="stage-floor" aria-hidden="true" />
        <span className="stage-reflect relative block aspect-4/3 overflow-hidden bg-zinc-950 motion-safe:animate-[rise_1.2s_cubic-bezier(0.2,0.7,0.2,1)_both]">
          <Image
            src={featured.imageUrl}
            alt={featured.name}
            fill
            preload
            sizes="(min-width: 768px) 40rem, 100vw"
            className="stage-vignette object-cover transition-transform duration-[1.2s] ease-out motion-safe:group-hover:scale-[1.02]"
          />
        </span>
      </Link>
      {/* Подпись стоит чуть ниже, оставляя место короткому отражению. */}
      <figcaption className="relative mt-[7%] flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-sm text-zinc-400 motion-safe:animate-rise motion-safe:[animation-delay:900ms]">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">{dict.home.heroFeatured}</span>
        <Link href={localeHref(locale, `/products/${featured.slug}`)} className="stage-link font-display text-lg text-zinc-200">
          {featured.name}
        </Link>
        <span className="tabular-nums">{formatPrice(featured.price, locale)}</span>
      </figcaption>
    </figure>
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-10">
      <div>
        <h2 id={id} className="scroll-mt-24 text-[2rem] leading-tight font-light sm:text-[2.75rem]">
          {title}
        </h2>
        {text ? <p className="mt-2 text-zinc-400">{text}</p> : null}
      </div>
      {link ? (
        <Link href={link.href} className="group/more inline-flex min-h-11 items-center gap-2 text-sm font-medium tracking-wide text-amber-400">
          <span className="stage-link">{link.label}</span>
          <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover/more:translate-x-1" />
        </Link>
      ) : null}
    </div>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-sm bg-zinc-900 ${className}`} />;
}

function TilesSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-44" />
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
        <Skeleton className="mb-10 h-10 w-56" />
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
    <p role="status" className="border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
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
    <ul className="stage-grid grid sm:grid-cols-2 lg:grid-cols-4">
      {tree.map((node) => (
        <li
          key={node.id}
          className="group relative flex min-h-44 flex-col bg-zinc-950 p-6 transition-colors duration-500 hover:bg-zinc-900 has-[h3_a:focus-visible]:outline-2 has-[h3_a:focus-visible]:outline-focus-ring"
        >
          {/* Полоска света по верхнему краю — «включается» при наведении. */}
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-amber-400 transition-transform duration-500 group-hover:scale-x-100" />
          <div className="flex items-start justify-between">
            <CategoryIcon slug={node.slug} name={node.name} className="h-7 w-7 text-zinc-500 transition-colors duration-500 group-hover:text-amber-400" />
            <ArrowRightIcon className="h-5 w-5 text-zinc-600 transition-[color,transform] duration-300 group-hover:text-amber-400 motion-safe:group-hover:translate-x-1" />
          </div>
          <h3 className="mt-auto pt-8 font-display text-[1.625rem] leading-tight">
            <Link href={localeHref(locale, categoryPath(node.slug))} className="outline-none after:absolute after:inset-0 after:content-['']">
              {node.name}
            </Link>
          </h3>
          {node.children.length > 0 ? (
            <ul className="relative z-10 mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {node.children.map((child) => (
                <li key={child.id}>
                  <Link href={localeHref(locale, categoryPath(child.slug))} className="stage-link inline-flex min-h-8 items-center text-zinc-400">
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
        <div className="stage-reveal">
          <SectionHeader
            id="home-new"
            title={dict.home.newTitle}
            text={dict.home.newText}
            link={{ href: localeHref(locale, "/catalog?sort=newest"), label: dict.home.newAll }}
          />
        </div>
        <ul className={productGrid}>
          {newArrivals.map((product) => (
            <li key={product.id} className="stage-reveal">
              <ProductCard product={product} locale={locale} dict={dict} headingLevel={3} sizes={productSizes} morph />
            </li>
          ))}
        </ul>
      </section>

      {sale.length > 0 ? (
        <section aria-labelledby="home-sale" className="border-t border-zinc-800 pt-16">
          <div className="stage-reveal">
            <SectionHeader id="home-sale" title={dict.home.saleTitle} text={dict.home.saleText} />
          </div>
          <ul className={productGrid}>
            {sale.map((product) => (
              <li key={product.id} className="stage-reveal">
                <ProductCard product={product} locale={locale} dict={dict} headingLevel={3} sizes={productSizes} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/* ── Слово мастера ────────────────────────────────────────────────────────────────────── */

async function MakerWord() {
  const { locale, dict } = await getI18n();
  return (
    <section
      aria-labelledby="home-maker"
      className="stage-reveal relative isolate grid gap-10 border-y border-zinc-800 py-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:py-24"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(40%_60%_at_20%_50%,rgb(255_160_70/0.07),transparent_70%)]" />
      <h2 id="home-maker" className="sr-only">
        {dict.consultation.ctaTitle}
      </h2>
      <blockquote className="relative pl-8 font-display text-[1.75rem] leading-snug font-light italic text-zinc-100 sm:text-[2.25rem]">
        <span aria-hidden="true" className="absolute -top-4 left-0 font-display text-7xl leading-none text-amber-400/70">
          “
        </span>
        {dict.home.makerQuote}
      </blockquote>
      <div className="flex flex-col items-start gap-5">
        <p className="leading-relaxed text-zinc-400">{dict.home.makerText}</p>
        <p className="font-display text-2xl">{dict.consultation.ctaTitle}</p>
        <p className="leading-relaxed text-zinc-400">{dict.consultation.ctaText}</p>
        <Link href={localeHref(locale, "/consultation")} className="stage-button-ghost">
          <HeadsetIcon className="h-5 w-5" />
          {dict.consultation.ctaButton}
        </Link>
      </div>
    </section>
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
    <section aria-labelledby="home-brands" className="stage-reveal grid gap-6 lg:grid-cols-[18rem_1fr] lg:items-center">
      <div>
        <h2 id="home-brands" className="text-[2rem] leading-tight font-light sm:text-[2.75rem]">
          {dict.home.brandsTitle}
        </h2>
        <p className="mt-2 text-zinc-400">{dict.home.brandsText}</p>
      </div>
      <ul className="flex flex-wrap items-center gap-x-10 gap-y-4">
        {brands.map((brand) => (
          <li key={brand.slug}>
            <Link
              href={localeHref(locale, `/catalog?brand=${encodeURIComponent(brand.slug)}`)}
              className="inline-flex min-h-12 items-center font-display text-3xl tracking-wide text-zinc-500 transition-[color,text-shadow] duration-500 hover:text-amber-400 hover:[text-shadow:0_0_24px_rgb(255_177_92/0.45)]"
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
    <section aria-labelledby="home-why" className="stage-reveal">
      <SectionHeader id="home-why" title={dict.home.whyTitle} />
      <ul className="stage-grid grid sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text, href }) => (
          <li key={title} className="group flex flex-col bg-zinc-950 p-6 transition-colors duration-500 hover:bg-zinc-900">
            <Icon className="h-7 w-7 text-amber-400 drop-shadow-[0_0_8px_rgb(255_177_92/0.45)]" />
            <h3 className="mt-6 font-display text-2xl leading-tight">{title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{text}</p>
            <Link href={localeHref(locale, href)} className="mt-5 inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-amber-400">
              <span className="stage-link">{dict.home.learnMore}</span>
              <span className="sr-only">: {title}</span>
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
