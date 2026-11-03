import type { Metadata } from "next";
import { AccountOrderList } from "@/components/account-orders";

export const metadata: Metadata = {
  title: "Мои заказы",
};

export default function AccountOrdersPage() {
  return <AccountOrderList />;
}
