import type { ReactNode } from "react";
import { StoreChrome } from "@/components/store-chrome";

// Страницы витрины. Группа (store) не входит в адрес: /catalog остаётся /catalog.
// Админка лежит рядом, вне группы, и рисует свою оболочку без шапки и подвала магазина.
export default function StoreLayout({ children }: { children: ReactNode }) {
  return <StoreChrome>{children}</StoreChrome>;
}
