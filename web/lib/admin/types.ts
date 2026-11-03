// Типы административного API (/api/admin/...). Совпадают с DTO в
// api/src/HiFiStore.Infrastructure/Catalog/Admin/AdminCatalogDtos.cs и Orders/OrderDtos.cs.

import type { ProductCondition, SpecValueType } from "@/lib/api";
import type { DeliveryMethod, OrderDetails, OrderStatus, PaymentMethod } from "@/lib/orders";

export const ADMIN_ROLE = "Admin";

export interface Me {
  id: string;
  email: string | null;
  fullName: string | null;
  roles: string[];
}

export interface AdminRef {
  id: string;
  name: string;
  slug: string;
}

export interface AdminBrand {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  productCount: number;
}

/** Раздел в плоском списке (порядок — обход дерева в глубину). */
export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  childCount: number;
  productCount: number;
}

export interface AdminSpecDefinition {
  id: string;
  categoryId: string;
  key: string;
  name: string;
  unit: string | null;
  valueType: SpecValueType;
  isFilterable: boolean;
  sortOrder: number;
}

export interface AdminCategoryDetails extends AdminCategory {
  specs: AdminSpecDefinition[];
}

export interface AdminProductListItem {
  id: string;
  sku: string;
  name: string;
  slug: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  condition: ProductCondition;
  isPublished: boolean;
  brand: AdminRef;
  category: AdminRef;
  imageUrl: string | null;
  updatedAt: string;
}

export interface AdminProductImage {
  url: string;
  alt: string | null;
}

export interface AdminProductSpecValue {
  key: string;
  name: string;
  unit: string | null;
  valueType: SpecValueType;
  value: string | number | boolean | null;
}

export interface AdminProductDetails {
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
  isPublished: boolean;
  brand: AdminRef;
  category: AdminRef;
  images: AdminProductImage[];
  specs: AdminProductSpecValue[];
  availableSpecs: AdminSpecDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderSummary {
  id: string;
  number: number;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  isGuest: boolean;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  itemCount: number;
  total: number;
  createdAt: string;
}

export interface AdminOrderDetails extends OrderDetails {
  nextStatuses: OrderStatus[];
  userId: string | null;
}

export const productConditions: ProductCondition[] = ["New", "Used", "Demo"];

export const specValueTypes: SpecValueType[] = ["Number", "Text", "Boolean"];

export const orderStatuses: OrderStatus[] = ["New", "Confirmed", "Shipped", "Completed", "Cancelled"];
