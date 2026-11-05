"use client";

// Английская версия товара и раздела (GET/PUT .../translations/en). Основной текст редактируется в обычных формах,
// здесь — только перевод; под каждым полем показан украинский оригинал. Пустое название удаляет перевод:
// тогда английская витрина показывает украинский текст.
// Если на сервере настроен автоперевод, кнопка «Перекласти автоматично» заполняет поля машинным черновиком
// (POST .../draft) — сохраняет его администратор, как и ручной перевод.

import { type FormEvent, useRef, useState } from "react";
import { buttonClass, Field, FormAlert, type FormProblem } from "@/components/admin/ui";
import { describeFailure } from "@/lib/admin/forms";
import { type FieldErrors, focusFirstInvalid } from "@/lib/admin/api";
import { useAdminQuery, useAdminRequest } from "@/lib/admin/session";
import { useAfterCommit } from "@/lib/admin/use-after-commit";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/util";

/** Язык перевода контента: API хранит основной язык (uk) в самих записях, остальные — в таблицах переводов. */
const TRANSLATION_LOCALE = "en";

interface ProductTranslation {
  baseName: string;
  baseShortDescription: string | null;
  baseDescription: string;
  name: string | null;
  shortDescription: string | null;
  description: string | null;
  specs: { key: string; specName: string; baseValue: string; value: string | null }[];
  machineTranslation: boolean;
}

interface ProductTranslationDraft {
  name: string;
  shortDescription: string | null;
  description: string | null;
  specs: Record<string, string>;
}

interface CategoryTranslation {
  baseName: string;
  baseDescription: string | null;
  name: string | null;
  description: string | null;
  specs: { id: string; key: string; baseName: string; baseUnit: string | null; name: string | null; unit: string | null }[];
  machineTranslation: boolean;
}

interface CategoryTranslationDraft {
  name: string;
  description: string | null;
  specs: Record<string, { name: string | null; unit: string | null }>;
}

/** Оригинал для подсказки под полем: длинный текст обрезаем. */
function original(text: string | null | undefined, empty: string): string {
  const value = text?.trim();
  if (!value) return empty;
  return value.length > 140 ? `${value.slice(0, 140)}…` : value;
}

function useTranslationForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoPending, setAutoPending] = useState(false);
  const [autoDone, setAutoDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const afterCommit = useAfterCommit();
  return {
    errors, setErrors, problem, setProblem, pending, setPending, saved, setSaved,
    autoPending, setAutoPending, autoDone, setAutoDone, formRef, alertRef, afterCommit,
  };
}

export function ProductTranslationEditor({ productId, version }: { productId: string; version: string }) {
  const query = useAdminQuery<ProductTranslation>(`/api/admin/products/${productId}/translations/${TRANSLATION_LOCALE}?v=${encodeURIComponent(version)}`);
  if (!query.data) {
    return <TranslationLoading error={query.error?.status} onRetry={query.reload} />;
  }
  // Форма пересоздаётся, только когда меняется основной текст (например, сохранили характеристики), а не после
  // сохранения перевода — иначе пропадёт сообщение «Переклад збережено».
  const base = query.data;
  const key = JSON.stringify([base.baseName, base.baseShortDescription, base.baseDescription, base.specs.map((spec) => [spec.key, spec.baseValue])]);
  return <ProductTranslationForm key={key} productId={productId} data={base} onSaved={query.setData} />;
}

