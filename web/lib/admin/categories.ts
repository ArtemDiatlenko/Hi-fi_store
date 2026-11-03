// Дерево разделов из плоского списка GET /api/admin/categories (порядок — обход в глубину).

import type { AdminCategory } from "@/lib/admin/types";

export interface CategoryOption {
  id: string;
  name: string;
  depth: number;
}

/** Глубина каждого раздела; список уже упорядочен сервером, порядок сохраняется. */
export function withDepth(categories: AdminCategory[]): (AdminCategory & { depth: number })[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const depthOf = (category: AdminCategory): number => {
    let depth = 0;
    let parentId = category.parentId;
    // Защита от циклов в данных: глубже числа разделов уйти нельзя.
    while (parentId && depth < categories.length) {
      depth += 1;
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return depth;
  };
  return categories.map((category) => ({ ...category, depth: depthOf(category) }));
}

/** Подпись варианта в select с отступом по глубине (неразрывные пробелы не схлопываются). */
export function indentedLabel(name: string, depth: number): string {
  return depth === 0 ? name : `${"   ".repeat(depth)}↳ ${name}`;
}

/** Сам раздел и все его подразделы — нельзя выбрать родителем при переносе. */
export function selfAndDescendants(categories: AdminCategory[], id: string): Set<string> {
  const result = new Set<string>([id]);
  let added = true;
  while (added) {
    added = false;
    for (const category of categories) {
      if (category.parentId && result.has(category.parentId) && !result.has(category.id)) {
        result.add(category.id);
        added = true;
      }
    }
  }
  return result;
}

/** Цепочка предков раздела от корня к ближайшему родителю. */
export function ancestorsOf(categories: AdminCategory[], id: string): AdminCategory[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const chain: AdminCategory[] = [];
  let parentId = byId.get(id)?.parentId ?? null;
  while (parentId && chain.length < categories.length) {
    const parent = byId.get(parentId);
    if (!parent) {
      break;
    }
    chain.unshift(parent);
    parentId = parent.parentId;
  }
  return chain;
}
