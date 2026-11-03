// Запросы админки к /api/admin/... (Next проксирует их на ASP.NET Core API) и разбор ошибок.
// Модуль без React: хуки с учётом сессии — в lib/admin/session.tsx.

import { readProblem, type ProblemBody } from "@/lib/client-api";
import type { Locale } from "@/lib/i18n/config";
import { translateServerMessage } from "@/lib/i18n/server-messages";

/** Результат запроса. status = 0 — нет связи с сервером. */
export type ApiOutcome<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; problem: ProblemBody };

export type ApiFailure = Extract<ApiOutcome<unknown>, { ok: false }>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function sendRequest<T>(path: string, token: string, options: RequestOptions = {}): Promise<ApiOutcome<T>> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  try {
    const response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, status: response.status, problem: await readProblem(response) };
    }
    if (response.status === 204) {
      return { ok: true, status: 204, data: undefined as T };
    }
    return { ok: true, status: response.status, data: (await response.json()) as T };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return { ok: false, status: 0, problem: {} };
  }
}

/** Ошибки по полям из ValidationProblemDetails, уже переведённые на язык интерфейса. */
export type FieldErrors = Record<string, string[]>;

export function translateMessages(messages: string[], locale: Locale): string[] {
  return messages.map((message) => translateServerMessage(message, locale));
}

/**
 * Делит ошибки сервера на «свои» (поля формы) и остальные. Ключи сервера — camelCase-имена полей
 * (price, specs.power_w, images[0].url); <c>mapKey</c> приводит их к ключам формы или возвращает null.
 */
export function splitFieldErrors(
  problem: ProblemBody,
  locale: Locale,
  mapKey: (key: string) => string | null,
): { fields: FieldErrors; other: string[] } {
  const fields: FieldErrors = {};
  const other: string[] = [];
  for (const [rawKey, messages] of Object.entries(problem.errors ?? {})) {
    const localized = translateMessages(messages, locale);
    const key = mapKey(rawKey.replace(/^\$\./, ""));
    if (key) {
      fields[key] = [...(fields[key] ?? []), ...localized];
    } else {
      other.push(...localized);
    }
  }
  return { fields, other };
}

/** Сообщение ProblemDetails (detail/title) на языке интерфейса; fallback — исходный текст. */
export function problemMessage(problem: ProblemBody, locale: Locale): string | null {
  const text = problem.detail ?? problem.title;
  return text ? translateServerMessage(text, locale) : null;
}

/**
 * Поле, к которому относится конфликт 409, — чтобы показать сообщение и рядом с полем: занятый slug
 * или артикул, занятый ключ характеристики, смена типа характеристики со значениями.
 * Сообщение «артикулом или slug» относится к обоим — тогда остаётся только общее сообщение.
 */
export function conflictField(problem: ProblemBody): "slug" | "sku" | "key" | "valueType" | null {
  const text = problem.detail ?? "";
  const sku = /артикул/i.test(text);
  const slug = /slug/i.test(text);
  if (sku && !slug) {
    return "sku";
  }
  if (slug && !sku) {
    return "slug";
  }
  if (/^Характеристика с ключом/.test(text)) {
    return "key";
  }
  if (/^Нельзя изменить тип характеристики/.test(text)) {
    return "valueType";
  }
  return null;
}

/**
 * Ставит фокус на первое (в порядке документа) поле с ошибкой внутри контейнера, иначе — на запасной
 * элемент (сводку ошибок). Вызывайте после рендера с ошибками — через useAfterCommit.
 */
export function focusFirstInvalid(container: HTMLElement | null, fallback?: HTMLElement | null): void {
  const invalid = container?.querySelector<HTMLElement>('[aria-invalid="true"]');
  (invalid ?? fallback)?.focus();
}

/** Строка формы → число для API: пустая строка → null; запятая как десятичный разделитель допустима. */
export function parseDecimal(value: string): number | string | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const normalized = trimmed.replace(",", ".");
  // Некорректное число отправляем строкой — сервер вернёт понятную ошибку по полю.
  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : trimmed;
}

/** Значение для поля ввода из числа API. */
export function numberToInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}
