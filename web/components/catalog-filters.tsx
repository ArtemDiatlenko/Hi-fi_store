import Link from "next/link";
import type { CategoryNode, CatalogFacets, SpecFacet } from "@/lib/api";
import { conditionLabel } from "@/lib/format";
import { type SearchParams, toURLSearchParams } from "@/lib/query";

const SORT_OPTIONS = [
  { value: "newest", label: "Сначала новые" },
  { value: "price_asc", label: "Сначала дешевле" },
  { value: "price_desc", label: "Сначала дороже" },
  { value: "name", label: "По названию" },
] as const;

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
 * Имена полей совпадают с query-параметрами API (см. ProductFilterParser).
 */
export function CatalogFilters({ categories, facets, params }: Props) {
  const query = toURLSearchParams(params);
  const selectedCategory = query.get("category") ?? "";
  const selectedBrands = query.getAll("brand");
  const selectedConditions = query.getAll("condition");

  return (
    <form method="get" action="/catalog" className="flex flex-col gap-6 text-sm">
      <div className="flex flex-col gap-2">
        <label htmlFor="sort" className="font-medium">
          Сортировка
        </label>
        <select id="sort" name="sort" defaultValue={query.get("sort") ?? "newest"} className="rounded-md border px-2 py-2 dark:bg-zinc-900">
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="q" className="font-medium">
          Поиск по названию
        </label>
        <input id="q" name="q" type="search" defaultValue={query.get("q") ?? ""} className="rounded-md border px-2 py-2 dark:bg-zinc-900" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="category" className="font-medium">
          Раздел
        </label>
        <select id="category" name="category" defaultValue={selectedCategory} className="rounded-md border px-2 py-2 dark:bg-zinc-900">
          <option value="">Все разделы</option>
          {flattenCategories(categories).map((option) => (
            <option key={option.slug} value={option.slug}>
              {"  ".repeat(option.depth)}
              {option.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Цена</legend>
        <div className="flex items-center gap-2">
          <input
            name="minPrice"
            type="number"
            min={0}
            placeholder={facets.minPrice !== null ? String(Math.floor(facets.minPrice)) : "от"}
            defaultValue={query.get("minPrice") ?? ""}
            className="w-full rounded-md border px-2 py-2 dark:bg-zinc-900"
            aria-label="Цена от"
          />
          <span>–</span>
          <input
            name="maxPrice"
            type="number"
            min={0}
            placeholder={facets.maxPrice !== null ? String(Math.ceil(facets.maxPrice)) : "до"}
            defaultValue={query.get("maxPrice") ?? ""}
            className="w-full rounded-md border px-2 py-2 dark:bg-zinc-900"
            aria-label="Цена до"
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Состояние</legend>
        {facets.conditions.map((condition) => (
          <label key={condition} className="flex items-center gap-2">
            <input type="checkbox" name="condition" value={condition} defaultChecked={selectedConditions.includes(condition)} />
            {conditionLabel(condition)}
          </label>
        ))}
      </fieldset>

      {facets.brands.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">Бренд</legend>
          {facets.brands.map((brand) => (
            <label key={brand.slug} className="flex items-center gap-2">
              <input type="checkbox" name="brand" value={brand.slug} defaultChecked={selectedBrands.includes(brand.slug)} />
              {brand.name}
            </label>
          ))}
        </fieldset>
      ) : null}

      <label className="flex items-center gap-2">
        <input type="checkbox" name="inStock" value="true" defaultChecked={query.get("inStock") === "true"} />
        Только в наличии
      </label>

      {facets.specs.map((spec) => (
        <SpecFilterField key={spec.key} spec={spec} query={query} />
      ))}

      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          Применить
        </button>
        <Link href="/catalog" className="text-zinc-600 underline dark:text-zinc-400">
          Сбросить
        </Link>
      </div>
    </form>
  );
}

function SpecFilterField({ spec, query }: { spec: SpecFacet; query: URLSearchParams }) {
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
            placeholder={spec.min !== null ? String(spec.min) : "от"}
            defaultValue={query.get(`spec.${spec.key}.min`) ?? ""}
            className="w-full rounded-md border px-2 py-2 dark:bg-zinc-900"
            aria-label={`${spec.name}: от`}
          />
          <span>–</span>
          <input
            name={`spec.${spec.key}.max`}
            type="number"
            step="any"
            placeholder={spec.max !== null ? String(spec.max) : "до"}
            defaultValue={query.get(`spec.${spec.key}.max`) ?? ""}
            className="w-full rounded-md border px-2 py-2 dark:bg-zinc-900"
            aria-label={`${spec.name}: до`}
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
          <label key={value} className="flex items-center gap-2">
            <input type="checkbox" name={`spec.${spec.key}`} value={value} defaultChecked={selected.includes(value)} />
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
        className="rounded-md border px-2 py-2 dark:bg-zinc-900"
      >
        <option value="">Не важно</option>
        <option value="true">Да</option>
        <option value="false">Нет</option>
      </select>
    </div>
  );
}
