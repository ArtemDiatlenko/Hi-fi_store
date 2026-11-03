"use client";

// Оболочка админки: проверка доступа и навигация. Токен живёт в localStorage, поэтому проверка
// идёт в браузере: GET /api/account/me → роль Admin. Без токена — ссылка на вход (с возвратом сюда),
// без роли — «нет доступа». Страницы админки рендерятся только для администратора. Сам API тоже
// проверяет роль (401/403) — это не только интерфейсная защита.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense, useCallback, useEffect, useId, useMemo, useState } from "react";
import { buttonClass, LoadError } from "@/components/admin/ui";
import { ShieldIcon } from "@/components/icons";
import { ADMIN_ROLE, type Me } from "@/lib/admin/types";
import { AdminSessionProvider, type AuthProblem } from "@/lib/admin/session";
import { clearToken, readToken } from "@/lib/auth";
import { authHeaders } from "@/lib/client-api";
import { useI18n } from "@/lib/i18n/client";
import { localeHref, stripLocalePrefix } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";

type Gate =
  | { status: "checking" }
  | { status: "anonymous"; returnTo: string }
  | { status: "forbidden"; me: Me; reason: "role" | "token"; returnTo: string }
  | { status: "error"; httpStatus: number | null }
  | { status: "ready"; me: Me };

function currentLocation(): string {
  return window.location.pathname + window.location.search;
}

