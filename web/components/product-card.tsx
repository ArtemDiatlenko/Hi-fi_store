import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "@/lib/api";
import { conditionLabel, formatPrice } from "@/lib/format";

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <Link href={`/products/${product.slug}`} className="relative aspect-4/3 bg-zinc-100 dark:bg-zinc-800">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover"
          />
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{product.brand.name}</p>
        <Link href={`/products/${product.slug}`} className="font-medium leading-snug hover:underline">
          {product.name}
        </Link>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-sm">
          <span className="text-base font-semibold">{formatPrice(product.price)}</span>
          {product.oldPrice !== null ? (
            <span className="text-zinc-500 line-through">{formatPrice(product.oldPrice)}</span>
          ) : null}
          <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
            {conditionLabel(product.condition)}
          </span>
        </div>
        {!product.inStock ? <p className="text-xs text-zinc-500">Нет в наличии</p> : null}
      </div>
    </article>
  );
}
