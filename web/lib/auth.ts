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

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Хранилище недоступно — выходить нечего.
  }
}
