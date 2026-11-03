"use client";

// Оболочка админки: проверка доступа и навигация. Токен живёт в localStorage, поэтому проверка
// идёт в браузере: GET /api/account/me → роль Admin. Без токена — ссылка на вход (с возвратом сюда),
// без роли — «нет доступа». Страницы админки рендерятся только для администратора. Сам API тоже
// проверяет роль (401/403) — это не только интерфейсная защита.
//
// Раскладка своя, без шапки и подвала витрины (они в app/[lang]/(store)/layout.tsx): на десктопе —
// боковая панель во всю высоту, на телефонах — верхняя панель с раскрывающимся меню.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, Suspense, useCallback, useEffect, useId, useMemo, useState } from "react";
import { buttonClass, LoadError } from "@/components/admin/ui";
import { LogoMark } from "@/components/icons";
import { LanguageSwitcher, LanguageSwitcherFallback } from "@/components/language-switcher";
import { ADMIN_ROLE, type Me } from "@/lib/admin/types";
import { AdminSessionProvider, type AuthProblem } from "@/lib/admin/session";
import { UnsavedChangesProvider } from "@/lib/admin/unsaved-changes";
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
      <GateScreen>
        <p role="status" className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          {dict.admin.access.checking}
        </p>
      </GateScreen>
    );
  }

  if (gate.status === "error") {
    return (
      <GateScreen>
        <LoadError
          message={gate.httpStatus === null ? dict.admin.common.noConnection : tpl(dict.admin.access.loadError, { status: gate.httpStatus })}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      </GateScreen>
    );
  }

  if (gate.status === "anonymous" || gate.status === "forbidden") {
    const loginHref = `${localeHref(locale, "/login")}?next=${encodeURIComponent(gate.returnTo)}`;
    const forbidden = gate.status === "forbidden";
    return (
      <GateScreen>
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
      </GateScreen>
    );
  }

  return (
    <AdminSessionProvider value={session!}>
      <div className="flex min-h-dvh flex-1 flex-col bg-zinc-50 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] dark:bg-zinc-950">
        <Suspense fallback={<AdminNav activePath={null} email={gate.me.email} />}>
          <ActiveAdminNav email={gate.me.email} />
        </Suspense>
        <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
          </div>
        </main>
      </div>
    </AdminSessionProvider>
  );
}

/** Экраны до входа (проверка, вход, нет доступа, ошибка): логотип и карточка по центру. */
function GateScreen({ children }: { children: ReactNode }) {
  const { locale, dict } = useI18n();
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-4 py-12 outline-none dark:bg-zinc-950">
      <AdminLogo href={localeHref(locale, "/")} brand={dict.common.brand} badge={dict.admin.nav.badge} />
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}

function AdminLogo({ href, brand, badge }: { href: string; brand: string; badge: string }) {
  return (
    <Link href={href} className="inline-flex min-w-0 items-center gap-2.5 rounded-md text-base font-semibold tracking-tight">
      <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-amber-400 dark:bg-amber-400 dark:text-zinc-950">
        <LogoMark className="h-6 w-6" />
      </span>
      <span className="truncate">{brand}</span>
      <span className="rounded-md border border-amber-600/40 bg-amber-50 px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
        {badge}
      </span>
    </Link>
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const current = SECTIONS.find((section) => isActive(section, activePath));

  function signOut() {
    clearToken();
    router.push(localeHref(locale, "/login"));
  }

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

  // Низ панели: кто вошёл, переход на витрину, язык и выход.
  const account = (
    <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      {email ? (
        <div className="flex min-w-0 items-center gap-3 px-1">
          <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {email.charAt(0)}
          </span>
          <p className="min-w-0 truncate text-sm text-zinc-600 dark:text-zinc-400" title={email}>
            <span className="sr-only">{tpl(dict.admin.access.signedInAs, { email: "" })}</span>
            {email}
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <Link
          href={localeHref(locale, "/")}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
        >
          <StoreIcon />
          {dict.admin.nav.toStore}
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
        >
          <SignOutIcon />
          {dict.account.logout}
        </button>
      </div>
      <div className="px-1">
        <Suspense fallback={<LanguageSwitcherFallback />}>
          <LanguageSwitcher />
        </Suspense>
      </div>
    </div>
  );

  return (
    <>
      {/* Десктоп: боковая панель во всю высоту */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r border-zinc-200 bg-white px-4 py-6 lg:flex dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="px-1">
          <AdminLogo href={localeHref(locale, "/admin")} brand={dict.common.brand} badge={dict.admin.nav.badge} />
        </div>
        <nav aria-label={dict.admin.nav.label} className="flex-1">
          {links()}
        </nav>
        {account}
      </aside>

      {/* Телефоны и планшеты: верхняя панель и раскрывающееся меню */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <AdminLogo href={localeHref(locale, "/admin")} brand={dict.common.brand} badge={dict.admin.nav.badge} />
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
            className={buttonClass.icon}
          >
            <span className="sr-only">
              {dict.admin.nav.menu}
              {current ? `, ${tpl(dict.admin.nav.current, { name: dict.admin.nav[current.key] })}` : ""}
            </span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
            </svg>
          </button>
        </div>
        <div
          id={listId}
          hidden={!open}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="flex max-h-[calc(100dvh-4rem)] flex-col gap-4 overflow-y-auto border-t border-zinc-200 px-4 py-4 sm:px-6 dark:border-zinc-800"
        >
          <nav aria-label={dict.admin.nav.label}>{links(() => setOpen(false))}</nav>
          {account}
        </div>
      </header>
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
  return <OutlineIcon d={paths[section]} />;
}

function StoreIcon() {
  return <OutlineIcon d="M3 9l1.5-5h15L21 9M3 9h18M3 9v1a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0V9M5 13v7h14v-7M10 20v-4h4v4" />;
}

function SignOutIcon() {
  return <OutlineIcon d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 01-2-2V6a2 2 0 012-2h6" />;
}

function OutlineIcon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}
