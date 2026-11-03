"use client";

// Изображения товара (PUT /api/admin/products/{id}/images): упорядоченный список адресов с alt.
// Порядок меняется кнопками «вгору/вниз» (доступны с клавиатуры), фокус остаётся на перемещённом
// изображении, а живой регион сообщает новую позицию. Первое изображение — главное.

import { type FormEvent, useRef, useState } from "react";
import { AdminThumb, useDebouncedValue } from "@/components/admin/thumb";
import { buttonClass, Field, FormAlert, type FormProblem } from "@/components/admin/ui";
import { type FieldErrors, focusFirstInvalid } from "@/lib/admin/api";
import { describeFailure } from "@/lib/admin/forms";
import type { AdminProductDetails } from "@/lib/admin/types";
import { useAdminRequest } from "@/lib/admin/session";
import { useAfterCommit } from "@/lib/admin/use-after-commit";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/util";
import { REMOTE_IMAGE_HOSTS } from "@/lib/image-hosts";

interface Row {
  uid: string;
  url: string;
  alt: string;
}

const MAX_IMAGES = 20;

/** Домен абсолютного адреса, которого нет среди доменов витрины (иначе null). */
function foreignHost(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    return REMOTE_IMAGE_HOSTS.includes(parsed.hostname) ? null : parsed.hostname;
  } catch {
    return null;
  }
}

