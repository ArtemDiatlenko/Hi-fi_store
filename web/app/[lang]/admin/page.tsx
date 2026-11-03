import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/dashboard";
import { getI18n } from "@/lib/i18n/server";

// Шаблон заголовка из admin/layout.tsx действует на вложенные сегменты, а не на страницу того же сегмента.
export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: { absolute: `${dict.admin.dashboard.title} · ${dict.admin.title} — Hi-Fi Store` } };
}

export default function AdminDashboardPage() {
  return <AdminDashboard />;
}
