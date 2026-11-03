"use client";

// Характеристики раздела: список с правкой на месте, удаление с подтверждением и форма добавления.
// POST/PUT/DELETE /api/admin/categories/{id}/specs[/{specId}]. Конфликты 409 (занятый ключ в ветке,
// смена типа при заданных значениях) показываются у поля и в сводке.

import { type FormEvent, useId, useRef, useState } from "react";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { buttonClass, Field, FormAlert, type FormProblem } from "@/components/admin/ui";
import { type FieldErrors, focusFirstInvalid, numberToInput, parseDecimal } from "@/lib/admin/api";
import { describeFailure, directKeys } from "@/lib/admin/forms";
import { type AdminSpecDefinition, specValueTypes } from "@/lib/admin/types";
import { useAdminRequest } from "@/lib/admin/session";
import { useAfterCommit } from "@/lib/admin/use-after-commit";
import type { SpecValueType } from "@/lib/api";
import { useI18n } from "@/lib/i18n/client";
import { tpl } from "@/lib/i18n/util";

interface SpecValues {
  key: string;
  name: string;
  unit: string;
  valueType: SpecValueType | "";
  isFilterable: boolean;
  sortOrder: string;
}

const FIELDS = ["key", "name", "unit", "valueType", "isFilterable", "sortOrder"] as const;

function specValues(spec: AdminSpecDefinition | null, nextSortOrder: number): SpecValues {
  return spec
    ? {
        key: spec.key,
        name: spec.name,
        unit: spec.unit ?? "",
        valueType: spec.valueType,
        isFilterable: spec.isFilterable,
        sortOrder: numberToInput(spec.sortOrder),
      }
    : { key: "", name: "", unit: "", valueType: "Number", isFilterable: true, sortOrder: String(nextSortOrder) };
}

interface Props {
  categoryId: string;
  specs: AdminSpecDefinition[];
  /** Сообщение об успехе; родитель перезагружает раздел. */
  onChanged: (message: string) => void;
  onProblem: (problem: FormProblem) => void;
}

