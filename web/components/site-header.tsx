import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/catalog" className="text-lg font-semibold tracking-tight">
          Hi-Fi Store
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/catalog" className="hover:underline">
            Каталог
          </Link>
          <Link href="/account" className="hover:underline">
            Аккаунт
          </Link>
          <Link href="/login" className="hover:underline">
            Войти
          </Link>
        </nav>
      </div>
    </header>
  );
}
