import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddToCart } from "@/components/add-to-cart";
import { getProduct, type ProductDetails, type ProductSpecValue } from "@/lib/api";
import { conditionLabel, formatNumber, formatPrice } from "@/lib/format";

export default function ProductPage(props: PageProps<"/products/[slug]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Загрузка товара…</p>}>
      <ProductView params={props.params} />
    </Suspense>
  );
}

export async function generateMetadata(props: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProduct(slug);
  return { title: product?.name ?? "Товар" };
}

async function ProductView({ params }: { params: Promise<{ slug: string }> }) {
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
          <h1 className="mt-1 text-3xl font-semibold leading-tight">{product.name}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Артикул {product.sku} ·{" "}
            <Link href={`/catalog?category=${product.category.slug}`} className="underline">
              {product.category.name}
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-3xl font-semibold">{formatPrice(product.price)}</span>
          {product.oldPrice !== null ? (
            <span className="text-lg text-zinc-500 line-through">{formatPrice(product.oldPrice)}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">{conditionLabel(product.condition)}</span>
          <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
            {product.stock > 0 ? `В наличии: ${product.stock} шт.` : "Нет в наличии"}
          </span>
        </div>

        <AddToCart productId={product.id} stock={product.stock} />

        {product.shortDescription ? <p className="text-zinc-700 dark:text-zinc-300">{product.shortDescription}</p> : null}

        <section>
          <h2 className="mb-3 text-lg font-medium">Характеристики</h2>
          <SpecTable specs={product.specs} />
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium">Описание</h2>
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

function SpecTable({ specs }: { specs: ProductSpecValue[] }) {
  if (specs.length === 0) {
    return <p className="text-sm text-zinc-500">Характеристики не указаны.</p>;
  }

  return (
    <dl className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
      {specs.map((spec) => (
        <div key={spec.key} className="flex justify-between gap-4 py-2">
          <dt className="text-zinc-500">{spec.name}</dt>
          <dd className="text-right font-medium">{formatSpecValue(spec)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatSpecValue(spec: ProductSpecValue): string {
  if (spec.valueType === "Boolean") {
    return spec.value ? "Да" : "Нет";
  }
  if (spec.valueType === "Number" && typeof spec.value === "number") {
    return spec.unit ? `${formatNumber(spec.value)} ${spec.unit}` : formatNumber(spec.value);
  }
  return spec.value === null ? "—" : String(spec.value);
}
