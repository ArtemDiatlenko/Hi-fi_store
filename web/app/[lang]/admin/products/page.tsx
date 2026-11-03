import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductList } from "@/components/admin/product-list";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.admin.products.title };
}

export default async function AdminProductsPage() {
  const { dict } = await getI18n();
  // Фильтры читаются из адреса (useSearchParams) — под Cache Components это нужно оборачивать в Suspense.
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{dict.admin.common.loading}</p>}>
      <ProductList />
    </Suspense>
  );
}
