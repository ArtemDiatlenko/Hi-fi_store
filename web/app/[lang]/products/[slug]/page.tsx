import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddToCart } from "@/components/add-to-cart";
import { getProduct, type ProductDetails, type ProductSpecValue } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";
import { tpl } from "@/lib/i18n/util";
import { formatNumber, formatPrice } from "@/lib/format";

export default async function ProductPage(props: PageProps<"/[lang]/products/[slug]">) {
  const { dict } = await getI18n();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{dict.product.loading}</p>}>
      <ProductView params={props.params} />
    </Suspense>
  );
}

export async function generateMetadata(props: PageProps<"/[lang]/products/[slug]">): Promise<Metadata> {
  const { dict } = await getI18n();
  const { slug } = await props.params;
  const product = await getProduct(slug);
  return { title: product?.name ?? dict.product.fallbackTitle };
}

async function ProductView({ params }: { params: Promise<{ slug: string }> }) {
  const { locale, dict } = await getI18n();
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) {
    notFound();
  }

  return (
    <article className="grid gap-10 lg:grid-cols-2">
      <Gallery product={product} />

      <div className="flex flex-col gap-6">
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">{product.brand.name}</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight sm:text-3xl">{product.name}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {tpl(dict.product.sku, { sku: product.sku })} ·{" "}
            <Link href={localeHref(locale, `/catalog?category=${product.category.slug}`)} className="underline">
              {product.category.name}
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-3xl font-semibold">{formatPrice(product.price, locale)}</span>
          {product.oldPrice !== null ? (
            <span className="text-lg text-zinc-500 line-through">{formatPrice(product.oldPrice, locale)}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">{dict.conditions[product.condition]}</span>
          <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
            {product.stock > 0 ? tpl(dict.product.inStock, { count: product.stock }) : dict.product.outOfStock}
          </span>
        </div>

        <AddToCart productId={product.id} stock={product.stock} />

        {product.shortDescription ? <p className="text-zinc-700 dark:text-zinc-300">{product.shortDescription}</p> : null}

        <section>
          <h2 className="mb-3 text-lg font-medium">{dict.product.specsTitle}</h2>
          <SpecTable specs={product.specs} locale={locale} dict={dict} />
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium">{dict.product.descriptionTitle}</h2>
          <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{product.description}</p>
        </section>
      </div>
    </article>
  );
}

function Gallery({ product }: { product: ProductDetails }) {
  const image = product.images[0];
  return (
    <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
      {image ? (
        <Image src={image.url} alt={image.alt ?? product.name} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" priority />
      ) : null}
    </div>
  );
}

function SpecTable({ specs, locale, dict }: { specs: ProductSpecValue[]; locale: Locale; dict: Dictionary }) {
  if (specs.length === 0) {
    return <p className="text-sm text-zinc-500">{dict.product.specsEmpty}</p>;
  }

  return (
    <dl className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
      {specs.map((spec) => (
        <div key={spec.key} className="flex justify-between gap-4 py-2">
          <dt className="text-zinc-500">{spec.name}</dt>
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
