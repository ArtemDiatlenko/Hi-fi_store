import type { Metadata } from "next";
import { BrandManager } from "@/components/admin/brand-manager";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.admin.brands.title };
}

export default function AdminBrandsPage() {
  return <BrandManager />;
}
