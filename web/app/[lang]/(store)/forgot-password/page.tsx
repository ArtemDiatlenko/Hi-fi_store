import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/password-recovery";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.auth.forgotTitle, robots: { index: false } };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
