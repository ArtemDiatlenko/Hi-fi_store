import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/dashboard";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.admin.dashboard.title };
}

export default function AdminDashboardPage() {
  return <AdminDashboard />;
}
