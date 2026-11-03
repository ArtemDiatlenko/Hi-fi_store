// Помощники для запросов из браузера к /api/* (Next проксирует их на ASP.NET Core API).

import { readToken } from "@/lib/auth";
import type { CartItem } from "@/lib/cart";
import type { CartQuote, StockShortage } from "@/lib/orders";

/** Тело ответа об ошибке: ProblemDetails / ValidationProblemDetails. */
export interface ProblemBody {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
  items?: StockShortage[];
}

export async function readProblem(response: Response): Promise<ProblemBody> {
  try {
    const body: unknown = await response.json();
    return body && typeof body === "object" ? (body as ProblemBody) : {};
  } catch {
    return {};
  }
}

/** Заголовок Authorization, если пользователь вошёл. */
export function authHeaders(token: string | null = readToken()): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type QuoteResult = { ok: true; quote: CartQuote } | { ok: false; message: string };

export async function fetchCartQuote(items: CartItem[], signal?: AbortSignal): Promise<QuoteResult> {
  try {
    const response = await fetch("/api/cart/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      signal,
    });
    if (!response.ok) {
      const problem = await readProblem(response);
      const messages = problem.errors ? Object.values(problem.errors).flat() : [];
      return { ok: false, message: messages[0] ?? `Не удалось пересчитать корзину (${response.status}).` };
    }
    return { ok: true, quote: (await response.json()) as CartQuote };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return { ok: false, message: "Нет связи с сервером. Попробуйте ещё раз." };
  }
}
