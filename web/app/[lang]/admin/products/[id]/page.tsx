import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductEditor } from "@/components/admin/product-editor";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.admin.products.editTitle };
}

export default async function AdminProductEditPage(props: PageProps<"/[lang]/admin/products/[id]">) {
  const { dict } = await getI18n();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{dict.admin.common.loading}</p>}>
      <ProductEditor params={props.params} />
    </Suspense>
  );
}
