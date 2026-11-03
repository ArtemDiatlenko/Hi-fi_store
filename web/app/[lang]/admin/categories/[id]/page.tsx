import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryEditor } from "@/components/admin/category-editor";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.admin.categories.title };
}

export default async function AdminCategoryEditPage(props: PageProps<"/[lang]/admin/categories/[id]">) {
  const { dict } = await getI18n();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{dict.admin.common.loading}</p>}>
      <CategoryEditor params={props.params} />
    </Suspense>
  );
}
