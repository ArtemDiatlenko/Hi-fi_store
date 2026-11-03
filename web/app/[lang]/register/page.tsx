import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.auth.registerTitle };
}

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
