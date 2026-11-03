// Токен хранится в localStorage только в браузере. Это удобство для демо-версии:
// для продакшена лучше httpOnly-cookie, выставляемая API или Route Handler.
export const TOKEN_STORAGE_KEY = "hifistore.accessToken";

export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Адрес возврата после входа (?next=…), только внутри сайта: путь от корня, без «//» и «/\»
 * (иначе это был бы переход на чужой домен — open redirect). Некорректное значение → null.
 */
export function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null;
  } catch {
    return null;
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Хранилище недоступно — выходить нечего.
  }
}
