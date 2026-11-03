import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryCreate } from "@/components/admin/category-editor";
import { getI18n } from "@/lib/i18n/server";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.admin.categories.newTitle };
}

export default async function AdminCategoryCreatePage() {
  const { dict } = await getI18n();
  // ?parent= — родительский раздел по умолчанию (кнопка «Підрозділ» в дереве).
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{dict.admin.common.loading}</p>}>
      <CategoryCreate />
    </Suspense>
  );
}
