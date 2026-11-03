import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs";
import { CatalogFilters } from "@/components/catalog-filters";
import { FiltersPanel } from "@/components/filters-panel";
import { SearchIcon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { ProductCard } from "@/components/product-card";
import { ApiValidationError, type CategoryNode, getCategories, getFacets, getProducts } from "@/lib/api";
import { categoryPath, findCategoryPath } from "@/lib/categories";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";
import { tpl } from "@/lib/i18n/util";
import { firstValue, type SearchParams, toURLSearchParams } from "@/lib/query";
import { localizedAlternates } from "@/lib/seo";

// Параметры, которые не сужают выборку: если кроме них ничего нет, «сбрасывать» нечего.
const NON_FILTER_PARAMS = new Set(["category", "sort", "page", "pageSize"]);

export async function generateMetadata(props: PageProps<"/[lang]/catalog">): Promise<Metadata> {
  const { locale, dict } = await getI18n();
  const params = await props.searchParams;
  const categorySlug = firstValue(params.category)?.trim();
  const q = firstValue(params.q)?.trim();

  if (categorySlug) {
    const tree = await getCategories().catch((): CategoryNode[] => []);
    const category = findCategoryPath(tree, categorySlug).at(-1);
    if (category) {
      return { title: category.name, alternates: localizedAlternates(categoryPath(category.slug), locale) };
    }
  }
  if (q) {
    // Результаты поиска не индексируем: бесконечное число адресов без собственного контента.
    return { title: tpl(dict.catalog.searchTitle, { q }), robots: { index: false, follow: true } };
  }
  return { title: dict.catalog.title, alternates: localizedAlternates("/catalog", locale) };
}

export default async function CatalogPage(props: PageProps<"/[lang]/catalog">) {
  const { dict } = await getI18n();
  return (
    <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[17rem_1fr]">
      <Suspense fallback={<p className="text-sm text-zinc-600 dark:text-zinc-400">{dict.catalog.loadingFilters}</p>}>
        <CatalogView searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function CatalogView({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { locale, dict } = await getI18n();
  const params = await searchParams;
  const query = toURLSearchParams(params);
  const categorySlug = firstValue(params.category)?.trim() || undefined;
  const q = query.get("q")?.trim() || undefined;

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
  const catalogHref = localeHref(locale, "/catalog");
  const chain = categorySlug ? findCategoryPath(categories, categorySlug) : [];
  const category = chain.at(-1);

  const crumbs: Crumb[] = [
    { label: dict.breadcrumbs.home, href: localeHref(locale, "/") },
    { label: dict.catalog.title, href: catalogHref },
    ...chain.map((node) => ({ label: node.name, href: localeHref(locale, categoryPath(node.slug)) })),
  ];
  const title = category?.name ?? (q ? tpl(dict.catalog.searchTitle, { q }) : dict.catalog.title);
  // Последний элемент — текущая страница; на странице поиска добавляем её отдельным звеном.
  if (!category && q) {
    crumbs.push({ label: title });
  }

  // Сброс фильтров оставляет выбранный раздел (если он есть) — иначе ведёт на весь каталог.
  const resetHref = category ? localeHref(locale, categoryPath(category.slug)) : catalogHref;
  const hasFilters = [...query.keys()].some((name) => !NON_FILTER_PARAMS.has(name));

  return (
    <>
      <header className="flex flex-col gap-4 lg:col-span-2">
        <Breadcrumbs items={crumbs} dict={dict} />
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
            {tpl(dict.catalog.found, { count: products.totalCount })}
          </p>
        </div>
        {category && category.children.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label={dict.catalog.section}>
            {category.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={localeHref(locale, categoryPath(child.slug))}
                  className="inline-flex min-h-9 items-center rounded-full border border-zinc-300 bg-white px-4 text-sm text-zinc-700 hover:border-zinc-500 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <aside className="lg:self-start">
        <FiltersPanel>
          {/* key: при переходе по новому адресу (например, поиск из шапки) форма пересоздаётся с новыми значениями. */}
          <CatalogFilters key={query.toString()} categories={categories} facets={facets} params={params} />
        </FiltersPanel>
      </aside>

      <section aria-labelledby="catalog-results" className="flex flex-col gap-6">
        <h2 id="catalog-results" className="sr-only">
          {tpl(dict.catalog.found, { count: products.totalCount })}
        </h2>
        {products.items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-zinc-300 px-6 py-14 text-center dark:border-zinc-700">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <SearchIcon className="h-7 w-7" />
            </span>
            <h3 className="text-xl font-semibold">{dict.catalog.emptyTitle}</h3>
            <p className="max-w-md text-zinc-600 dark:text-zinc-400">{dict.catalog.empty}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {hasFilters || q ? (
                <Link
                  href={resetHref}
                  className="inline-flex min-h-11 items-center rounded-full bg-zinc-900 px-5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  {dict.catalog.resetFilters}
                </Link>
              ) : null}
              {category || !(hasFilters || q) ? (
                <Link
                  href={catalogHref}
                  className="inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  {dict.catalog.browseAll}
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-3">
            {products.items.map((product) => (
              <li key={product.id}>
                <ProductCard
                  product={product}
                  locale={locale}
                  dict={dict}
                  headingLevel={3}
                  sizes="(min-width: 1280px) 25vw, (min-width: 420px) 50vw, 100vw"
                />
              </li>
            ))}
          </ul>
        )}

        <Pagination page={products.page} totalPages={products.totalPages} params={params} />
      </section>
    </>
  );
}

// Ошибки валидации фильтров (битый query в адресе) — редкий технический случай: показываем
// имя параметра и исходное сообщение сервера (маппинг — для заказа и авторизации).
async function InvalidFilters({ errors }: { errors: Record<string, string[]> }) {
  const { dict } = await getI18n();
  return (
    <div className="lg:col-span-2 rounded-xl border border-red-300 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="mb-2 font-medium">{dict.catalog.invalidTitle}</p>
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
