import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/password-recovery";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.auth.resetTitle, robots: { index: false } };
}

// Параметры ссылки из письма (email, code) читаются в браузере — форма внутри Suspense.
export default async function ResetPasswordPage() {
  const { dict } = await getI18n();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{dict.auth.pleaseWait}</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
