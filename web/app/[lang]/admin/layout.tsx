import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getI18n } from "@/lib/i18n/server";

// Админка закрыта от индексации (noindex, nofollow) во всех локалях; в robots.txt — Disallow, в sitemap её нет.
//
// Адреса: списки во множественном числе (/admin/products), страницы записей — в единственном
// (/admin/product/{id}, /admin/product/new, /admin/category/…, /admin/order/{id}). Украинская локаль живёт
// без префикса, а Next с Partial Prefetching угадывает маршрут по форме адреса: «/admin/products/{id}» совпал бы
// с витринным /[lang]/products/[slug] (lang = admin), и предзагрузка запрашивала бы чужой сегмент (404).
// Теперь [lang] закрыт (unstable_paramMatching в app/[lang]/layout.tsx) и роутер такие адреса не угадывает,
// но единственное число оставлено: адреса записей не похожи на витринные и не зависят от этой настройки.
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

// Админка рисуется в браузере после проверки доступа, поэтому остальная страница целиком пререндерится,
// а метаданные страниц записей (/admin/order/[id] и т. п.) откладываются до запроса. С Cache Components это
// нужно отметить явно, иначе сборка падает (blocking-prerender-metadata-runtime). Метка ничего не рисует
// и не мешает статической оболочке. Раньше ту же роль невольно играла потоковая шапка витрины.
async function Connection() {
  await connection();
  return null;
}

export default function AdminLayout({ children }: LayoutProps<"/[lang]/admin">) {
  return (
    <>
      <AdminShell>{children}</AdminShell>
      <Suspense>
        <Connection />
      </Suspense>
    </>
  );
}
