// Типы и клиент для ASP.NET Core API (см. api/src/HiFiStore.Api/Controllers).
// Используется только на сервере (Server Components); браузер ходит через rewrite /api/*.

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

async function getJson<T>(path: string, query?: URLSearchParams): Promise<T | null> {
  const url = `${API_URL}${path}${query && query.size > 0 ? `?${query.toString()}` : ""}`;
  const response = await fetch(url);

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

export function getCategories(): Promise<CategoryNode[]> {
  return getJson<CategoryNode[]>("/api/catalog/categories").then((data) => data ?? []);
}

export function getProducts(query: URLSearchParams): Promise<PagedResult<ProductListItem> | null> {
  return getJson<PagedResult<ProductListItem>>("/api/catalog/products", query);
}

export function getProduct(slug: string): Promise<ProductDetails | null> {
  return getJson<ProductDetails>(`/api/catalog/products/${encodeURIComponent(slug)}`);
}

/** Заказ по публичному токену со страницы подтверждения; <c>null</c>, если токен неверный. */
export function getOrderByToken(token: string): Promise<OrderDetails | null> {
  return getJson<OrderDetails>(`/api/orders/by-token/${encodeURIComponent(token)}`);
}

export function getFacets(categorySlug?: string): Promise<CatalogFacets | null> {
  const query = new URLSearchParams();
  if (categorySlug) {
    query.set("category", categorySlug);
  }
  return getJson<CatalogFacets>("/api/catalog/facets", query);
}
