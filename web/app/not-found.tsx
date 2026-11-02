import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-sm text-zinc-500">Ошибка 404</p>
      <h1 className="text-2xl font-semibold">Страница не найдена</h1>
      <Link href="/catalog" className="underline">
        Вернуться в каталог
      </Link>
    </div>
  );
}
