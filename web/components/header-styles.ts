// Общие классы шапки. Отдельный модуль без "use client": строки из клиентского модуля
// в серверном компоненте превратились бы в клиентские ссылки, а не в значения.

/** Кнопка «Каталог» и заменяющая её ссылка (до загрузки разделов или если их нет). */
export const catalogTriggerClass =
  "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-white";
