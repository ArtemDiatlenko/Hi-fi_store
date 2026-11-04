import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { AddToCart } from "@/components/add-to-cart";
import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs";
import { ArrowRightIcon } from "@/components/icons";
import { discountPercent, ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product-gallery";
import { ProductMaterials } from "@/components/product-materials";
import {
  type CategoryNode,
  getCategories,
  getProduct,
  getProducts,
  type ProductDetails,
  type ProductSpecValue,
} from "@/lib/api";
import { categoryPath, findCategoryPath } from "@/lib/categories";
import { getDemoMaterials } from "@/lib/demo-content";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";
import { tpl } from "@/lib/i18n/util";
import { CURRENCY, formatNumber, formatPrice } from "@/lib/format";
import { localizedAlternates } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

const RELATED_COUNT = 4;

export default async function ProductPage(props: PageProps<"/[lang]/products/[slug]">) {
  const { dict } = await getI18n();
  return (
    <Suspense fallback={<p className="py-24 text-center text-sm text-zinc-400">{dict.product.loading}</p>}>
      <ProductView params={props.params} />
    </Suspense>
  );
}

export async function generateMetadata(props: PageProps<"/[lang]/products/[slug]">): Promise<Metadata> {
  const { locale, dict } = await getI18n();
  const { slug } = await props.params;
  const product = await getProduct(slug);
  if (!product) {
    return { title: dict.product.fallbackTitle };
  }
  const description = product.shortDescription ?? undefined;
  const image = product.images[0];
  return {
    title: product.name,
    description,
    alternates: localizedAlternates(`/products/${product.slug}`, locale),
    openGraph: {
      type: "website",
      siteName: "Hi-Fi Store",
      title: product.name,
      description,
      url: localeHref(locale, `/products/${product.slug}`),
      images: image ? [{ url: image.url, alt: image.alt ?? product.name }] : undefined,
    },
  };
}

async function ProductView({ params }: { params: Promise<{ slug: string }> }) {
  const { locale, dict } = await getI18n();
  const { slug } = await params;
  const [product, tree] = await Promise.all([
    getProduct(slug),
    // Дерево нужно только для цепочки разделов — без него покажем один раздел товара.
    getCategories().catch((): CategoryNode[] => []),
  ]);
  if (!product) {
    notFound();
  }

  const chain = findCategoryPath(tree, product.category.slug);
  const categoryCrumbs: Crumb[] = (chain.length > 0 ? chain : [product.category]).map((category) => ({
    label: category.name,
    href: localeHref(locale, categoryPath(category.slug)),
  }));
  const crumbs: Crumb[] = [
    { label: dict.breadcrumbs.home, href: localeHref(locale, "/") },
    ...categoryCrumbs,
    { label: product.name },
  ];
  const discount = discountPercent(product.price, product.oldPrice);
  // Демо-наполнение (огляд, відео, догляд, відгуки) — пока у товаров нет своих материалов, см. lib/demo-content.ts.
  const materials = getDemoMaterials(product, locale);

  return (
    <div className="flex flex-col">
      <ProductJsonLd product={product} crumbs={crumbs} locale={locale} />
      <Breadcrumbs items={crumbs} dict={dict} />

      {/* Сцена: аппарат по центру в луче света, под ним — имя, «голос» мастера и покупка. */}
      <article className="relative isolate">
        <div aria-hidden="true" className="absolute inset-x-0 -top-10 -z-10 h-[46rem] motion-safe:animate-flicker-in">
          <div className="stage-glow motion-safe:animate-breathe" />
        </div>

        <div className="mx-auto mt-6 w-full max-w-3xl">
          <ProductGallery images={product.images} name={product.name} slug={product.slug} />
        </div>

        <header className="mx-auto mt-10 flex max-w-3xl flex-col items-center text-center">
          <p className="stage-kicker motion-safe:animate-rise motion-safe:[animation-delay:150ms]">{product.brand.name}</p>
          <h1 className="mt-4 text-5xl leading-[0.95] font-light sm:text-6xl lg:text-7xl motion-safe:animate-rise motion-safe:[animation-delay:250ms]">
            {product.name}
          </h1>
          {product.shortDescription ? (
            <p className="mt-5 max-w-2xl font-display text-xl leading-snug italic text-amber-400 sm:text-2xl motion-safe:animate-rise motion-safe:[animation-delay:350ms]">
              {product.shortDescription}
            </p>
          ) : null}
          <p className="mt-4 text-xs tracking-wide text-zinc-500 motion-safe:animate-rise motion-safe:[animation-delay:400ms]">
            {tpl(dict.product.sku, { sku: product.sku })} ·{" "}
            <Link href={localeHref(locale, categoryPath(product.category.slug))} className="stage-link">
              {product.category.name}
            </Link>
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 motion-safe:animate-rise motion-safe:[animation-delay:500ms]">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-semibold tabular-nums sm:text-4xl">{formatPrice(product.price, locale)}</span>
              {product.oldPrice !== null ? (
                <span className="text-lg text-zinc-400 tabular-nums line-through">
                  <span className="sr-only">{dict.product.oldPrice} </span>
                  {formatPrice(product.oldPrice, locale)}
                </span>
              ) : null}
              {discount !== null ? (
                <span className="self-center rounded-full bg-amber-400 px-2.5 py-0.5 text-sm font-semibold text-zinc-950">
                  <span aria-hidden="true">{tpl(dict.product.discount, { percent: discount })}</span>
                  <span className="sr-only">{tpl(dict.product.discountLabel, { percent: discount })}</span>
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-zinc-300">{dict.conditions[product.condition]}</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${
                  product.stock > 0 ? "border-emerald-400/30 text-emerald-300" : "border-zinc-700 text-zinc-400"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${product.stock > 0 ? "bg-emerald-400 shadow-[0_0_6px_rgb(52_211_153/0.8)]" : "bg-zinc-500"}`}
                />
                {product.stock > 0 ? tpl(dict.product.inStock, { count: product.stock }) : dict.product.outOfStock}
              </span>
            </div>
          </div>

          <div className="mt-7 flex w-full flex-col items-center gap-3 motion-safe:animate-rise motion-safe:[animation-delay:600ms]">
            <AddToCart productId={product.id} stock={product.stock} />
            <Link
              href={localeHref(locale, `/consultation?product=${encodeURIComponent(product.slug)}&topic=Product`)}
              className="stage-link inline-flex min-h-11 items-center text-sm font-medium text-zinc-300"
            >
              {product.stock > 0 ? dict.consultation.askMaker : dict.consultation.wantSimilar}
            </Link>
          </div>
        </header>

        {/* Рассказ мастера: подпись слева, текст справа, каждая часть проявляется при прокрутке. */}
        <div className="mt-20 border-t border-zinc-800">
          {materials ? (
            <StoryRow title={dict.product.highlightsTitle}>
              <ol className="grid gap-6 sm:grid-cols-2">
                {materials.highlights.map((item, index) => (
                  <li key={item} className="grid grid-cols-[2.5rem_1fr] gap-3">
                    <span aria-hidden="true" className="font-display text-2xl leading-none text-amber-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="leading-relaxed text-zinc-300">{item}</span>
                  </li>
                ))}
              </ol>
            </StoryRow>
          ) : null}

          <StoryRow title={dict.product.specsTitle}>
            <SpecTable specs={product.specs} locale={locale} dict={dict} />
          </StoryRow>

          <StoryRow title={dict.product.descriptionTitle}>
            <p className="max-w-[65ch] whitespace-pre-line text-lg leading-relaxed text-zinc-300">{product.description}</p>
          </StoryRow>
        </div>
      </article>

      {materials ? (
        <div className="stage-reveal mt-6">
          <ProductMaterials materials={materials} />
        </div>
      ) : null}

      <Suspense fallback={null}>
        <RelatedProducts product={product} />
      </Suspense>
    </div>
  );
}

/** Одна часть рассказа о товаре: заголовок слева, содержимое справа (на телефоне — друг под другом). */
function StoryRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stage-reveal grid gap-6 border-b border-zinc-800 py-12 md:grid-cols-[15rem_1fr] md:gap-14 lg:py-16">
      <h2 className="text-3xl leading-tight font-light">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

/** Другие товары того же раздела (без текущего). Ошибка API не ломает страницу — блок просто не показывается. */
async function RelatedProducts({ product }: { product: ProductDetails }) {
  const { locale, dict } = await getI18n();
  let items;
  try {
    const result = await getProducts(
      new URLSearchParams({ category: product.category.slug, pageSize: String(RELATED_COUNT + 1) }),
    );
    items = (result?.items ?? []).filter((item) => item.id !== product.id).slice(0, RELATED_COUNT);
  } catch {
    return null;
  }
  if (items.length === 0) {
    return null;
  }

  return (
    <section data-section="related" className="stage-reveal mt-20 border-t border-zinc-800 pt-14">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 className="text-[2rem] leading-tight font-light sm:text-[2.75rem]">
          {dict.product.relatedTitle}
        </h2>
        <Link
          href={localeHref(locale, categoryPath(product.category.slug))}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-amber-400"
        >
          <span className="stage-link">{dict.product.relatedAll}</span>
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <ProductCard product={item} locale={locale} dict={dict} headingLevel={3} sizes="(min-width: 768px) 25vw, 50vw" morph />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Разметка schema.org Product и BreadcrumbList — цена, наличие и путь по разделам для поисковиков. */
function ProductJsonLd({ product, crumbs, locale }: { product: ProductDetails; crumbs: Crumb[]; locale: Locale }) {
  const url = `${SITE_URL}${localeHref(locale, `/products/${product.slug}`)}`;
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      sku: product.sku,
      description: product.shortDescription ?? undefined,
      image: product.images.map((image) => image.url),
      brand: { "@type": "Brand", name: product.brand.name },
      category: product.category.name,
      offers: {
        "@type": "Offer",
        url,
        priceCurrency: CURRENCY,
        price: product.price,
        availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemCondition:
          product.condition === "New" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.label,
        item: crumb.href ? `${SITE_URL}${crumb.href}` : url,
      })),
    },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

function SpecTable({ specs, locale, dict }: { specs: ProductSpecValue[]; locale: Locale; dict: Dictionary }) {
  if (specs.length === 0) {
    return <p className="text-zinc-400">{dict.product.specsEmpty}</p>;
  }

  // Плитки на тонкой сетке: название мелко, значение крупно — как шильдик на задней панели.
  return (
    <dl className="stage-grid grid grid-cols-2 sm:grid-cols-3">
      {specs.map((spec) => (
        <div key={spec.key} className="flex flex-col gap-1.5 bg-zinc-950 px-4 py-4 sm:px-5">
          <dt className="text-xs tracking-wide text-zinc-400">{spec.name}</dt>
          <dd className="font-display text-2xl leading-tight">{formatSpecValue(spec, locale, dict)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatSpecValue(spec: ProductSpecValue, locale: Locale, dict: Dictionary): string {
  if (spec.valueType === "Boolean") {
    return spec.value ? dict.product.boolYes : dict.product.boolNo;
  }
  if (spec.valueType === "Number" && typeof spec.value === "number") {
    return spec.unit ? `${formatNumber(spec.value, locale)} ${spec.unit}` : formatNumber(spec.value, locale);
  }
  return spec.value === null ? dict.product.emptyValue : String(spec.value);
}
