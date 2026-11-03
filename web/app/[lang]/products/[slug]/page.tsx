import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddToCart } from "@/components/add-to-cart";
import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs";
import { ArrowRightIcon } from "@/components/icons";
import { discountPercent, ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product-gallery";
import {
  type CategoryNode,
  getCategories,
  getProduct,
  getProducts,
  type ProductDetails,
  type ProductSpecValue,
} from "@/lib/api";
import { categoryPath, findCategoryPath } from "@/lib/categories";
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
    <Suspense fallback={<p className="text-sm text-zinc-600 dark:text-zinc-400">{dict.product.loading}</p>}>
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

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <ProductJsonLd product={product} crumbs={crumbs} locale={locale} />
      <Breadcrumbs items={crumbs} dict={dict} />

      <article className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={product.images} name={product.name} />

        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{product.brand.name}</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl lg:text-4xl">{product.name}</h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {tpl(dict.product.sku, { sku: product.sku })} ·{" "}
              <Link href={localeHref(locale, categoryPath(product.category.slug))} className="underline hover:text-zinc-900 dark:hover:text-zinc-100">
                {product.category.name}
              </Link>
            </p>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <span className="text-3xl font-semibold tabular-nums sm:text-4xl">{formatPrice(product.price, locale)}</span>
            {product.oldPrice !== null ? (
              <span className="text-lg text-zinc-600 tabular-nums line-through dark:text-zinc-400">
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

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border border-zinc-300 px-3 py-1 dark:border-zinc-700">{dict.conditions[product.condition]}</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${
                product.stock > 0
                  ? "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300"
                  : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              }`}
            >
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${product.stock > 0 ? "bg-emerald-600 dark:bg-emerald-400" : "bg-zinc-400"}`} />
              {product.stock > 0 ? tpl(dict.product.inStock, { count: product.stock }) : dict.product.outOfStock}
            </span>
          </div>

          <AddToCart productId={product.id} stock={product.stock} />

          {product.shortDescription ? <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">{product.shortDescription}</p> : null}

          <section aria-labelledby="product-specs">
            <h2 id="product-specs" className="mb-3 text-lg font-semibold">
              {dict.product.specsTitle}
            </h2>
            <SpecTable specs={product.specs} locale={locale} dict={dict} />
          </section>

          <section aria-labelledby="product-description">
            <h2 id="product-description" className="mb-2 text-lg font-semibold">
              {dict.product.descriptionTitle}
            </h2>
            <p className="whitespace-pre-line leading-relaxed text-zinc-700 dark:text-zinc-300">{product.description}</p>
          </section>
        </div>
      </article>

      <Suspense fallback={null}>
        <RelatedProducts product={product} />
      </Suspense>
    </div>
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
    <section aria-labelledby="related-products" className="border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 id="related-products" className="text-2xl font-semibold tracking-tight">
          {dict.product.relatedTitle}
        </h2>
        <Link
          href={localeHref(locale, categoryPath(product.category.slug))}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          {dict.product.relatedAll}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <ProductCard product={item} locale={locale} dict={dict} headingLevel={3} sizes="(min-width: 768px) 25vw, 50vw" />
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
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">{dict.product.specsEmpty}</p>;
  }

  return (
    <dl className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {specs.map((spec) => (
        <div key={spec.key} className="flex justify-between gap-4 px-4 py-2.5">
          <dt className="text-zinc-600 dark:text-zinc-400">{spec.name}</dt>
          <dd className="text-right font-medium">{formatSpecValue(spec, locale, dict)}</dd>
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
