import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.cart.title };
}

export default function CartPage() {
  return <CartView />;
}
