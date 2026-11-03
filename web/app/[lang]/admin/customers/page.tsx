import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerList } from "@/components/admin/customer-list";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.admin.customers.title };
}

export default async function AdminCustomersPage() {
  const { dict } = await getI18n();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{dict.admin.common.loading}</p>}>
      <CustomerList />
    </Suspense>
  );
}
