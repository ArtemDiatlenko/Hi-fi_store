import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { getI18n } from "@/lib/i18n/server";

// Админка закрыта от индексации (noindex, nofollow) во всех локалях; в robots.txt — Disallow, в sitemap её нет.
export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return {
    title: {
      default: dict.admin.title,
      template: `%s · ${dict.admin.title} — Hi-Fi Store`,
    },
    robots: { index: false, follow: false },
  };
}

export default function AdminLayout({ children }: LayoutProps<"/[lang]/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
