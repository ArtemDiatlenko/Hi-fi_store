"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { safeReturnPath, TOKEN_STORAGE_KEY } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { localeHref } from "@/lib/i18n/routing";
import { translateIdentityError } from "@/lib/i18n/server-messages";
import { tpl } from "@/lib/i18n/util";

type Mode = "login" | "register";

interface IdentityError {
  code?: string;
  description?: string;
}

/**
 * Ошибки Identity приходят массивом { code, description } либо в формате ProblemDetails
 * ({ errors: { <код>: [<описание>] } }). Описания — по-английски; переводим по коду,
 * а неизвестный код показываем как есть (fallback на текст сервера). См. lib/i18n/server-messages.
 */
async function readError(response: Response, locale: Locale, dict: Dictionary): Promise<string> {
  if (response.status === 401) {
    return dict.auth.invalidCredentials;
  }
  try {
    const body: unknown = await response.json();
    if (Array.isArray(body)) {
      return dedupe(
        (body as IdentityError[]).map((error) => translateIdentityError(error.code, error.description ?? "", locale)),
      );
    }
    if (body && typeof body === "object" && "errors" in body) {
      const errors = (body as { errors: Record<string, string[]> }).errors;
      return dedupe(
        Object.entries(errors).flatMap(([code, messages]) =>
          messages.map((message) => translateIdentityError(code, message, locale)),
        ),
      );
    }
  } catch {
    // Тело ответа не JSON — покажем общее сообщение.
  }
  return tpl(dict.auth.requestFailed, { status: response.status });
}

function dedupe(messages: string[]): string {
  return [...new Set(messages.filter(Boolean))].join(" ");
}

export function AuthForm({ mode }: { mode: Mode }) {
  const { locale, dict } = useI18n();
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
          setError(await readError(registered, locale, dict));
          return;
        }
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!response.ok) {
        setError(await readError(response, locale, dict));
        return;
      }

      const { accessToken } = (await response.json()) as { accessToken: string };
      try {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      } catch {
        // Хранилище недоступно (приватный режим и т. п.): вход работать не будет, сообщим.
        setError(dict.auth.storageError);
        return;
      }
      // ?next=… — вернуть туда, откуда отправили на вход (например, в админку); только адреса этого сайта.
      const next = safeReturnPath(new URLSearchParams(window.location.search).get("next"));
      router.push(next ?? localeHref(locale, "/account"));
      router.refresh();
    } catch {
      setError(dict.auth.noConnection);
    } finally {
      setPending(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">{isRegister ? dict.auth.registerTitle : dict.auth.loginTitle}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {dict.auth.email}
          <input name="email" type="email" required autoComplete="email" className="min-h-11 rounded-md border px-3 py-2 dark:bg-zinc-900" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {dict.auth.password}
          <input
            name="password"
            type="password"
            required
            minLength={isRegister ? 8 : undefined}
            autoComplete={isRegister ? "new-password" : "current-password"}
            className="min-h-11 rounded-md border px-3 py-2 dark:bg-zinc-900"
          />
          {isRegister ? <span className="text-xs text-zinc-500">{dict.auth.passwordHint}</span> : null}
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? dict.auth.pleaseWait : isRegister ? dict.auth.register : dict.auth.login}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        {isRegister ? (
          <>
            {dict.auth.haveAccount}
            <Link href={localeHref(locale, "/login")} className="underline">
              {dict.auth.login}
            </Link>
          </>
        ) : (
          <>
            {dict.auth.noAccount}
            <Link href={localeHref(locale, "/register")} className="underline">
              {dict.auth.register}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
