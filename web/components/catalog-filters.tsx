import Link from "next/link";
import type { CategoryNode, CatalogFacets, SpecFacet } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";
import { tpl } from "@/lib/i18n/util";
import { type SearchParams, toURLSearchParams } from "@/lib/query";

interface Props {
  categories: CategoryNode[];
  facets: CatalogFacets;
  params: SearchParams;
}

interface CategoryOption {
  slug: string;
  name: string;
  depth: number;
}

function flattenCategories(nodes: CategoryNode[], depth = 0): CategoryOption[] {
  return nodes.flatMap((node) => [
    { slug: node.slug, name: node.name, depth },
    ...flattenCategories(node.children, depth + 1),
  ]);
}

/**
 * Фильтры каталога — обычная GET-форма: работает без JavaScript, а состояние живёт в адресной строке.
 * Имена полей совпадают с query-параметрами API (см. ProductFilterParser). Текст локализован;
 * значения характеристик (бренды, спецификации) приходят из API как есть.
 */
export async function CatalogFilters({ categories, facets, params }: Props) {
  const { locale, dict } = await getI18n();
  const query = toURLSearchParams(params);
  const selectedCategory = query.get("category") ?? "";
  const selectedBrands = query.getAll("brand");
  const selectedConditions = query.getAll("condition");
  const catalogPath = localeHref(locale, "/catalog");

  const sortOptions = [
    { value: "newest", label: dict.catalog.sortNewest },
    { value: "price_asc", label: dict.catalog.sortPriceAsc },
    { value: "price_desc", label: dict.catalog.sortPriceDesc },
    { value: "name", label: dict.catalog.sortName },
  ];

  return (
    <form method="get" action={catalogPath} className="flex flex-col gap-6 text-sm">
      <div className="flex flex-col gap-2">
        <label htmlFor="sort" className="font-medium">
          {dict.catalog.sort}
        </label>
        <select id="sort" name="sort" defaultValue={query.get("sort") ?? "newest"} className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="q" className="font-medium">
          {dict.catalog.search}
        </label>
        <input id="q" name="q" type="search" defaultValue={query.get("q") ?? ""} className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="category" className="font-medium">
          {dict.catalog.section}
        </label>
        <select id="category" name="category" defaultValue={selectedCategory} className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">{dict.catalog.allSections}</option>
          {flattenCategories(categories).map((option) => (
            <option key={option.slug} value={option.slug}>
              {"  ".repeat(option.depth)}
              {option.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{dict.catalog.price}</legend>
        <div className="flex items-center gap-2">
          <input
            name="minPrice"
            type="number"
            min={0}
            placeholder={facets.minPrice !== null ? String(Math.floor(facets.minPrice)) : dict.catalog.from}
            defaultValue={query.get("minPrice") ?? ""}
            className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            aria-label={dict.catalog.priceFrom}
          />
          <span aria-hidden="true">–</span>
          <input
            name="maxPrice"
            type="number"
            min={0}
            placeholder={facets.maxPrice !== null ? String(Math.ceil(facets.maxPrice)) : dict.catalog.to}
            defaultValue={query.get("maxPrice") ?? ""}
            className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            aria-label={dict.catalog.priceTo}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{dict.catalog.condition}</legend>
        {facets.conditions.map((condition) => (
          <label key={condition} className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="condition" value={condition} defaultChecked={selectedConditions.includes(condition)} className="h-4 w-4 accent-zinc-900 dark:accent-amber-400" />
            {dict.conditions[condition]}
          </label>
        ))}
      </fieldset>

      {facets.brands.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">{dict.catalog.brand}</legend>
          {facets.brands.map((brand) => (
            <label key={brand.slug} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="brand" value={brand.slug} defaultChecked={selectedBrands.includes(brand.slug)} className="h-4 w-4 accent-zinc-900 dark:accent-amber-400" />
              {brand.name}
            </label>
          ))}
        </fieldset>
      ) : null}

      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="inStock" value="true" defaultChecked={query.get("inStock") === "true"} className="h-4 w-4 accent-zinc-900 dark:accent-amber-400" />
        {dict.catalog.inStockOnly}
      </label>

      {facets.specs.map((spec) => (
        <SpecFilterField key={spec.key} spec={spec} query={query} dict={dict} />
      ))}

      <div className="flex items-center gap-3">
        <button type="submit" className="min-h-11 rounded-full bg-zinc-900 px-5 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
          {dict.catalog.apply}
        </button>
        <Link href={catalogPath} className="text-zinc-600 underline dark:text-zinc-400">
          {dict.catalog.reset}
        </Link>
      </div>
    </form>
  );
}

function SpecFilterField({ spec, query, dict }: { spec: SpecFacet; query: URLSearchParams; dict: Dictionary }) {
  const title = spec.unit ? `${spec.name}, ${spec.unit}` : spec.name;

  if (spec.valueType === "Number") {
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{title}</legend>
        <div className="flex items-center gap-2">
          <input
            name={`spec.${spec.key}.min`}
            type="number"
            step="any"
            placeholder={spec.min !== null ? String(spec.min) : dict.catalog.from}
            defaultValue={query.get(`spec.${spec.key}.min`) ?? ""}
            className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            aria-label={tpl(dict.catalog.specFrom, { name: spec.name })}
          />
          <span aria-hidden="true">–</span>
          <input
            name={`spec.${spec.key}.max`}
            type="number"
            step="any"
            placeholder={spec.max !== null ? String(spec.max) : dict.catalog.to}
            defaultValue={query.get(`spec.${spec.key}.max`) ?? ""}
            className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            aria-label={tpl(dict.catalog.specTo, { name: spec.name })}
          />
        </div>
      </fieldset>
    );
  }

  if (spec.valueType === "Text") {
    const selected = query.getAll(`spec.${spec.key}`);
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{title}</legend>
        {(spec.values ?? []).map((value) => (
          <label key={value} className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name={`spec.${spec.key}`} value={value} defaultChecked={selected.includes(value)} className="h-4 w-4 accent-zinc-900 dark:accent-amber-400" />
            {value}
          </label>
        ))}
      </fieldset>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`spec-${spec.key}`} className="font-medium">
        {title}
      </label>
      <select
        id={`spec-${spec.key}`}
        name={`spec.${spec.key}`}
        defaultValue={query.get(`spec.${spec.key}`) ?? ""}
        className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="">{dict.catalog.boolAny}</option>
        <option value="true">{dict.catalog.boolYes}</option>
        <option value="false">{dict.catalog.boolNo}</option>
      </select>
    </div>
  );
}