function ProductTranslationForm({
  productId,
  data,
  onSaved,
}: {
  productId: string;
  data: ProductTranslation;
  onSaved: (data: ProductTranslation) => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.admin.translations;
  const request = useAdminRequest();
  const {
    errors, setErrors, problem, setProblem, pending, setPending, saved, setSaved,
    autoPending, setAutoPending, autoDone, setAutoDone, formRef, alertRef, afterCommit,
  } = useTranslationForm();
  const [name, setName] = useState(data.name ?? "");
  const [shortDescription, setShortDescription] = useState(data.shortDescription ?? "");
  const [description, setDescription] = useState(data.description ?? "");
  const [specs, setSpecs] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.specs.map((spec) => [spec.key, spec.value ?? ""])),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setErrors({});
    setProblem(null);
    setSaved(false);
    setAutoDone(false);
    const outcome = await request<ProductTranslation>(`/api/admin/products/${productId}/translations/${TRANSLATION_LOCALE}`, {
      method: "PUT",
      body: { name, shortDescription, description, specs },
    });
    setPending(false);
    if (outcome.ok) {
      setSaved(true);
      onSaved(outcome.data);
      return;
    }
    if (outcome.status === 401 || outcome.status === 403) return;
    const view = describeFailure(outcome, locale, dict, (key) =>
      key === "name" || key === "shortDescription" || key === "description" || key.startsWith("specs.") ? key : null,
    );
    setErrors(view.fields);
    setProblem(view.problem);
    afterCommit(() => focusFirstInvalid(formRef.current, alertRef.current));
  }

  async function autoTranslate() {
    if (pending || autoPending) return;
    const filled = [name, shortDescription, description, ...Object.values(specs)].some((value) => value.trim() !== "");
    if (filled && !window.confirm(t.autoReplace)) return;
    setAutoPending(true);
    setErrors({});
    setProblem(null);
    setSaved(false);
    setAutoDone(false);
    const outcome = await request<ProductTranslationDraft>(
      `/api/admin/products/${productId}/translations/${TRANSLATION_LOCALE}/draft`,
      { method: "POST" },
    );
    setAutoPending(false);
    if (outcome.ok) {
      setName(outcome.data.name);
      setShortDescription(outcome.data.shortDescription ?? "");
      setDescription(outcome.data.description ?? "");
      setSpecs((current) => ({ ...current, ...outcome.data.specs }));
      setAutoDone(true);
      return;
    }
    if (outcome.status === 401 || outcome.status === 403) return;
    setProblem({ ...describeFailure(outcome, locale, dict, () => null).problem, title: t.autoFailed });
    afterCommit(() => alertRef.current?.focus());
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormAlert ref={alertRef} problem={problem} />
      {data.machineTranslation ? <AutoTranslateButton pending={autoPending} disabled={pending} onClick={autoTranslate} /> : null}
      <Field label={t.name} hint={tpl(t.original, { text: original(data.baseName, t.empty) })} error={errors.name}>
        {(control) => <input {...control} lang="en" maxLength={300} value={name} onChange={(event) => setName(event.target.value)} />}
      </Field>
      <Field
        label={t.shortDescription}
        hint={tpl(t.original, { text: original(data.baseShortDescription, t.empty) })}
        error={errors.shortDescription}
      >
        {(control) => (
          <textarea {...control} lang="en" rows={2} maxLength={500} value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} />
        )}
      </Field>
      <Field
        label={t.description}
        hint={tpl(t.original, { text: original(data.baseDescription, t.empty) })}
        error={errors.description}
      >
        {(control) => (
          <textarea {...control} lang="en" rows={6} value={description} onChange={(event) => setDescription(event.target.value)} />
        )}
      </Field>
      {data.specs.length > 0 ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">{t.specValues}</legend>
          {data.specs.map((spec) => (
            <Field
              key={spec.key}
              label={`${spec.specName}: ${spec.baseValue}`}
              error={errors[`specs.${spec.key}`]}
            >
              {(control) => (
                <input
                  {...control}
                  lang="en"
                  maxLength={500}
                  value={specs[spec.key] ?? ""}
                  onChange={(event) => setSpecs((current) => ({ ...current, [spec.key]: event.target.value }))}
                />
              )}
            </Field>
          ))}
        </fieldset>
      ) : null}
      <TranslationActions pending={pending || autoPending} saved={saved} autoDone={autoDone} />
    </form>
  );
}

export function CategoryTranslationEditor({ categoryId, version }: { categoryId: string; version: string }) {
  const query = useAdminQuery<CategoryTranslation>(`/api/admin/categories/${categoryId}/translations/${TRANSLATION_LOCALE}?v=${encodeURIComponent(version)}`);
  if (!query.data) {
    return <TranslationLoading error={query.error?.status} onRetry={query.reload} />;
  }
  const base = query.data;
  const key = JSON.stringify([base.baseName, base.baseDescription, base.specs.map((spec) => [spec.key, spec.baseName, spec.baseUnit])]);
  return <CategoryTranslationForm key={key} categoryId={categoryId} data={base} onSaved={query.setData} />;
}

