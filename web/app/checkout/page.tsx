import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";

export const metadata: Metadata = {
  title: "Оформление заказа",
  robots: { index: false },
};

export default function CheckoutPage() {
  return <CheckoutForm />;
}
