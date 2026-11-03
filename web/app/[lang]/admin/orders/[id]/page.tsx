import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderView } from "@/components/admin/order-view";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.admin.orders.title };
}

export default async function AdminOrderPage(props: PageProps<"/[lang]/admin/orders/[id]">) {
  const { dict } = await getI18n();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{dict.admin.common.loading}</p>}>
      <OrderView params={props.params} />
    </Suspense>
  );
}
