/** Параметры страницы в виде, в котором их отдаёт Next (значение может повторяться). */
export type SearchParams = Record<string, string | string[] | undefined>;

/** Копирует параметры в URLSearchParams, пропуская пустые значения. */
export function toURLSearchParams(params: SearchParams): URLSearchParams {
  const result = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    for (const item of values) {
      if (item.trim() !== "") {
        result.append(name, item);
      }
    }
  }
  return result;
}

/**
 * Строка адреса с теми же фильтрами, но с заменёнными параметрами (например, номер страницы).
 * <c>basePath</c> — локализованный путь каталога («/catalog» или «/en/catalog»).
 */
export function hrefWith(
  basePath: string,
  params: SearchParams,
  overrides: Record<string, string | null>,
): string {
  const result = toURLSearchParams(params);
  for (const [name, value] of Object.entries(overrides)) {
    result.delete(name);
    if (value !== null) {
      result.set(name, value);
    }
  }
  const query = result.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Исправляет типичные ошибки в цене до запроса к API: «от» больше «до» — меняет местами,
 * отрицательное или нечисловое значение — убирает. Без этого API отвечает ошибкой валидации,
 * и вместо каталога покупатель видит сообщение об ошибке.
 */
export function normalizePriceRange(params: SearchParams): SearchParams {
  const parse = (name: "minPrice" | "maxPrice") => {
    const raw = firstValue(params[name])?.trim();
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  };
  let min = parse("minPrice");
  let max = parse("maxPrice");
  if (min === undefined && max === undefined) {
    return params;
  }
  if (typeof min === "number" && typeof max === "number" && min > max) {
    [min, max] = [max, min];
  }
  const result: SearchParams = { ...params };
  delete result.minPrice;
  delete result.maxPrice;
  if (typeof min === "number") result.minPrice = String(min);
  if (typeof max === "number") result.maxPrice = String(max);
  return result;
}
