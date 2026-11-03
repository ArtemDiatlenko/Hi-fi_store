"use client";

// Подтверждение опасных действий (удаление, отмена заказа) в нативном модальном <dialog>:
// браузер сам запирает фокус внутри, закрывает по Esc и возвращает фокус на кнопку, открывшую диалог.
// По умолчанию фокус стоит на безопасной кнопке «Скасувати».

import { type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/admin/ui";
import { useI18n } from "@/lib/i18n/client";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

/** Возвращает элемент диалога (его нужно отрендерить) и функцию confirm(), которая ждёт ответа. */
export function useConfirm(): [ReactNode, (options: ConfirmOptions) => Promise<boolean>] {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ options, resolve });
      }),
    [],
  );

  const finish = useCallback(
    (confirmed: boolean) => {
      pending?.resolve(confirmed);
      setPending(null);
    },
    [pending],
  );

  // Страница может скрыться (Activity) с открытым диалогом — тогда считаем, что действие отменено.
  const finishRef = useRef(finish);
  useLayoutEffect(() => {
    finishRef.current = finish;
  });
  useLayoutEffect(() => () => finishRef.current(false), []);

  const element = pending ? <ConfirmDialog options={pending.options} onClose={finish} /> : null;
  return [element, confirm];
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (confirmed: boolean) => void }) {
  const { dict } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        onClose(false);
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="text-lg font-semibold">
          {options.title}
        </h2>
        <p id={messageId} className="text-sm text-zinc-700 dark:text-zinc-300">
          {options.message}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {/* autoFocus в модальном диалоге — фокус на безопасном варианте по умолчанию. */}
          <button type="button" autoFocus onClick={() => onClose(false)} className={buttonClass.secondary}>
            {options.cancelLabel ?? dict.admin.common.cancel}
          </button>
          <button type="button" onClick={() => onClose(true)} className={buttonClass.dangerSolid}>
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
