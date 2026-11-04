// Имена общих переходов между страницами (React ViewTransition). Стили — в app/globals.css.

/** Фото товара: карточка в списке ↔ большое фото на странице товара. */
export function productMorphName(slug: string): string {
  return `product-${slug}`;
}
