import { type ReactNode, ViewTransition } from "react";

// Шаблон пересоздаётся при каждом переходе между страницами витрины, поэтому здесь срабатывают
// анимации входа и выхода: старая страница гаснет, новая проявляется (стили — app/globals.css).
// Смена только параметров запроса (фильтры каталога) шаблон не пересоздаёт.
export default function StoreTemplate({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
