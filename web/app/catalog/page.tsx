import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogFilters } from "@/components/catalog-filters";
import { Pagination } from "@/components/pagination";
import { ProductCard } from "@/components/product-card";
import { ApiValidationError, getCategories, getFacets, getProducts } from "@/lib/api";
import { firstValue, type SearchParams, toURLSearchParams } from "@/lib/query";

export const metadata: Metadata = {
  title: "Каталог",
};

export default function CatalogPage(props: PageProps<"/catalog">) {
  return (
    <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
      <Suspense fallback={<p className="text-sm text-zinc-500">Загрузка фильтров…</p>}>
        <CatalogView searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function CatalogView({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = toURLSearchParams(params);
  const categorySlug = firstValue(params.category)?.trim() || undefined;

  let result;
  try {
    const [categories, facets, products] = await Promise.all([
      getCategories(),
      getFacets(categorySlug),
      getProducts(query),
    ]);

    if (!facets || !products) {
      notFound();
    }

    result = { categories, facets, products };
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return <InvalidFilters errors={error.errors} />;
    }
    throw error;
  }

  const { categories, facets, products } = result;

  return (
    <>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <CatalogFilters categories={categories} facets={facets} params={params} />
      </aside>

      <section className="flex flex-col gap-6">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold">Каталог</h1>
          <p className="text-sm text-zinc-500">Найдено товаров: {products.totalCount}</p>
        </header>

        {products.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
            По этим условиям товаров нет. Попробуйте изменить фильтры.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {products.items.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}

        <Pagination page={products.page} totalPages={products.totalPages} params={params} />
      </section>
    </>
  );
}

function InvalidFilters({ errors }: { errors: Record<string, string[]> }) {
  return (
    <div className="lg:col-span-2 rounded-xl border border-red-300 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="mb-2 font-medium">Не удалось применить фильтры:</p>
      <ul className="list-disc pl-5">
        {Object.entries(errors).flatMap(([name, messages]) =>
          messages.map((message) => (
            <li key={`${name}-${message}`}>
              <code>{name}</code>: {message}
            </li>
          )),
        )}
      </ul>
    </div>
  );
}
