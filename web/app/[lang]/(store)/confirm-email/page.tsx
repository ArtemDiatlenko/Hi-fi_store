import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmEmailView } from "@/components/password-recovery";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.auth.confirmTitle, robots: { index: false } };
}

// Параметры ссылки из письма (userId, code) читаются в браузере — компонент внутри Suspense.
export default async function ConfirmEmailPage() {
  const { dict } = await getI18n();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{dict.auth.confirming}</p>}>
      <ConfirmEmailView />
    </Suspense>
  );
}
