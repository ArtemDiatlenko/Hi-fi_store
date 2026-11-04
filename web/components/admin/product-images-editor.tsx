"use client";

// Изображения товара (PUT /api/admin/products/{id}/images): упорядоченный список адресов с alt.
// Порядок меняется кнопками «вгору/вниз» (доступны с клавиатуры), фокус остаётся на перемещённом
// изображении, а живой регион сообщает новую позицию. Первое изображение — главное.

import { type FormEvent, useLayoutEffect, useRef, useState } from "react";
import { AdminThumb, useDebouncedValue } from "@/components/admin/thumb";
import { buttonClass, Field, FormAlert, type FormProblem } from "@/components/admin/ui";
import { type FieldErrors, focusFirstInvalid } from "@/lib/admin/api";
import { describeFailure } from "@/lib/admin/forms";
import type { AdminProductDetails } from "@/lib/admin/types";
import { useAdminRequest } from "@/lib/admin/session";
import { useUnsavedChanges } from "@/lib/admin/unsaved-changes";
import { useAfterCommit } from "@/lib/admin/use-after-commit";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/util";
import { REMOTE_IMAGE_HOSTS } from "@/lib/image-hosts";

interface Row {
  uid: string;
  url: string;
  alt: string;
  /** Файл ещё загружается в хранилище (POST /api/admin/media/images); адрес появится после загрузки. */
  uploading?: boolean;
}

const MAX_IMAGES = 20;

// Те же ограничения, что в API (Media:MaxImageBytes, проверка формата по содержимому). Здесь — чтобы
// не отправлять заведомо неподходящий файл; окончательно решает сервер.
const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
const UPLOAD_MAX_MB = 10;

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const uploading = rows.some((row) => row.uploading);
  // Актуальный список для действий после загрузки (замыкание uploadFiles видит состояние на момент вызова).
  const rowsRef = useRef(rows);
  // useLayoutEffect срабатывает раньше обычных эффектов, в том числе эффекта useAfterCommit.
  useLayoutEffect(() => {
    rowsRef.current = rows;
  });
  useUnsavedChanges(
    rows.length !== product.images.length ||
      rows.some((row, index) => row.url !== product.images[index].url || row.alt !== (product.images[index].alt ?? "")),
  );

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

  /**
   * Загружает файлы в хранилище: каждый файл сразу становится строкой списка, а после загрузки получает адрес.
   * К товару фото привязываются, как и раньше, кнопкой «Зберегти зображення».
   */
  async function uploadFiles(selected: File[]) {
    if (selected.length === 0) {
      return;
    }
    const problems: string[] = [];
    const free = Math.max(MAX_IMAGES - rows.length, 0);
    if (selected.length > free) {
      problems.push(tpl(t.tooMany, { n: MAX_IMAGES }));
    }

    const accepted: { file: File; uid: string }[] = [];
    for (const file of selected.slice(0, free)) {
      // Пустой type бывает у файлов без расширения — их формат проверит сервер.
      if (file.type && !UPLOAD_TYPES.includes(file.type)) {
        problems.push(tpl(t.uploadFailed, { name: file.name, reason: t.unsupported }));
      } else if (file.size > UPLOAD_MAX_MB * 1024 * 1024) {
        problems.push(tpl(t.uploadFailed, { name: file.name, reason: tpl(t.tooLarge, { mb: UPLOAD_MAX_MB }) }));
      } else {
        nextId.current += 1;
        accepted.push({ file, uid: `new-${nextId.current}` });
      }
    }
    setUploadErrors(problems);
    if (accepted.length === 0) {
      return;
    }

    setRows((current) => [...current, ...accepted.map(({ uid }) => ({ uid, url: "", alt: "", uploading: true }))]);
    setAnnouncement(tpl(t.uploadingCount, { n: accepted.length }));

    let done = 0;
    await Promise.all(
      accepted.map(async ({ file, uid }) => {
        const body = new FormData();
        body.append("file", file);
        const outcome = await request<{ url: string }>("/api/admin/media/images", { method: "POST", body });
        if (outcome.ok) {
          done += 1;
          setRows((current) => current.map((row) => (row.uid === uid ? { ...row, url: outcome.data.url, uploading: false } : row)));
          return;
        }
        setRows((current) => current.filter((row) => row.uid !== uid));
        if (outcome.status === 401 || outcome.status === 403) {
          return;
        }
        const view = describeFailure(outcome, locale, dict, (key) => (key === "file" ? "file" : null));
        const reason = view.fields.file?.[0] ?? view.problem?.messages[0] ?? "";
        setUploadErrors((current) => [...current, tpl(t.uploadFailed, { name: file.name, reason })]);
      }),
    );
    setAnnouncement(tpl(t.uploadedCount, { n: done }));

    // Загруженное фото сразу привязываем к товару: иначе легко опубликовать товар, забыв нажать «Зберегти».
    // Если в списке есть незаполненные строки (адрес вводят вручную), сохранение остаётся за администратором.
    if (done > 0) {
      afterCommit(() => {
        const current = rowsRef.current;
        if (current.length > 0 && current.every((row) => !row.uploading && row.url.trim() !== "")) {
          formRef.current?.requestSubmit();
        }
      });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uploading) {
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

      {rows.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.empty}</p> : null}

      <ol className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const host = foreignHost(row.url);
          const n = index + 1;
          return (
            <li key={row.uid} data-uid={row.uid} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 sm:flex-row dark:border-zinc-800">
              <div className="flex shrink-0 flex-row items-start gap-3 sm:flex-col">
                {row.uploading ? (
                  <span className="flex h-24 w-32 shrink-0 flex-col items-center justify-center gap-2 rounded-md bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-amber-500 dark:border-zinc-600" />
                    {t.uploading}
                  </span>
                ) : (
                  <RowPreview url={row.url} alt={row.alt || tpl(t.item, { n })} />
                )}
                <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {tpl(t.item, { n })}
                  {index === 0 ? (
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 font-semibold text-zinc-950">{t.main}</span>
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
                      readOnly={row.uploading}
                      placeholder={row.uploading ? t.uploading : undefined}
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

      <div
        onDragEnter={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            setDragging(true);
          }
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void uploadFiles(Array.from(event.dataTransfer.files));
        }}
        className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
          dragging
            ? "border-amber-500 bg-amber-50 dark:bg-amber-400/10"
            : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
        <p className="text-zinc-700 dark:text-zinc-300">{t.dropTitle}</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={rows.length >= MAX_IMAGES}
          className={buttonClass.secondary}
        >
          {t.choose}
        </button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{tpl(t.dropHint, { mb: UPLOAD_MAX_MB })}</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={UPLOAD_TYPES.join(",")}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // Сбрасываем, чтобы тот же файл можно было выбрать ещё раз.
            event.target.value = "";
            void uploadFiles(files);
          }}
        />
      </div>

      {uploadErrors.length > 0 ? (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-red-700 dark:text-red-400">
          {uploadErrors.map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button ref={addRef} type="button" onClick={add} disabled={rows.length >= MAX_IMAGES} className={buttonClass.secondary}>
          {t.add}
        </button>
        <button type="submit" disabled={pending || uploading} className={buttonClass.primary}>
          {pending ? dict.admin.common.saving : uploading ? t.uploading : t.save}
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
