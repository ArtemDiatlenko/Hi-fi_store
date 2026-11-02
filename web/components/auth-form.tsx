"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { TOKEN_STORAGE_KEY } from "@/lib/auth";

type Mode = "login" | "register";

interface IdentityError {
  description?: string;
}

/** Ошибки Identity приходят массивом { code, description } либо в формате ProblemDetails. */
async function readError(response: Response): Promise<string> {
  if (response.status === 401) {
    return "Неверный email или пароль.";
  }
  try {
    const body: unknown = await response.json();
    if (Array.isArray(body)) {
      return (body as IdentityError[]).map((e) => e.description).filter(Boolean).join(" ");
    }
    if (body && typeof body === "object" && "errors" in body) {
      return Object.values((body as { errors: Record<string, string[]> }).errors).flat().join(" ");
    }
  } catch {
    // Тело ответа не JSON — покажем общее сообщение.
  }
  return `Не удалось выполнить запрос (${response.status}).`;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const credentials = { email: String(form.get("email")), password: String(form.get("password")) };

    try {
      if (mode === "register") {
        const registered = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });
        if (!registered.ok) {
          setError(await readError(registered));
          return;
        }
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }

      const { accessToken } = (await response.json()) as { accessToken: string };
      try {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      } catch {
        // Хранилище недоступно (приватный режим и т. п.): вход работать не будет, сообщим.
        setError("Браузер не разрешает сохранить сессию.");
        return;
      }
      router.push("/account");
      router.refresh();
    } catch {
      setError("Нет связи с сервером. Попробуйте позже.");
    } finally {
      setPending(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">{isRegister ? "Регистрация" : "Вход"}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className="rounded-md border px-3 py-2 dark:bg-zinc-900" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Пароль
          <input
            name="password"
            type="password"
            required
            minLength={isRegister ? 8 : undefined}
            autoComplete={isRegister ? "new-password" : "current-password"}
            className="rounded-md border px-3 py-2 dark:bg-zinc-900"
          />
          {isRegister ? <span className="text-xs text-zinc-500">Не менее 8 символов.</span> : null}
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Подождите…" : isRegister ? "Зарегистрироваться" : "Войти"}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        {isRegister ? (
          <>
            Уже есть аккаунт? <Link href="/login" className="underline">Войти</Link>
          </>
        ) : (
          <>
            Нет аккаунта? <Link href="/register" className="underline">Зарегистрироваться</Link>
          </>
        )}
      </p>
    </div>
  );
}