export function ProductImagesEditor({ product, onSaved }: { product: AdminProductDetails; onSaved: (product: AdminProductDetails, message: string) => void }) {
  const { locale, dict } = useI18n();
  const t = dict.admin.images;
  const request = useAdminRequest();
  const [rows, setRows] = useState<Row[]>(() =>
    product.images.map((image, index) => ({ uid: `saved-${index}`, url: image.url, alt: image.alt ?? "" })),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [pending, setPending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const nextId = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const afterCommit = useAfterCommit();
  const addRef = useRef<HTMLButtonElement>(null);

  /** Фокус на элемент внутри формы после рендера (кнопки и поля строк появляются/меняются только в нём). */
  function focusAfterRender(selectors: string[], fallback?: () => HTMLElement | null) {
    afterCommit(() => {
      for (const selector of selectors) {
        const target = formRef.current?.querySelector<HTMLElement>(selector);
        if (target && !target.hasAttribute("disabled")) {
          target.focus();
          return;
        }
      }
      fallback?.()?.focus();
    });
  }

  function updateRow(uid: string, field: "url" | "alt", value: string) {
    setRows((current) => current.map((row) => (row.uid === uid ? { ...row, [field]: value } : row)));
    const key = `${uid}.${field}`;
    setErrors((current) => (current[key] ? { ...current, [key]: [] } : current));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) {
      return;
    }
    const uid = rows[index].uid;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    setAnnouncement(tpl(t.moved, { n: target + 1 }));
    // Фокус остаётся на перемещённом изображении: та же кнопка, а если она стала недоступна (край списка) — обратная.
    const action = delta < 0 ? "up" : "down";
    const other = delta < 0 ? "down" : "up";
    focusAfterRender([`[data-uid="${uid}"] [data-action="${action}"]`, `[data-uid="${uid}"] [data-action="${other}"]`]);
  }

  function remove(index: number) {
    const next = rows.filter((_, position) => position !== index);
    setRows(next);
    setAnnouncement(tpl(t.removed, { n: index + 1 }));
    const neighbour = next[index] ?? next[index - 1];
    focusAfterRender(neighbour ? [`[data-uid="${neighbour.uid}"] [data-action="remove"]`] : [], () => addRef.current);
  }

  function add() {
    nextId.current += 1;
    const uid = `new-${nextId.current}`;
    setRows((current) => [...current, { uid, url: "", alt: "" }]);
    setAnnouncement(tpl(t.added, { n: rows.length + 1 }));
    focusAfterRender([`[data-uid="${uid}"] input`]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setErrors({});
    setProblem(null);
    const snapshot = rows;
    const outcome = await request<AdminProductDetails>(`/api/admin/products/${product.id}/images`, {
      method: "PUT",
      body: { images: snapshot.map((row) => ({ url: row.url.trim(), alt: row.alt.trim() || null })) },
    });
    setPending(false);
    if (outcome.ok) {
      onSaved(outcome.data, t.saved);
      return;
    }
    if (outcome.status === 401 || outcome.status === 403) {
      return;
    }
    // images[2].url → поле строки, которая была третьей на момент отправки.
    const view = describeFailure(outcome, locale, dict, (key) => {
      const match = /^images\[(\d+)\](?:\.(url|alt))?$/.exec(key);
      const row = match ? snapshot[Number(match[1])] : undefined;
      return row ? `${row.uid}.${match![2] ?? "url"}` : null;
    });
    setErrors(view.fields);
    setProblem(view.problem);
    afterCommit(() => focusFirstInvalid(formRef.current, alertRef.current));
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormAlert ref={alertRef} problem={problem} />
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {rows.length === 0 ? <p className="text-sm text-zinc-500">{t.empty}</p> : null}

      <ol className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const host = foreignHost(row.url);
          const n = index + 1;
          return (
            <li key={row.uid} data-uid={row.uid} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 sm:flex-row dark:border-zinc-800">
              <div className="flex shrink-0 flex-row items-start gap-3 sm:flex-col">
                <RowPreview url={row.url} alt={row.alt || tpl(t.item, { n })} />
                <span className="flex items-center gap-2 text-xs text-zinc-500">
                  {tpl(t.item, { n })}
                  {index === 0 ? (
                    <span className="rounded-full bg-zinc-900 px-2 py-0.5 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">{t.main}</span>
                  ) : null}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <Field
                  label={t.url}
                  required
                  error={errors[`${row.uid}.url`]}
                  hint={host ? tpl(t.hostWarning, { hosts: REMOTE_IMAGE_HOSTS.join(", ") }) : undefined}
                >
                  {(control) => (
                    <input
                      {...control}
                      type="url"
                      inputMode="url"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={1000}
                      value={row.url}
                      onChange={(event) => updateRow(row.uid, "url", event.target.value)}
                    />
                  )}
                </Field>
                <Field label={t.alt} error={errors[`${row.uid}.alt`]}>
                  {(control) => <input {...control} maxLength={300} value={row.alt} onChange={(event) => updateRow(row.uid, "alt", event.target.value)} />}
                </Field>
              </div>
              <div className="flex shrink-0 gap-2 sm:flex-col">
                <button
                  type="button"
                  data-action="up"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={tpl(t.moveUp, { n })}
                  title={tpl(t.moveUp, { n })}
                  className={buttonClass.icon}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-6 6l6-6 6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  data-action="down"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                  aria-label={tpl(t.moveDown, { n })}
                  title={tpl(t.moveDown, { n })}
                  className={buttonClass.icon}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m6-6l-6 6-6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  data-action="remove"
                  onClick={() => remove(index)}
                  aria-label={tpl(t.remove, { n })}
                  title={tpl(t.remove, { n })}
                  className={`${buttonClass.icon} text-red-700 dark:text-red-400`}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5h6v2m-7 4v6m4-6v6m4-6v6M7 7l1 12h8l1-12" />
                  </svg>
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <button ref={addRef} type="button" onClick={add} disabled={rows.length >= MAX_IMAGES} className={buttonClass.secondary}>
          {t.add}
        </button>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? dict.admin.common.saving : t.save}
        </button>
      </div>
    </form>
  );
}

/** Предпросмотр строки: адрес подхватывается после паузы во вводе. */
function RowPreview({ url, alt }: { url: string; alt: string }) {
  const debounced = useDebouncedValue(url.trim(), 500);
  return <AdminThumb url={debounced || null} alt={alt} size="lg" />;
}
