"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_ROLE } from "@/lib/admin/types";
import { clearToken, readToken } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";

interface Me {
  id: string;
  email: string | null;
  fullName: string | null;
  roles: string[];
  emailConfirmed: boolean;
}

/** Повторная отправка письма подтверждения (стандартный эндпоинт Identity, отвечает 200 всегда). */
function ResendConfirmation({ email }: { email: string }) {
  const { dict } = useI18n();
  const [state, setState] = useState<"idle" | "pending" | "sent" | "failed">("idle");

  async function resend() {
    setState("pending");
    try {
      const response = await fetch("/api/auth/resendConfirmationEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(response.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
      <p>{dict.account.emailNotConfirmed}</p>
      {state === "sent" ? (
        <p role="status">{tpl(dict.account.resendSent, { email })}</p>
      ) : (
        <button type="button" onClick={resend} disabled={state === "pending"} className="w-fit underline disabled:opacity-60">
          {state === "pending" ? dict.auth.pleaseWait : dict.account.resendConfirmation}
        </button>
      )}
      {state === "failed" ? <p role="alert" className="text-red-700 dark:text-red-400">{dict.auth.noConnection}</p> : null}
    </div>
  );
}

type State =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "error"; message: string }
  | { status: "ready"; me: Me };

export function AccountView() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function load(): Promise<State> {
      const token = readToken();
      if (!token) {
        return { status: "anonymous" };
      }

      try {
        const response = await fetch("/api/account/me", { headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 401) {
          clearToken();
          return { status: "anonymous" };
        }
        if (!response.ok) {
          return { status: "error", message: tpl(dict.account.loadError, { status: response.status }) };
        }
        return { status: "ready", me: (await response.json()) as Me };
      } catch {
        return { status: "error", message: dict.common.noConnection };
      }
    }

    load().then((next) => {
      if (active) {
        setState(next);
      }
    });

    return () => {
      active = false;
    };
  }, [dict]);

  function logout() {
    clearToken();
    router.push(localeHref(locale, "/login"));
    router.refresh();
  }

  if (state.status === "loading") {
    return <p className="text-sm text-zinc-500">{dict.account.loading}</p>;
  }

  if (state.status === "anonymous") {
    return (
      <p className="text-sm">
        {dict.account.notSignedIn}
        <Link href={localeHref(locale, "/login")} className="underline">
          {dict.account.login}
        </Link>
      </p>
    );
  }

  if (state.status === "error") {
    return <p role="alert" className="text-sm text-red-600">{state.message}</p>;
  }

  const { me } = state;
  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">{dict.account.title}</h1>
      {me.email && !me.emailConfirmed ? <ResendConfirmation email={me.email} /> : null}
      <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
        <dt className="text-zinc-500">{dict.account.email}</dt>
        <dd>
          {me.email}
          {me.emailConfirmed ? (
            <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
              {dict.account.emailConfirmed}
            </span>
          ) : null}
        </dd>
        <dt className="text-zinc-500">{dict.account.name}</dt>
        <dd>{me.fullName ?? dict.account.emptyValue}</dd>
        <dt className="text-zinc-500">{dict.account.roles}</dt>
        <dd>{me.roles.length > 0 ? me.roles.join(", ") : dict.account.emptyValue}</dd>
      </dl>
      <Link href={localeHref(locale, "/account/orders")} className="w-fit underline">
        {dict.account.myOrders}
      </Link>
      {me.roles.includes(ADMIN_ROLE) ? (
        <Link href={localeHref(locale, "/admin")} className="w-fit underline">
          {dict.admin.access.accountLink}
        </Link>
      ) : null}
      <button
        type="button"
        onClick={logout}
        className="min-h-11 w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
      >
        {dict.account.logout}
      </button>
    </div>
  );
}
