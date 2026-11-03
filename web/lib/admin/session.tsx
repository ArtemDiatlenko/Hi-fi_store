"use client";

// Сессия администратора на клиенте: кто вошёл и запросы к /api/admin с его токеном.
// AdminShell проверяет роль через /api/account/me и только потом рендерит страницы админки,
// поэтому внутри них useAdminSession() всегда возвращает администратора.
//
// Ответы 401/403 от административного API сообщаются оболочке: 401 — токен истёк (показываем вход),
// 403 — роль в токене не подтверждена (например, роль выдали после входа: роли попадают в токен при выдаче).

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { readToken } from "@/lib/auth";
import { type ApiOutcome, type RequestOptions, sendRequest } from "@/lib/admin/api";
import type { Me } from "@/lib/admin/types";

export type AuthProblem = "unauthorized" | "forbidden";

interface AdminSessionValue {
  me: Me;
  reportAuthProblem: (problem: AuthProblem) => void;
}

const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export function AdminSessionProvider({ value, children }: { value: AdminSessionValue; children: ReactNode }) {
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionValue {
  const value = useContext(AdminSessionContext);
  if (value === null) {
    throw new Error("useAdminSession must be used within AdminShell");
  }
  return value;
}

export type AdminRequest = <T>(path: string, options?: RequestOptions) => Promise<ApiOutcome<T>>;

/** Запрос к API с токеном текущего администратора; 401/403 переключают оболочку на вход или «нет доступа». */
export function useAdminRequest(): AdminRequest {
  const { reportAuthProblem } = useAdminSession();
  return useCallback(
    async <T,>(path: string, options?: RequestOptions): Promise<ApiOutcome<T>> => {
      const token = readToken();
      if (!token) {
        reportAuthProblem("unauthorized");
        return { ok: false, status: 401, problem: {} };
      }
      const outcome = await sendRequest<T>(path, token, options);
      if (!outcome.ok && outcome.status === 401) {
        reportAuthProblem("unauthorized");
      } else if (!outcome.ok && outcome.status === 403) {
        reportAuthProblem("forbidden");
      }
      return outcome;
    },
    [reportAuthProblem],
  );
}

export interface AdminQuery<T> {
  /** Последние успешно загруженные данные (при смене адреса остаются до прихода новых). */
  data: T | null;
  /** Ошибка последней загрузки этого адреса. */
  error: { status: number } | null;
  loading: boolean;
  reload: () => void;
  /** Подменяет данные ответом мутации (например, сохранённым товаром) без повторного запроса. */
  setData: (data: T) => void;
}

interface QueryResult<T> {
  key: string;
  data: T | null;
  error: { status: number } | null;
}

/**
 * GET-запрос к административному API. <c>path = null</c> — пока не загружать.
 * Эффект повторяется и при возврате на страницу (Activity в Next скрывает, а не размонтирует страницы),
 * поэтому данные обновляются при каждом показе.
 */
export function useAdminQuery<T>(path: string | null): AdminQuery<T> {
  const request = useAdminRequest();
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<QueryResult<T> | null>(null);
  const key = path === null ? null : `${version}:${path}`;

  useEffect(() => {
    if (path === null || key === null) {
      return;
    }
    let active = true;
    request<T>(path).then((outcome) => {
      if (!active) {
        return;
      }
      setResult((previous) =>
        outcome.ok
          ? { key, data: outcome.data, error: null }
          : { key, data: previous?.data ?? null, error: { status: outcome.status } },
      );
    });
    return () => {
      active = false;
    };
  }, [path, key, request]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const setData = useCallback(
    (data: T) => setResult({ key: key ?? "", data, error: null }),
    [key],
  );

  const current = result !== null && result.key === key;
  return {
    data: result?.data ?? null,
    error: current ? result.error : null,
    loading: key !== null && !current,
    reload,
    setData,
  };
}
