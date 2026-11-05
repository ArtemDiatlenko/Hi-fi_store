// Пересчёт корзины по каталогу: при каждом изменении корзины запрашивает актуальные цены и наличие.

import { useCallback, useEffect, useState } from "react";
import type { CartItem } from "@/lib/cart";
import { fetchCartQuote } from "@/lib/client-api";
import { useI18n } from "@/lib/i18n/client";
import type { CartQuote } from "@/lib/orders";

interface QuoteState {
  key: string;
  attempt: number;
  quote: CartQuote | null;
  error: string | null;
}

export interface CartQuoteView {
  /** Последний полученный расчёт; пока идёт пересчёт — предыдущий (см. <c>loading</c>). */
  quote: CartQuote | null;
  /** Расчёт соответствует текущему содержимому корзины. */
  fresh: boolean;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useCartQuote(items: CartItem[] | null): CartQuoteView {
  const key = items && items.length > 0 ? JSON.stringify(items) : null;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<QuoteState | null>(null);
  const { locale } = useI18n();

  useEffect(() => {
    if (key === null) {
      return;
    }
    const controller = new AbortController();
    fetchCartQuote(JSON.parse(key) as CartItem[], locale, controller.signal)
      .then((result) => {
        setState(
          result.ok
            ? { key, attempt, quote: result.quote, error: null }
            : (previous) => ({ key, attempt, quote: previous?.quote ?? null, error: result.message }),
        );
      })
      .catch(() => {
        // Запрос отменён: корзина изменилась или компонент размонтирован.
      });
    return () => controller.abort();
  }, [key, attempt, locale]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  if (key === null) {
    return { quote: null, fresh: true, loading: false, error: null, reload };
  }

  const current = state !== null && state.key === key && state.attempt === attempt;
  return {
    quote: state?.quote ?? null,
    fresh: current && state.error === null,
    loading: !current,
    error: current ? state.error : null,
    reload,
  };
}
