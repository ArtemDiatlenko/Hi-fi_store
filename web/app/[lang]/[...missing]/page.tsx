import { notFound } from "next/navigation";

// Любой неизвестный адрес внутри локали: без этого маршрута Next показывает свою английскую 404
// вместо страницы магазина ([lang]/not-found.tsx).
export default function MissingPage(): never {
  notFound();
}
