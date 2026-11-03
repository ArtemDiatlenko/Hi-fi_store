"use client";

// Восстановление пароля и подтверждение email — стандартные эндпоинты Identity (/api/auth/...).
// Ссылки из писем ведут сюда (их собирает API, см. HiFiStore.Api/Email/IdentityEmailSender.cs):
// /confirm-email?userId=…&code=…[&changedEmail=…] и /reset-password?email=…&code=….

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { readError } from "@/components/auth-form";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";

const inputClass = "min-h-11 rounded-md border px-3 py-2 dark:bg-zinc-900";
const submitClass =
  "min-h-11 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

function Status({ tone, children }: { tone: "ok" | "error"; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`text-sm ${tone === "error" ? "text-red-600" : "text-emerald-700 dark:text-emerald-400"}`}>
      {children}
    </p>
  );
}

export function ForgotPasswordForm() {
  const { locale, dict } = useI18n();
  const [state, setState] = useState<"idle" | "pending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setState("pending");
    const email = String(new FormData(event.currentTarget).get("email"));
    try {
      // Identity отвечает 200 и для несуществующего адреса — по ответу нельзя узнать, есть ли аккаунт.
      const response = await fetch("/api/auth/forgotPassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setError(await readError(response, locale, dict));
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError(dict.auth.noConnection);
      setState("idle");
    }
  }

  return (
    <Card title={dict.auth.forgotTitle}>
      {state === "sent" ? (
        <>
          <Status tone="ok">{dict.auth.forgotSent}</Status>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{dict.auth.forgotUnconfirmed}</p>
          <Link href={localeHref(locale, "/login")} className="w-fit underline">
            {dict.auth.toLogin}
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{dict.auth.forgotText}</p>
          <label className="flex flex-col gap-1 text-sm">
            {dict.auth.email}
            <input name="email" type="email" required autoComplete="email" className={inputClass} />
          </label>
          {error ? <Status tone="error">{error}</Status> : null}
          <button type="submit" disabled={state === "pending"} className={submitClass}>
            {state === "pending" ? dict.auth.pleaseWait : dict.auth.forgotSubmit}
          </button>
        </form>
      )}
    </Card>
  );
}

export function ResetPasswordForm() {
  const { locale, dict } = useI18n();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const code = params.get("code") ?? "";
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!email || !code) {
    return (
      <Card title={dict.auth.resetTitle}>
        <Status tone="error">{dict.auth.resetInvalidLink}</Status>
        <Link href={localeHref(locale, "/forgot-password")} className="w-fit underline">
          {dict.auth.requestNewLink}
        </Link>
      </Card>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setState("pending");
    const newPassword = String(new FormData(event.currentTarget).get("password"));
    try {
      const response = await fetch("/api/auth/resetPassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resetCode: code, newPassword }),
      });
      if (!response.ok) {
        // Неверный или просроченный код Identity возвращает как ошибку InvalidToken — она переводится
        // в тот же текст, что и dict.auth.resetInvalidLink (lib/i18n/server-messages), и показывает ссылку на новый запрос.
        setError(await readError(response, locale, dict));
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError(dict.auth.noConnection);
      setState("idle");
    }
  }

  return (
    <Card title={dict.auth.resetTitle}>
      {state === "done" ? (
        <>
          <Status tone="ok">{dict.auth.resetDone}</Status>
          <Link href={localeHref(locale, "/login")} className="w-fit underline">
            {dict.auth.toLogin}
          </Link>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{email}</p>
          {/* Скрытое поле с email помогает менеджерам паролей сохранить новый пароль к нужному аккаунту. */}
          <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
          <label className="flex flex-col gap-1 text-sm">
            {dict.auth.newPassword}
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
            <span className="text-xs text-zinc-500">{dict.auth.passwordHint}</span>
          </label>
          {error ? (
            <>
              <Status tone="error">{error}</Status>
              {error === dict.auth.resetInvalidLink ? (
                <Link href={localeHref(locale, "/forgot-password")} className="w-fit text-sm underline">
                  {dict.auth.requestNewLink}
                </Link>
              ) : null}
            </>
          ) : null}
          <button type="submit" disabled={state === "pending"} className={submitClass}>
            {state === "pending" ? dict.auth.pleaseWait : dict.auth.resetSubmit}
          </button>
        </form>
      )}
    </Card>
  );
}

export function ConfirmEmailView() {
  const { locale, dict } = useI18n();
  const params = useSearchParams();
  const userId = params.get("userId");
  const code = params.get("code");
  const changedEmail = params.get("changedEmail");
  const [result, setResult] = useState<"ok" | "failed" | null>(null);
  // Ссылка без параметров недействительна сразу, запрос не нужен.
  const state = !userId || !code ? "failed" : (result ?? "pending");

  useEffect(() => {
    if (!userId || !code) {
      return;
    }
    let active = true;
    const target = new URLSearchParams({ userId, code });
    if (changedEmail) {
      target.set("changedEmail", changedEmail);
    }
    fetch(`/api/auth/confirmEmail?${target.toString()}`, { cache: "no-store" })
      .then((response) => {
        if (active) {
          setResult(response.ok ? "ok" : "failed");
        }
      })
      .catch(() => {
        if (active) {
          setResult("failed");
        }
      });
    return () => {
      active = false;
    };
  }, [userId, code, changedEmail]);

  return (
    <Card title={dict.auth.confirmTitle}>
      {state === "pending" ? <p role="status" className="text-sm text-zinc-500">{dict.auth.confirming}</p> : null}
      {state === "ok" ? <Status tone="ok">{dict.auth.confirmed}</Status> : null}
      {state === "failed" ? <Status tone="error">{dict.auth.confirmFailed}</Status> : null}
      {state !== "pending" ? (
        <Link href={localeHref(locale, "/account")} className="w-fit underline">
          {dict.auth.toAccount}
        </Link>
      ) : null}
    </Card>
  );
}
