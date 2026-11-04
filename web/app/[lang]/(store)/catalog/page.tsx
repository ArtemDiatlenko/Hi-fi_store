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
import { firstValue, normalizePriceRange, type SearchParams, toURLSearchParams } from "@/lib/query";
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
  const params = normalizePriceRange(await searchParams);
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
      return <InvalidFilters resetHref={localeHref(locale, "/catalog")} />;
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
          <h1 className="text-4xl leading-tight font-light sm:text-5xl">{title}</h1>
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

      <section data-section="results" className="flex flex-col gap-6">
        <h2 className="sr-only">
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
                  className="stage-button"
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
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12 xl:grid-cols-3">
            {products.items.map((product) => (
              <li key={product.id} className="stage-reveal">
                <ProductCard
                  product={product}
                  locale={locale}
                  dict={dict}
                  headingLevel={3}
                  sizes="(min-width: 1280px) 25vw, 50vw"
                  morph
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

// Ошибки валидации фильтров: адрес с некорректными параметрами (например, вручную изменённая ссылка).
// Технические подробности покупателю не нужны — объясняем и предлагаем сбросить фильтры.
async function InvalidFilters({ resetHref }: { resetHref: string }) {
  const { dict } = await getI18n();
  return (
    <div role="alert" className="lg:col-span-2 flex flex-col items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
      <p className="font-medium">{dict.catalog.invalidTitle}</p>
      <p className="text-sm text-zinc-400">{dict.catalog.invalidText}</p>
      <Link href={resetHref} className="stage-button">
        {dict.catalog.resetFilters}
      </Link>
    </div>
  );
}
