import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryTree } from "@/components/admin/category-tree";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.admin.categories.title };
}

export default async function AdminCategoriesPage() {
  const { dict } = await getI18n();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{dict.admin.common.loading}</p>}>
      <CategoryTree />
    </Suspense>
  );
}
