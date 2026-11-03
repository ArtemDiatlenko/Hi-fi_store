"use client";

import Link from "next/link";
import { ShieldIcon, UserIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { isAdmin, useSession } from "@/lib/session";

const desktopLink =
  "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white";

const mobileLink =
  "flex min-h-11 items-center gap-3 rounded-lg px-2 text-base hover:bg-zinc-100 dark:hover:bg-zinc-900";

/**
 * Ссылки аккаунта в шапке: «Увійти» для гостя, «Акаунт» для вошедшего и «Адмін-панель» — только
 * при роли Admin (по GET /api/account/me). Пока статус неизвестен (сервер, гидратация, запрос),
 * на десктопе резервируем место, чтобы шапка не прыгала. Админ-панель — отдельный раздел за входом,
 * поэтому её не предзагружаем с каждой страницы витрины (prefetch={false}).
 */
export function AccountNav({ variant, onNavigate }: { variant: "desktop" | "mobile"; onNavigate?: () => void }) {
  const { locale, dict } = useI18n();
  const session = useSession();
  const admin = isAdmin(session);

  if (session.status === "loading") {
    return variant === "desktop" ? <span aria-hidden="true" className="inline-block h-10 w-24" /> : null;
  }

  const signedIn = session.status === "authenticated";
  const accountHref = localeHref(locale, signedIn ? "/account" : "/login");
  const accountLabel = signedIn ? dict.header.account : dict.header.login;
  const accountTitle = signedIn ? (session.user?.email ?? undefined) : undefined;

  if (variant === "desktop") {
    return (
      <>
        {admin ? (
          <Link
            href={localeHref(locale, "/admin")}
            prefetch={false}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-amber-600/40 bg-amber-50 px-3 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/20"
          >
            <ShieldIcon className="h-5 w-5" />
            {dict.header.admin}
          </Link>
        ) : null}
        <Link href={accountHref} title={accountTitle} className={desktopLink}>
          <UserIcon className="h-5 w-5" />
          {accountLabel}
        </Link>
      </>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      <li>
        <Link href={accountHref} onClick={onNavigate} className={mobileLink}>
          <UserIcon className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          {accountLabel}
        </Link>
      </li>
      {admin ? (
        <li>
          <Link href={localeHref(locale, "/admin")} prefetch={false} onClick={onNavigate} className={`${mobileLink} text-amber-800 dark:text-amber-300`}>
            <ShieldIcon className="h-5 w-5" />
            {dict.header.admin}
          </Link>
        </li>
      ) : null}
    </ul>
  );
}
