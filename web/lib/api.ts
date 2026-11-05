// Типы и клиент для ASP.NET Core API (см. api/src/HiFiStore.Api/Controllers).
// Используется только на сервере (Server Components); браузер ходит через rewrite /api/*.

import { cache } from "react";
import { defaultLocale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import type { OrderDetails } from "@/lib/orders";

const API_URL = process.env.API_URL ?? "http://localhost:5166";

export type ProductCondition = "New" | "Used" | "Demo";
export type SpecValueType = "Text" | "Number" | "Boolean";

export interface BrandRef {
  name: string;
  slug: string;
}

export interface CategoryRef {
  name: string;
  slug: string;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  children: CategoryNode[];
}

export interface ProductListItem {
  id: string;
  sku: string;
  name: string;
  slug: string;
  price: number;
  oldPrice: number | null;
  inStock: boolean;
  condition: ProductCondition;
  brand: BrandRef;
  imageUrl: string | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface SpecFacet {
  key: string;
  name: string;
  unit: string | null;
  valueType: SpecValueType;
  min: number | null;
  max: number | null;
  values: string[] | null;
  /** Подписи текстовых значений на языке страницы (значение в фильтре остаётся основным). */
  valueLabels: Record<string, string> | null;
}

export interface CatalogFacets {
  brands: BrandRef[];
  conditions: ProductCondition[];
  minPrice: number | null;
  maxPrice: number | null;
  specs: SpecFacet[];
}

export interface ProductImage {
  url: string;
  alt: string | null;
}

export interface ProductSpecValue {
  key: string;
  name: string;
  unit: string | null;
  valueType: SpecValueType;
  value: string | number | boolean | null;
}

export interface ProductDetails {
  id: string;
  sku: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  condition: ProductCondition;
  brand: BrandRef;
  category: CategoryRef;
  images: ProductImage[];
  specs: ProductSpecValue[];
}

/** Ошибка валидации параметров (HTTP 400, формат ValidationProblemDetails). */
export class ApiValidationError extends Error {
  constructor(public readonly errors: Record<string, string[]>) {
    super("Некорректные параметры фильтра");
  }
}

/** Ответы шлюза, которые Render отдаёт, пока спящий API просыпается. */
const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [1_000, 3_000, 6_000];

/**
 * fetch с повтором при временных сбоях: сетевая ошибка или 502/503/504.
 * На бесплатном Render API засыпает и просыпается до минуты, без повтора витрина показывает ошибку.
 */
async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url);
      if (!TRANSIENT_STATUSES.has(response.status) || attempt >= RETRY_DELAYS_MS.length) {
        return response;
      }
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
}

async function getJson<T>(path: string, query?: URLSearchParams): Promise<T | null> {
  const url = `${API_URL}${path}${query && query.size > 0 ? `?${query.toString()}` : ""}`;
  const response = await fetchWithRetry(url);

  if (response.status === 404) {
    return null;
  }

  if (response.status === 400) {
    const body = (await response.json()) as { errors?: Record<string, string[]> };
    throw new ApiValidationError(body.errors ?? {});
  }

  if (!response.ok) {
    throw new Error(`API ${path} ответил ${response.status}`);
  }

  return (await response.json()) as T;
}

/**
 * Параметры запроса с языком контента страницы: на английской витрине API отдаёт переводы
 * (без перевода — украинский текст). Для украинской параметр не нужен.
 */
async function localized(query?: URLSearchParams): Promise<URLSearchParams> {
  const result = new URLSearchParams(query);
  const locale = await getLocale();
  if (locale !== defaultLocale) {
    result.set("lang", locale);
  }
  return result;
}

/**
 * Дерево разделов. Обёрнуто в React cache: шапка, подвал и страница в одном запросе
 * получают один и тот же промис, к API уходит один запрос.
 */
export const getCategories = cache(async (): Promise<CategoryNode[]> =>
  (await getJson<CategoryNode[]>("/api/catalog/categories", await localized())) ?? [],
);

export async function getProducts(query: URLSearchParams): Promise<PagedResult<ProductListItem> | null> {
  return getJson<PagedResult<ProductListItem>>("/api/catalog/products", await localized(query));
}

export async function getProduct(slug: string): Promise<ProductDetails | null> {
  return getJson<ProductDetails>(`/api/catalog/products/${encodeURIComponent(slug)}`, await localized());
}

/** Заказ по публичному токену со страницы подтверждения; <c>null</c>, если токен неверный. */
export async function getOrderByToken(token: string): Promise<OrderDetails | null> {
  return getJson<OrderDetails>(`/api/orders/by-token/${encodeURIComponent(token)}`, await localized());
}

export async function getFacets(categorySlug?: string): Promise<CatalogFacets | null> {
  const query = new URLSearchParams();
  if (categorySlug) {
    query.set("category", categorySlug);
  }
  return getJson<CatalogFacets>("/api/catalog/facets", await localized(query));
}