export function SpecDefinitions({ categoryId, specs, onChanged, onProblem }: Props) {
  const { locale, dict } = useI18n();
  const t = dict.admin.specDefs;
  const request = useAdminRequest();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmElement, confirm] = useConfirm();
  const nextSortOrder = specs.reduce((max, spec) => Math.max(max, spec.sortOrder), 0) + 1;

  async function remove(spec: AdminSpecDefinition) {
    const confirmed = await confirm({
      title: t.deleteTitle,
      message: tpl(t.deleteText, { name: spec.name }),
      confirmLabel: dict.admin.common.delete,
    });
    if (!confirmed) {
      return;
    }
    const outcome = await request<void>(`/api/admin/categories/${categoryId}/specs/${spec.id}`, { method: "DELETE" });
    if (outcome.ok) {
      onChanged(tpl(t.deleted, { name: spec.name }));
    } else if (outcome.status !== 401 && outcome.status !== 403) {
      onProblem({ ...describeFailure(outcome, locale, dict, () => null).problem, title: dict.admin.common.deleteFailed });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {specs.length === 0 ? <p className="text-sm text-zinc-500">{t.empty}</p> : null}
      {specs.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {specs.map((spec) => (
            <li key={spec.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              {editingId === spec.id ? (
                <SpecDefinitionForm
                  title={tpl(t.editTitle, { name: spec.name })}
                  categoryId={categoryId}
                  spec={spec}
                  initial={specValues(spec, nextSortOrder)}
                  onCancel={() => setEditingId(null)}
                  onSaved={(saved) => {
                    setEditingId(null);
                    onChanged(tpl(t.saved, { name: saved.name }));
                  }}
                />
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">
                      {spec.name}
                      {spec.unit ? <span className="font-normal text-zinc-500">, {spec.unit}</span> : null}
                    </span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                      <span className="font-mono">{spec.key}</span>
                      <span>{dict.admin.valueTypes[spec.valueType]}</span>
                      {spec.isFilterable ? <span>{t.filterableShort}</span> : null}
                      <span>
                        {t.sortOrder}: {spec.sortOrder}
                      </span>
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => setEditingId(spec.id)} aria-label={tpl(t.editAria, { name: spec.name })} className={buttonClass.secondary}>
                      {dict.admin.common.edit}
                    </button>
                    <button type="button" onClick={() => remove(spec)} aria-label={tpl(t.deleteAria, { name: spec.name })} className={buttonClass.danger}>
                      {dict.admin.common.delete}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
        <SpecDefinitionForm
          key={`new-${specs.length}`}
          title={t.addTitle}
          categoryId={categoryId}
          spec={null}
          initial={specValues(null, nextSortOrder)}
          onSaved={(saved) => onChanged(tpl(t.added, { name: saved.name }))}
        />
      </div>
      {confirmElement}
    </div>
  );
}

function SpecDefinitionForm({
  title,
  categoryId,
  spec,
  initial,
  onSaved,
  onCancel,
}: {
  title: string;
  categoryId: string;
  spec: AdminSpecDefinition | null;
  initial: SpecValues;
  onSaved: (spec: AdminSpecDefinition) => void;
  onCancel?: () => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.admin.specDefs;
  const request = useAdminRequest();
  const [values, setValues] = useState<SpecValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const afterCommit = useAfterCommit();
  const titleId = useId();
  const checkboxId = useId();

  function update<K extends keyof SpecValues>(field: K, value: SpecValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: [] } : current));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setErrors({});
    setProblem(null);
    const sortOrder = parseDecimal(values.sortOrder);
    const outcome = await request<AdminSpecDefinition>(
      spec ? `/api/admin/categories/${categoryId}/specs/${spec.id}` : `/api/admin/categories/${categoryId}/specs`,
      {
        method: spec ? "PUT" : "POST",
        body: {
          key: values.key.trim(),
          name: values.name,
          unit: values.unit,
          valueType: values.valueType || null,
          isFilterable: values.isFilterable,
          sortOrder: sortOrder ?? 0,
        },
      },
    );
    setPending(false);
    if (outcome.ok) {
      onSaved(outcome.data);
      return;
    }
    if (outcome.status === 401 || outcome.status === 403) {
      return;
    }
    const view = describeFailure(outcome, locale, dict, directKeys(FIELDS), ["key", "valueType"]);
    setErrors(view.fields);
    setProblem(view.problem);
    afterCommit(() => focusFirstInvalid(formRef.current, alertRef.current));
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-labelledby={titleId} className="flex flex-col gap-3">
      <h3 id={titleId} className="font-medium">
        {title}
      </h3>
      <FormAlert ref={alertRef} problem={problem} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field label={t.key} required hint={t.keyHint} error={errors.key}>
          {(control) => (
            <input
              {...control}
              name="key"
              maxLength={64}
              spellCheck={false}
              autoComplete="off"
              className={`${control.className} font-mono`}
              value={values.key}
              onChange={(event) => update("key", event.target.value)}
            />
          )}
        </Field>
        <Field label={t.name} required error={errors.name}>
          {(control) => <input {...control} name="name" maxLength={200} value={values.name} onChange={(event) => update("name", event.target.value)} />}
        </Field>
        <Field label={t.unit} hint={t.unitHint} error={errors.unit}>
          {(control) => <input {...control} name="unit" maxLength={32} value={values.unit} onChange={(event) => update("unit", event.target.value)} />}
        </Field>
        <Field label={t.valueType} required error={errors.valueType}>
          {(control) => (
            <select {...control} name="valueType" value={values.valueType} onChange={(event) => update("valueType", event.target.value as SpecValueType)}>
              {specValueTypes.map((type) => (
                <option key={type} value={type}>
                  {dict.admin.valueTypes[type]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t.sortOrder} error={errors.sortOrder}>
          {(control) => (
            <input {...control} name="sortOrder" type="number" step={1} inputMode="numeric" value={values.sortOrder} onChange={(event) => update("sortOrder", event.target.value)} />
          )}
        </Field>
        <div className="flex items-end">
          <label htmlFor={checkboxId} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input
              id={checkboxId}
              type="checkbox"
              name="isFilterable"
              checked={values.isFilterable}
              onChange={(event) => update("isFilterable", event.target.checked)}
              className="h-4 w-4"
            />
            {t.filterable}
          </label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? dict.admin.common.saving : spec ? dict.admin.common.save : t.add}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonClass.secondary}>
            {dict.admin.common.cancel}
          </button>
        ) : null}
      </div>
    </form>
  );
}
