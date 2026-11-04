"use client";

// GET-форма, которая не тащит в адрес пустые поля (?q=&category=&minPrice=…). Без JavaScript
// работает как обычная форма, с ним — переходит по чистому адресу через роутер Next.

import { useRouter } from "next/navigation";
import type { ComponentProps, FormEvent } from "react";

type Props = Omit<ComponentProps<"form">, "method" | "action" | "onSubmit"> & {
  action: string;
  /** Значения по умолчанию, которые тоже не нужны в адресе (например, sort=newest). */
  defaults?: Record<string, string>;
};

export function CleanGetForm({ action, defaults = {}, children, ...rest }: Props) {
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (trimmed === "" || defaults[name] === trimmed) continue;
      query.append(name, trimmed);
    }
    const search = query.toString();
    router.push(search ? `${action}?${search}` : action);
  }

  return (
    <form {...rest} method="get" action={action} onSubmit={submit}>
      {children}
    </form>
  );
}
