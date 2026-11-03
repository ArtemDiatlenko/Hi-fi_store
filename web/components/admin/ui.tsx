"use client";

// Общие элементы интерфейса админки: поля формы с ошибками, сводка ошибок, уведомления, кнопки.
// Идентификаторы полей — через useId: Next с Cache Components скрывает, а не размонтирует страницы
// (Activity), поэтому одинаковые id на разных страницах оказались бы в документе одновременно.

import Link from "next/link";
import { type ReactNode, type Ref, useId } from "react";
import { useI18n } from "@/lib/i18n/client";

export const buttonClass = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-amber-300",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-400 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
  danger:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950",
  dangerSolid:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60",
  icon:
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
  link: "inline-flex min-h-11 items-center underline underline-offset-2 hover:text-accent",
} as const;

export function inputClass(invalid: boolean): string {
  return `min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-base dark:bg-zinc-950 ${
    invalid ? "border-red-600 dark:border-red-500" : "border-zinc-300 dark:border-zinc-700"
  }`;
}

export interface ControlProps {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: true;
  className: string;
}

interface FieldProps {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string[];
  className?: string;
  children: (control: ControlProps) => ReactNode;
}

/** Подпись, поле, подсказка и ошибка, связанные через aria-describedby. */
export function Field({ label, required, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error?.length ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`flex min-w-0 flex-col gap-1 text-sm ${className ?? ""}`}>
      <label htmlFor={id} className="font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-red-600">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        "aria-invalid": errorId ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required ? true : undefined,
        className: inputClass(Boolean(errorId)),
      })}
      {errorId ? (
        <p id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {error!.join(" ")}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface FormProblem {
  title: string;
  messages: string[];
  hasFieldErrors?: boolean;
}

/** Сводка ошибок формы. Получает фокус, если ошибка не относится к конкретному полю. */
export function FormAlert({ problem, ref }: { problem: FormProblem | null; ref?: Ref<HTMLDivElement> }) {
  const { dict } = useI18n();
  if (!problem) {
    return null;
  }
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      <p className="font-medium">{problem.title}</p>
      {problem.messages.length > 0 ? (
        <ul className="mt-2 list-disc pl-5">
          {problem.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      {problem.hasFieldErrors ? <p className="mt-2">{dict.admin.common.fixFields}</p> : null}
    </div>
  );
}

/** Сообщение об успешном действии (живой регион: экранные читалки зачитают его без переноса фокуса). */
export function Notice({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  const { dict } = useI18n();
  return (
    <div role="status" aria-live="polite" className="empty:hidden">
      {message ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          <span className="py-1">{message}</span>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={dict.admin.common.dismiss}
              className="-m-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-green-100 dark:hover:bg-green-900"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Ошибка загрузки с кнопкой повтора. */
export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { dict } = useI18n();
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="underline">
          {dict.admin.common.retry}
        </button>
      ) : null}
    </div>
  );
}

export function PageHeader({ title, back, actions, children }: { title: ReactNode; back?: { href: string; label: string }; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-2">
      {back ? (
        <Link href={back.href} className="w-fit text-sm text-zinc-600 underline underline-offset-2 hover:text-accent dark:text-zinc-400">
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function Section({ title, description, children, actions }: { title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={id} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function PublishedBadge({ published }: { published: boolean }) {
  const { dict } = useI18n();
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
        published
          ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200"
          : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      }`}
    >
      {published ? dict.admin.products.published : dict.admin.products.draft}
    </span>
  );
}
