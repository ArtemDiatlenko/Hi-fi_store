"use client";

// true только после гидратации в браузере, false на сервере и при первом клиентском рендере.
// Через useSyncExternalStore — без setState в эффекте и без рассинхронизации гидратации.

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
