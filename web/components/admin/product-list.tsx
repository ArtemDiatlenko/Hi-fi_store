"use client";

// Список товаров админки: поиск, фильтры и номер страницы живут в адресной строке,
// поэтому ссылки с огляду («Не опубліковані») и кнопка «Назад» работают как ожидается.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AdminPagination, listHref } from "@/components/admin/admin-pagination";
import { AdminThumb } from "@/components/admin/thumb";
import { buttonClass, Field, LoadError, Notice, PageHeader, PublishedBadge } from "@/components/admin/ui";
import type { PagedResult } from "@/lib/api";
import { indentedLabel, withDepth } from "@/lib/admin/categories";
import type { AdminBrand, AdminCategory, AdminProductListItem } from "@/lib/admin/types";
import { useAdminQuery } from "@/lib/admin/session";
import { formatNumber, formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";

const PAGE_SIZE = 20;

interface Filters {
  q: string;
  categoryId: string;
  brandId: string;
  published: string;
}

export function ProductList() {
  const { locale, dict } = useI18n();
  const t = dict.admin.products;
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = localeHref(locale, "/admin/products");

  const filters: Filters = {
    q: searchParams.get("q") ?? "",
    categoryId: searchParams.get("categoryId") ?? "",
    brandId: searchParams.get("brandId") ?? "",
    published: searchParams.get("published") ?? "",
  };
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const notice = searchParams.get("notice");

  const apiQuery = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const [name, value] of Object.entries(filters)) {
    if (value) {
      apiQuery.set(name, value);
    }
  }

  const products = useAdminQuery<PagedResult<AdminProductListItem>>(`/api/admin/products?${apiQuery.toString()}`);
  const categories = useAdminQuery<AdminCategory[]>("/api/admin/categories");
  const brands = useAdminQuery<AdminBrand[]>("/api/admin/brands");

  const data = products.data;

  return (
    <>
      <PageHeader
        title={t.title}
        actions={
          <Link href={localeHref(locale, "/admin/product/new")} className={buttonClass.primary}>
            {t.add}
          </Link>
        }
      />

      <Notice
        message={notice === "deleted" ? t.deleted : null}
        onDismiss={() => router.replace(listHref(basePath, searchParams, { notice: null }), { scroll: false })}
      />

      <ProductFilters
        key={searchParams.toString()}
        initial={filters}
        categories={categories.data ?? []}
        brands={brands.data ?? []}
        onApply={(next) => router.push(listHref(basePath, new URLSearchParams(), { ...next }))}
        resetHref={basePath}
      />

      {products.error ? (
        <LoadError
          message={products.error.status === 0 ? dict.admin.common.noConnection : tpl(dict.admin.common.loadError, { status: products.error.status })}
          onRetry={products.reload}
        />
      ) : null}

      {data === null && !products.error ? <p className="text-sm text-zinc-500">{dict.admin.common.loading}</p> : null}

      {data ? (
        <div aria-busy={products.loading} className={`flex flex-col gap-4 ${products.loading ? "opacity-60" : ""}`}>
          <p className="text-sm text-zinc-500" aria-live="polite">
            {tpl(dict.admin.common.found, { count: data.totalCount })}
          </p>

          {data.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">{t.empty}</p>
          ) : (
            <>
              {/* Десктоп: таблица */}
              <div className="hidden overflow-hidden rounded-xl border border-zinc-200 md:block dark:border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        {t.colProduct}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        {t.brand}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        {t.colPrice}
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        {t.colStock}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        {t.colCondition}
                      </th>
                      <th scope="col" className="px-4 py-3">
                        {t.colStatus}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {data.items.map((product) => (
                      <tr key={product.id} className="align-middle hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <AdminThumb url={product.imageUrl} alt="" />
                            <div className="flex min-w-0 flex-col">
                              <Link href={localeHref(locale, `/admin/product/${product.id}`)} className="font-medium underline-offset-2 hover:underline">
                                {product.name}
                              </Link>
                              <span className="text-xs text-zinc-500">
                                {tpl(t.sku, { sku: product.sku })} · {product.category.name}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{product.brand.name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                          <span className="font-medium">{formatPrice(product.price, locale)}</span>
                          {product.oldPrice !== null ? (
                            <span className="block text-xs text-zinc-500 line-through">{formatPrice(product.oldPrice, locale)}</span>
                          ) : null}
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${product.stock === 0 ? "font-medium text-red-700 dark:text-red-400" : ""}`}>
                          {tpl(t.stockValue, { count: formatNumber(product.stock, locale) })}
                        </td>
                        <td className="px-4 py-3">{dict.conditions[product.condition]}</td>
                        <td className="px-4 py-3">
                          <PublishedBadge published={product.isPublished} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Мобильные: карточки */}
              <ul className="flex flex-col gap-3 md:hidden">
                {data.items.map((product) => (
                  <li key={product.id} className="flex gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <AdminThumb url={product.imageUrl} alt="" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                      <Link href={localeHref(locale, `/admin/product/${product.id}`)} className="font-medium underline-offset-2 hover:underline">
                        {product.name}
                      </Link>
                      <span className="text-xs text-zinc-500">
                        {tpl(t.sku, { sku: product.sku })} · {product.brand.name} · {product.category.name}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-medium tabular-nums">{formatPrice(product.price, locale)}</span>
                        <span className={`tabular-nums ${product.stock === 0 ? "font-medium text-red-700 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"}`}>
                          {t.colStock}: {tpl(t.stockValue, { count: formatNumber(product.stock, locale) })}
                        </span>
                        <PublishedBadge published={product.isPublished} />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <AdminPagination page={data.page} totalPages={data.totalPages} hrefFor={(target) => listHref(basePath, searchParams, { page: String(target), notice: null })} />
        </div>
      ) : null}
    </>
  );
}

function ProductFilters({
  initial,
  categories,
  brands,
  onApply,
  resetHref,
}: {
  initial: Filters;
  categories: AdminCategory[];
  brands: AdminBrand[];
  onApply: (filters: Filters) => void;
  resetHref: string;
}) {
  const { dict } = useI18n();
  const t = dict.admin.products;
  const [values, setValues] = useState<Filters>(initial);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply({ ...values, q: values.q.trim() });
  }

  const set = (name: keyof Filters) => (value: string) => setValues((current) => ({ ...current, [name]: value }));

  return (
    <form role="search" aria-label={t.filtersLabel} onSubmit={submit} className="grid gap-3 rounded-xl border border-zinc-200 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1fr_1fr_auto] lg:items-end dark:border-zinc-800">
      <Field label={t.search}>
        {(control) => <input {...control} type="search" value={values.q} onChange={(event) => set("q")(event.target.value)} />}
      </Field>
      <Field label={t.category}>
        {(control) => (
          <select {...control} value={values.categoryId} onChange={(event) => set("categoryId")(event.target.value)}>
            <option value="">{t.allCategories}</option>
            {withDepth(categories).map((category) => (
              <option key={category.id} value={category.id}>
                {indentedLabel(category.name, category.depth)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={t.brand}>
        {(control) => (
          <select {...control} value={values.brandId} onChange={(event) => set("brandId")(event.target.value)}>
            <option value="">{t.allBrands}</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={t.publication}>
        {(control) => (
          <select {...control} value={values.published} onChange={(event) => set("published")(event.target.value)}>
            <option value="">{t.publicationAll}</option>
            <option value="true">{t.publicationPublished}</option>
            <option value="false">{t.publicationDraft}</option>
          </select>
        )}
      </Field>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
        <button type="submit" className={buttonClass.primary}>
          {dict.admin.common.apply}
        </button>
        <Link href={resetHref} className={buttonClass.secondary}>
          {dict.admin.common.reset}
        </Link>
      </div>
    </form>
  );
}
