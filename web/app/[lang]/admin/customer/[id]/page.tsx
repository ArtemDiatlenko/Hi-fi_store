import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerView } from "@/components/admin/customer-view";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.admin.customers.itemTitle };
}

// Адрес записи — в единственном числе, как у товаров и заказов (см. app/[lang]/admin/layout.tsx).
export default async function AdminCustomerPage(props: PageProps<"/[lang]/admin/customer/[id]">) {
  const { dict } = await getI18n();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{dict.admin.common.loading}</p>}>
      <CustomerView params={props.params} />
    </Suspense>
  );
}
