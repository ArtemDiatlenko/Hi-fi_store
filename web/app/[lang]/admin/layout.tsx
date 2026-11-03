import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { getI18n } from "@/lib/i18n/server";

// Админка закрыта от индексации (noindex, nofollow) во всех локалях; в robots.txt — Disallow, в sitemap её нет.
//
// Адреса: списки во множественном числе (/admin/products), страницы записей — в единственном
// (/admin/product/{id}, /admin/product/new, /admin/category/…, /admin/order/{id}). Украинская локаль живёт
// без префикса, а Next с Partial Prefetching угадывает маршрут по форме адреса: «/admin/products/{id}» совпал бы
// с витринным /[lang]/products/[slug] (lang = admin), и предзагрузка запрашивала бы чужой сегмент (404).
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
