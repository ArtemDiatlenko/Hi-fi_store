import Link from "next/link";
import { CartLink } from "@/components/cart-link";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4">
        <Link href="/catalog" className="text-lg font-semibold tracking-tight">
          Hi-Fi Store
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:gap-x-5">
          <Link href="/catalog" className="hover:underline">
            Каталог
          </Link>
          <Link href="/account" className="hover:underline">
            Аккаунт
          </Link>
          <Link href="/login" className="hover:underline">
            Войти
          </Link>
          <CartLink />
        </nav>
      </div>
    </header>
  );
}
