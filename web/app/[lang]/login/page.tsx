import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.auth.loginTitle };
}

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