async function checkAccess(): Promise<Gate> {
  const returnTo = currentLocation();
  const token = readToken();
  if (!token) {
    return { status: "anonymous", returnTo };
  }
  try {
    const response = await fetch("/api/account/me", { headers: authHeaders(token), cache: "no-store" });
    if (response.status === 401) {
      clearToken();
      return { status: "anonymous", returnTo };
    }
    if (!response.ok) {
      return { status: "error", httpStatus: response.status };
    }
    const me = (await response.json()) as Me;
    return me.roles.includes(ADMIN_ROLE) ? { status: "ready", me } : { status: "forbidden", me, reason: "role", returnTo };
  } catch {
    return { status: "error", httpStatus: null };
  }
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { locale, dict } = useI18n();
  const [gate, setGate] = useState<Gate>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);

  // Повторяется и при возврате в админку (Activity): выход или смена пользователя в другом месте учитываются.
  useEffect(() => {
    let active = true;
    checkAccess().then((next) => {
      if (active) {
        setGate(next);
      }
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  const reportAuthProblem = useCallback((problem: AuthProblem) => {
    const returnTo = currentLocation();
    if (problem === "unauthorized") {
      clearToken();
      setGate({ status: "anonymous", returnTo });
      return;
    }
    setGate((current) => (current.status === "ready" ? { status: "forbidden", me: current.me, reason: "token", returnTo } : current));
  }, []);

  const session = useMemo(
    () => (gate.status === "ready" ? { me: gate.me, reportAuthProblem } : null),
    [gate, reportAuthProblem],
  );

  if (gate.status === "checking") {
    return (
      <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">
        {dict.admin.access.checking}
      </p>
    );
  }

  if (gate.status === "error") {
    return (
      <LoadError
        message={gate.httpStatus === null ? dict.admin.common.noConnection : tpl(dict.admin.access.loadError, { status: gate.httpStatus })}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  if (gate.status === "anonymous" || gate.status === "forbidden") {
    const loginHref = `${localeHref(locale, "/login")}?next=${encodeURIComponent(gate.returnTo)}`;
    const forbidden = gate.status === "forbidden";
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight">{forbidden ? dict.admin.access.forbiddenTitle : dict.admin.access.signInTitle}</h1>
        <p className="text-zinc-700 dark:text-zinc-300">
          {!forbidden
            ? dict.admin.access.signInText
            : gate.reason === "token"
              ? dict.admin.access.staleRoleText
              : tpl(dict.admin.access.forbiddenText, { email: gate.me.email ?? dict.admin.common.emptyValue })}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={loginHref} className={buttonClass.primary}>
            {forbidden ? dict.admin.access.signInAnother : dict.admin.access.signIn}
          </Link>
          <Link href={localeHref(locale, "/catalog")} className={buttonClass.secondary}>
            {dict.admin.access.backToStore}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdminSessionProvider value={session!}>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-10">
        <Suspense fallback={<AdminNav activePath={null} email={gate.me.email} />}>
          <ActiveAdminNav email={gate.me.email} />
        </Suspense>
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </AdminSessionProvider>
  );
}

// usePathname под Cache Components может приостановиться (динамические параметры), поэтому
// навигация с подсветкой текущего раздела — внутри Suspense, а запасной вариант — та же навигация без подсветки.
function ActiveAdminNav({ email }: { email: string | null }) {
  const pathname = usePathname();
  return <AdminNav activePath={stripLocalePrefix(pathname)} email={email} />;
}

type SectionKey = "dashboard" | "products" | "categories" | "brands" | "orders";

// Списки — во множественном числе, страницы записей — в единственном (/admin/product/{id}), см. admin/layout.tsx.
const SECTIONS: { key: SectionKey; path: string; itemPath?: string }[] = [
  { key: "dashboard", path: "/admin" },
  { key: "products", path: "/admin/products", itemPath: "/admin/product" },
  { key: "categories", path: "/admin/categories", itemPath: "/admin/category" },
  { key: "brands", path: "/admin/brands" },
  { key: "orders", path: "/admin/orders", itemPath: "/admin/order" },
];

function isActive(section: { path: string; itemPath?: string }, activePath: string | null): boolean {
  if (activePath === null) {
    return false;
  }
  if (section.path === "/admin") {
    return activePath === "/admin";
  }
  return [section.path, section.itemPath].some(
    (path) => path !== undefined && (activePath === path || activePath.startsWith(`${path}/`)),
  );
}

function AdminNav({ activePath, email }: { activePath: string | null; email: string | null }) {
  const { locale, dict } = useI18n();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const current = SECTIONS.find((section) => isActive(section, activePath));

  const links = (onNavigate?: () => void) => (
    <ul className="flex flex-col gap-1">
      {SECTIONS.map((section) => {
        const active = isActive(section, activePath);
        return (
          <li key={section.key}>
            <Link
              href={localeHref(locale, section.path)}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm font-medium ${
                active
                  ? "border-amber-600/40 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
                  : "border-transparent text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
              }`}
            >
              <NavIcon section={section.key} />
              {dict.admin.nav[section.key]}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Десктоп: боковая панель */}
      <nav aria-label={dict.admin.nav.label} className="sticky top-6 hidden flex-col gap-4 lg:flex">
        <div className="flex items-center gap-3 px-3">
          <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-amber-400 dark:bg-amber-400/15 dark:text-amber-300">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <div className="flex min-w-0 flex-col">
            <p className="text-sm font-semibold tracking-tight">{dict.admin.title}</p>
            {email ? <p className="truncate text-xs text-zinc-500 dark:text-zinc-400" title={email}>{email}</p> : null}
          </div>
        </div>
        {links()}
        <Link href={localeHref(locale, "/catalog")} className="mx-3 w-fit text-sm text-zinc-600 underline underline-offset-2 hover:text-accent dark:text-zinc-400">
          {dict.admin.nav.toStore}
        </Link>
      </nav>

      {/* Мобильные: компактное раскрывающееся меню */}
      <nav aria-label={dict.admin.nav.label} className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <span className="flex min-w-0 items-center gap-2">
            <ShieldIcon className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <span className="font-semibold">{dict.admin.title}</span>
            {current ? (
              <span className="truncate text-zinc-500 dark:text-zinc-400">· {dict.admin.nav[current.key]}</span>
            ) : null}
          </span>
          <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 motion-safe:transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
          <span className="sr-only">{dict.admin.nav.menu}</span>
        </button>
        <div
          id={listId}
          hidden={!open}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="mt-2 rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {links(() => setOpen(false))}
          {email ? <p className="truncate px-3 pt-2 text-xs text-zinc-500 dark:text-zinc-400">{tpl(dict.admin.access.signedInAs, { email })}</p> : null}
        </div>
      </nav>
    </>
  );
}

function NavIcon({ section }: { section: SectionKey }) {
  const paths: Record<SectionKey, string> = {
    dashboard: "M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6v-9h-6v9zm0-16v5h6V4h-6z",
    products: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    categories: "M4 6h16M4 12h10M4 18h6",
    brands: "M7 7h.01M7 3h5l8.5 8.5a2 2 0 010 2.8l-5.2 5.2a2 2 0 01-2.8 0L4 11V6a3 3 0 013-3z",
    orders: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h4",
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[section]} />
    </svg>
  );
}
