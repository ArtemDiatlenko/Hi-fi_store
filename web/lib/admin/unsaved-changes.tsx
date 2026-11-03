"use client";

// Защита от потери несохранённых правок. Форма вызывает useUnsavedChanges(dirty); пока хоть одна форма
// «грязная», провайдер (в оболочке админки) спрашивает подтверждение при уходе со страницы:
// - переход по ссылке внутри сайта — наш диалог подтверждения (клик перехватывается до Link);
// - закрытие или перезагрузка вкладки, внешние ссылки — стандартное предупреждение браузера (beforeunload).
// Регистрация — в эффекте: страницу, скрытую Next (Activity), React чистит от эффектов, и она не мешает другим.

import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { useI18n } from "@/lib/i18n/client";

type SetDirty = (id: string, dirty: boolean) => void;

const UnsavedChangesContext = createContext<SetDirty | null>(null);

/** Ссылка, переход по которой нужно подтвердить: обычный клик по ссылке на другую страницу этого сайта. */
function guardedHref(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }
  const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) {
    return null;
  }
  const url = new URL(anchor.href, window.location.href);
  // Внешние адреса уходят со страницы целиком — их подтверждает beforeunload.
  if (url.origin !== window.location.origin) {
    return null;
  }
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return null;
  }
  return url.pathname + url.search + url.hash;
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const { dict } = useI18n();
  const router = useRouter();
  const [confirmElement, confirm] = useConfirm();
  const dirtyIds = useRef(new Set<string>());
  const [hasDirty, setHasDirty] = useState(false);

  const setDirty = useCallback<SetDirty>((id, dirty) => {
    if (dirty) {
      dirtyIds.current.add(id);
    } else {
      dirtyIds.current.delete(id);
    }
    setHasDirty(dirtyIds.current.size > 0);
  }, []);

  useEffect(() => {
    if (!hasDirty) {
      return;
    }
    const t = dict.admin.unsaved;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    function onClick(event: MouseEvent) {
      const href = guardedHref(event);
      if (href === null) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void confirm({ title: t.title, message: t.text, confirmLabel: t.leave, cancelLabel: t.stay }).then((confirmed) => {
        if (confirmed) {
          router.push(href);
        }
      });
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    // Фаза перехвата на document срабатывает раньше обработчика Link (React слушает на корневом элементе).
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [hasDirty, confirm, dict, router]);

  return (
    <UnsavedChangesContext.Provider value={setDirty}>
      {children}
      {confirmElement}
    </UnsavedChangesContext.Provider>
  );
}

/** Отмечает форму как содержащую несохранённые правки, пока dirty = true. */
export function useUnsavedChanges(dirty: boolean): void {
  const setDirty = useContext(UnsavedChangesContext);
  const id = useId();
  useEffect(() => {
    if (!setDirty || !dirty) {
      return;
    }
    setDirty(id, true);
    return () => setDirty(id, false);
  }, [setDirty, id, dirty]);
}
