import type { Metadata } from "next";
import { AccountOrderList } from "@/components/account-orders";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.account.ordersTitle };
}

export default function AccountOrdersPage() {
  return <AccountOrderList />;
}