function CategoryTranslationForm({
  categoryId,
  data,
  onSaved,
}: {
  categoryId: string;
  data: CategoryTranslation;
  onSaved: (data: CategoryTranslation) => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.admin.translations;
  const request = useAdminRequest();
  const {
    errors, setErrors, problem, setProblem, pending, setPending, saved, setSaved,
    autoPending, setAutoPending, autoDone, setAutoDone, formRef, alertRef, afterCommit,
  } = useTranslationForm();
  const [name, setName] = useState(data.name ?? "");
  const [description, setDescription] = useState(data.description ?? "");
  const [specs, setSpecs] = useState<Record<string, { name: string; unit: string }>>(() =>
    Object.fromEntries(data.specs.map((spec) => [spec.key, { name: spec.name ?? "", unit: spec.unit ?? "" }])),
  );

  function updateSpec(key: string, field: "name" | "unit", value: string) {
    setSpecs((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setErrors({});
    setProblem(null);
    setSaved(false);
    setAutoDone(false);
    const outcome = await request<CategoryTranslation>(`/api/admin/categories/${categoryId}/translations/${TRANSLATION_LOCALE}`, {
      method: "PUT",
      body: { name, description, specs },
    });
    setPending(false);
    if (outcome.ok) {
      setSaved(true);
      onSaved(outcome.data);
      return;
    }
    if (outcome.status === 401 || outcome.status === 403) return;
    const view = describeFailure(outcome, locale, dict, (key) =>
      key === "name" || key === "description" || key.startsWith("specs.") ? key : null,
    );
    setErrors(view.fields);
    setProblem(view.problem);
    afterCommit(() => focusFirstInvalid(formRef.current, alertRef.current));
  }

  async function autoTranslate() {
    if (pending || autoPending) return;
    const filled = [name, description, ...Object.values(specs).flatMap((spec) => [spec.name, spec.unit])].some(
      (value) => value.trim() !== "",
    );
    if (filled && !window.confirm(t.autoReplace)) return;
    setAutoPending(true);
    setErrors({});
    setProblem(null);
    setSaved(false);
    setAutoDone(false);
    const outcome = await request<CategoryTranslationDraft>(
      `/api/admin/categories/${categoryId}/translations/${TRANSLATION_LOCALE}/draft`,
      { method: "POST" },
    );
    setAutoPending(false);
    if (outcome.ok) {
      setName(outcome.data.name);
      setDescription(outcome.data.description ?? "");
      setSpecs((current) => {
        const next = { ...current };
        for (const [key, spec] of Object.entries(outcome.data.specs)) {
          next[key] = { name: spec.name ?? "", unit: spec.unit ?? "" };
        }
        return next;
      });
      setAutoDone(true);
      return;
    }
    if (outcome.status === 401 || outcome.status === 403) return;
    setProblem({ ...describeFailure(outcome, locale, dict, () => null).problem, title: t.autoFailed });
    afterCommit(() => alertRef.current?.focus());
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormAlert ref={alertRef} problem={problem} />
      {data.machineTranslation ? <AutoTranslateButton pending={autoPending} disabled={pending} onClick={autoTranslate} /> : null}
      <Field label={t.name} hint={tpl(t.original, { text: original(data.baseName, t.empty) })} error={errors.name}>
        {(control) => <input {...control} lang="en" maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />}
      </Field>
      <Field
        label={t.description}
        hint={tpl(t.original, { text: original(data.baseDescription, t.empty) })}
        error={errors.description}
      >
        {(control) => <textarea {...control} lang="en" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />}
      </Field>
      {data.specs.length > 0 ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">{t.specNames}</legend>
          {data.specs.map((spec) => (
            <div key={spec.key} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <Field
                label={tpl(t.specName, { name: spec.baseName })}
                error={errors[`specs.${spec.key}.name`]}
              >
                {(control) => (
                  <input {...control} lang="en" maxLength={200} value={specs[spec.key]?.name ?? ""} onChange={(event) => updateSpec(spec.key, "name", event.target.value)} />
                )}
              </Field>
              <Field
                label={spec.baseUnit ? tpl(t.unitWithOriginal, { unit: spec.baseUnit }) : t.unit}
                error={errors[`specs.${spec.key}.unit`]}
              >
                {(control) => (
                  <input {...control} lang="en" maxLength={32} value={specs[spec.key]?.unit ?? ""} onChange={(event) => updateSpec(spec.key, "unit", event.target.value)} />
                )}
              </Field>
            </div>
          ))}
        </fieldset>
      ) : null}
      <TranslationActions pending={pending || autoPending} saved={saved} autoDone={autoDone} />
    </form>
  );
}

function AutoTranslateButton({ pending, disabled, onClick }: { pending: boolean; disabled: boolean; onClick: () => void }) {
  const { dict } = useI18n();
  const t = dict.admin.translations;
  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={onClick} disabled={pending || disabled} aria-describedby="auto-translate-hint" className={buttonClass.secondary}>
        {pending ? t.autoPending : t.auto}
      </button>
      <p id="auto-translate-hint" className="text-xs text-zinc-500 dark:text-zinc-400">
        {t.autoHint}
      </p>
    </div>
  );
}

function TranslationActions({ pending, saved, autoDone }: { pending: boolean; saved: boolean; autoDone: boolean }) {
  const { dict } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className={buttonClass.primary}>
        {pending ? dict.admin.common.saving : dict.admin.translations.save}
      </button>
      <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
        {saved ? dict.admin.translations.saved : autoDone ? dict.admin.translations.autoDone : ""}
      </p>
    </div>
  );
}

function TranslationLoading({ error, onRetry }: { error?: number; onRetry: () => void }) {
  const { dict } = useI18n();
  if (error) {
    return (
      <p className="text-sm text-red-700 dark:text-red-400">
        {tpl(dict.admin.common.loadError, { status: error })}{" "}
        <button type="button" onClick={onRetry} className="underline">
          {dict.common.retry}
        </button>
      </p>
    );
  }
  return <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.admin.common.loading}</p>;
}
