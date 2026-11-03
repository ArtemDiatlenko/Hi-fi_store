import type { Metadata } from "next";
import { ProductCreate } from "@/components/admin/product-editor";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.admin.products.newTitle };
}

export default function AdminProductCreatePage() {
  return <ProductCreate />;
}
