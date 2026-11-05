"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useState } from "react";
import { PhoneInput } from "@/components/phone-input";
import { ADMIN_ROLE } from "@/lib/admin/types";
import { clearToken, readToken } from "@/lib/auth";
import { readProblem } from "@/lib/client-api";
import { isValidInternationalPhone } from "@/lib/phone";
import { translateServerMessage } from "@/lib/i18n/server-messages";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";
import { authUrl } from "@/lib/auth-locale";

interface Me {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  roles: string[];
  emailConfirmed: boolean;
}

/** Повторная отправка письма подтверждения (стандартный эндпоинт Identity, отвечает 200 всегда). */
function ResendConfirmation({ email }: { email: string }) {
  const { locale, dict } = useI18n();
  const [state, setState] = useState<"idle" | "pending" | "sent" | "failed">("idle");

  async function resend() {
    setState("pending");
    try {
      const response = await fetch(authUrl("/api/auth/resendConfirmationEmail", locale), {
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

/** Имя и телефон: подставляются при оформлении заказа и в заявке на консультацию. */
function ProfileForm({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const { locale, dict } = useI18n();
  const t = dict.account;
  const baseId = useId();
  const [fullName, setFullName] = useState(me.fullName ?? "");
  const [phone, setPhone] = useState(me.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [state, setState] = useState<"idle" | "pending" | "saved" | "failed">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "pending") return;
    if (phone && !isValidInternationalPhone(phone)) {
      setErrors({ phone: [dict.common.phoneInvalid] });
      return;
    }
    setErrors({});
    setState("pending");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${readToken() ?? ""}` },
        body: JSON.stringify({ fullName, phone }),
      });
      if (response.ok) {
        onSaved((await response.json()) as Me);
        setState("saved");
        return;
      }
      const problem = await readProblem(response);
      const fieldErrors: Record<string, string[]> = {};
      for (const [key, messages] of Object.entries(problem.errors ?? {})) {
        fieldErrors[key] = messages.map((message) => translateServerMessage(message, locale));
      }
      setErrors(fieldErrors);
      setState(Object.keys(fieldErrors).length > 0 ? "idle" : "failed");
    } catch {
      setState("failed");
    }
  }

  const inputClass = (invalid: boolean) =>
    `min-h-11 rounded-md border px-3 py-2 text-base dark:bg-zinc-900 ${invalid ? "border-red-600 dark:border-red-500" : "border-zinc-300 dark:border-zinc-700"}`;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <h2 className="text-xl font-light">{t.profile}</h2>
      <p className="text-xs text-zinc-500">{t.profileHint}</p>
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor={`${baseId}-name`} className="font-medium">{t.name}</label>
        <input
          id={`${baseId}-name`}
          autoComplete="name"
          maxLength={200}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          aria-invalid={errors.fullName?.length ? true : undefined}
          aria-describedby={errors.fullName?.length ? `${baseId}-name-error` : undefined}
          className={inputClass(!!errors.fullName?.length)}
        />
        {errors.fullName?.length ? <p id={`${baseId}-name-error`} className="text-sm text-red-700 dark:text-red-400">{errors.fullName.join(" ")}</p> : null}
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor={`${baseId}-phone`} className="font-medium">{t.phone}</label>
        <PhoneInput
          id={`${baseId}-phone`}
          locale={locale}
          countryLabel={dict.common.phoneCountry}
          value={phone}
          onChange={(value) => {
            setPhone(value);
            setErrors((current) => (current.phone ? { ...current, phone: [] } : current));
          }}
          invalid={!!errors.phone?.length}
          describedBy={errors.phone?.length ? `${baseId}-phone-error` : undefined}
        />
        {errors.phone?.length ? <p id={`${baseId}-phone-error`} className="text-sm text-red-700 dark:text-red-400">{errors.phone.join(" ")}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === "pending"} className="stage-button">
          {state === "pending" ? dict.auth.pleaseWait : t.saveProfile}
        </button>
        <p role="status" className="text-sm text-emerald-400">{state === "saved" ? t.profileSaved : ""}</p>
        {state === "failed" ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{dict.common.noConnection}</p> : null}
      </div>
    </form>
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
      <h1 className="text-[2rem] leading-tight font-light">{dict.account.title}</h1>
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
        {/* Роли — служебная информация: покупателю «Customer» ничего не говорит, показываем только администратору. */}
        {me.roles.includes(ADMIN_ROLE) ? (
          <>
            <dt className="text-zinc-500">{dict.account.roles}</dt>
            <dd>{me.roles.join(", ")}</dd>
          </>
        ) : null}
      </dl>
      <ProfileForm me={me} onSaved={(next) => setState({ status: "ready", me: next })} />
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
