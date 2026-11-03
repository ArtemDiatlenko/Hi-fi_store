// Токен хранится в localStorage только в браузере. Это удобство для демо-версии:
// для продакшена лучше httpOnly-cookie, выставляемая API или Route Handler.
export const TOKEN_STORAGE_KEY = "hifistore.accessToken";

/**
 * Событие окна о входе или выходе в этой вкладке. Событие storage приходит только в другие
 * вкладки, поэтому шапка (lib/session) слушает ещё и его.
 */
export const AUTH_CHANGE_EVENT = "hifistore:auth-change";

function notifyAuthChange(): void {
  try {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  } catch {
    // Вне браузера сообщать некому.
  }
}

export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Сохраняет токен после входа. Бросает исключение, если хранилище недоступно (приватный режим и т. п.). */
export function saveToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  notifyAuthChange();
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
  notifyAuthChange();
}
