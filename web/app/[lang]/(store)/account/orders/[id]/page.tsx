import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountOrder } from "@/components/account-orders";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.account.ordersTitle };
}

export default async function AccountOrderPage(props: PageProps<"/[lang]/account/orders/[id]">) {
  const { dict } = await getI18n();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{dict.account.loading}</p>}>
      <AccountOrder params={props.params} />
    </Suspense>
  );
}
