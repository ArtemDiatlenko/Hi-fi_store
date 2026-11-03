"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken, readToken } from "@/lib/auth";

interface Me {
  id: string;
  email: string | null;
  fullName: string | null;
  roles: string[];
}

type State =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "error"; message: string }
  | { status: "ready"; me: Me };

export function AccountView() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function load() {
      const token = readToken();
      if (!token) {
        return { status: "anonymous" } as const;
      }

      try {
        const response = await fetch("/api/account/me", { headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 401) {
          clearToken();
          return { status: "anonymous" } as const;
        }
        if (!response.ok) {
          return { status: "error", message: `Не удалось загрузить профиль (${response.status}).` } as const;
        }
        return { status: "ready", me: (await response.json()) as Me } as const;
      } catch {
        return { status: "error", message: "Нет связи с сервером." } as const;
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
  }, []);

  function logout() {
    clearToken();
    router.push("/login");
    router.refresh();
  }

  if (state.status === "loading") {
    return <p className="text-sm text-zinc-500">Загрузка…</p>;
  }

  if (state.status === "anonymous") {
    return (
      <p className="text-sm">
        Вы не вошли в аккаунт. <Link href="/login" className="underline">Войти</Link>
      </p>
    );
  }

  if (state.status === "error") {
    return <p role="alert" className="text-sm text-red-600">{state.message}</p>;
  }

  const { me } = state;
  return (
    <div className="flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">Аккаунт</h1>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
        <dt className="text-zinc-500">Email</dt>
        <dd>{me.email}</dd>
        <dt className="text-zinc-500">Имя</dt>
        <dd>{me.fullName ?? "—"}</dd>
        <dt className="text-zinc-500">Роли</dt>
        <dd>{me.roles.length > 0 ? me.roles.join(", ") : "—"}</dd>
      </dl>
      <Link href="/account/orders" className="w-fit underline">
        Мои заказы
      </Link>
      <button
        type="button"
        onClick={logout}
        className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
      >
        Выйти
      </button>
    </div>
  );
}
