"use client";

// Действие после того, как React применит текущие изменения состояния к DOM. Нужно для управления
// фокусом: после ответа сервера поле с ошибкой (или сводка ошибок) появляется только в следующем
// рендере, а requestAnimationFrame может сработать раньше него.

import { useCallback, useEffect, useRef, useState } from "react";

export function useAfterCommit(): (action: () => void) => void {
  const [tick, setTick] = useState(0);
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    const action = pending.current;
    pending.current = null;
    action?.();
  }, [tick]);

  return useCallback((action: () => void) => {
    pending.current = action;
    setTick((value) => value + 1);
  }, []);
}
