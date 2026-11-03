import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountOrder } from "@/components/account-orders";

export const metadata: Metadata = {
  title: "Заказ",
};

export default function AccountOrderPage(props: PageProps<"/account/orders/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Загрузка…</p>}>
      <AccountOrder params={props.params} />
    </Suspense>
  );
}
