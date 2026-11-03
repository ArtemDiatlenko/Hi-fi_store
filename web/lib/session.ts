"use client";

// Состояние входа для шапки: кто вошёл и с какими ролями (GET /api/account/me с bearer-токеном
// из localStorage). Одно хранилище на вкладку — десктопная навигация и мобильное меню не делают
// отдельных запросов. Пересчитывается при входе/выходе в этой вкладке (AUTH_CHANGE_EVENT)
// и в других вкладках (storage). На сервере и при гидратации состояние — «loading».

import { useSyncExternalStore } from "react";
import { AUTH_CHANGE_EVENT, clearToken, readToken, TOKEN_STORAGE_KEY } from "@/lib/auth";

export interface CurrentUser {
  id: string;
  email: string | null;
  fullName: string | null;
  roles: string[];
}

export type Session =
  | { status: "loading" }
  | { status: "anonymous" }
  /** user = null: токен есть, но профиль не загрузился (нет связи) — считаем вошедшим без ролей. */
  | { status: "authenticated"; user: CurrentUser | null };

export const ADMIN_ROLE = "Admin";

const LOADING: Session = { status: "loading" };
const ANONYMOUS: Session = { status: "anonymous" };

let snapshot: Session = LOADING;
// undefined — токен ещё не проверяли; иначе — токен, для которого посчитан snapshot.
let checkedToken: string | null | undefined;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

function publish(next: Session): void {
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

async function loadUser(token: string, signal: AbortSignal): Promise<Session> {
  try {
    const response = await fetch("/api/account/me", { headers: { Authorization: `Bearer ${token}` }, signal });
    if (response.status === 401) {
      return ANONYMOUS;
    }
    if (!response.ok) {
      return { status: "authenticated", user: null };
    }
    return { status: "authenticated", user: (await response.json()) as CurrentUser };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return { status: "authenticated", user: null };
  }
}

function sync(): void {
  const token = readToken();
  if (token === checkedToken) {
    return;
  }
  checkedToken = token;
  controller?.abort();
  controller = null;

  if (!token) {
    publish(ANONYMOUS);
    return;
  }

  const current = new AbortController();
  controller = current;
  publish(LOADING);
  loadUser(token, current.signal).then(
    (next) => {
      if (controller !== current) {
        return;
      }
      controller = null;
      if (next.status === "anonymous") {
        // Токен просрочен или отозван — убираем его, как и личный кабинет.
        clearToken();
      }
      publish(next);
    },
    () => {
      // Запрос отменён более новым — результат не нужен.
    },
  );
}

function onStorage(event: StorageEvent): void {
  if (event.key === TOKEN_STORAGE_KEY || event.key === null) {
    sync();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener(AUTH_CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
  }
  sync();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener(AUTH_CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getSnapshot(): Session {
  return snapshot;
}

function getServerSnapshot(): Session {
  return LOADING;
}

export function useSession(): Session {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function isAdmin(session: Session): boolean {
  return session.status === "authenticated" && (session.user?.roles.includes(ADMIN_ROLE) ?? false);
}
