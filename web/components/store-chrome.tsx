import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { type CategoryNode, getCategories } from "@/lib/api";

// Шапка и подвал витрины. Общие для страниц из app/[lang]/(store) и для 404; у админки своя оболочка.
export function StoreChrome({ children }: { children: ReactNode }) {
  // Разделы нужны шапке (меню) и подвалу. Промис не ожидаем здесь: оболочка страницы рендерится
  // сразу, а меню и ссылки подвала подставляются потоково. Если API недоступен — пустой список,
  // и вместо меню остаётся обычная ссылка на каталог.
  const categories = getCategories().catch((): CategoryNode[] => []);

  return (
    <>
      <SiteHeader categories={categories} />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none">
        {children}
      </main>
      <SiteFooter categories={categories} />
    </>
  );
}
