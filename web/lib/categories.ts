// Помощники для дерева разделов каталога (без зависимостей от Next — годятся и на сервере, и в браузере).

import type { CategoryNode } from "@/lib/api";

/** Цепочка разделов от корня до раздела со slug (включительно); пустой массив, если раздел не найден. */
export function findCategoryPath(nodes: CategoryNode[], slug: string): CategoryNode[] {
  for (const node of nodes) {
    if (node.slug === slug) {
      return [node];
    }
    const tail = findCategoryPath(node.children, slug);
    if (tail.length > 0) {
      return [node, ...tail];
    }
  }
  return [];
}

/** Адрес раздела в каталоге (без префикса локали — его добавляет localeHref). */
export function categoryPath(slug: string): string {
  return `/catalog?category=${encodeURIComponent(slug)}`;
}
