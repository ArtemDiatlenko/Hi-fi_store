import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return {
    title: dict.checkout.title,
    robots: { index: false },
  };
}

export default function CheckoutPage() {
  return <CheckoutForm />;
}
