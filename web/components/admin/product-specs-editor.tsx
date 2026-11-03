"use client";

// Значения характеристик товара (PUT /api/admin/products/{id}/specs). Набор полей — availableSpecs
// из карточки товара: характеристики его раздела и родительских разделов, с типом и единицей.

import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { buttonClass, Field, FormAlert, type FormProblem } from "@/components/admin/ui";
import { type FieldErrors, focusFirstInvalid, parseDecimal } from "@/lib/admin/api";
import { describeFailure } from "@/lib/admin/forms";
import type { AdminProductDetails, AdminSpecDefinition } from "@/lib/admin/types";
import { useAdminRequest } from "@/lib/admin/session";
import { useUnsavedChanges } from "@/lib/admin/unsaved-changes";
import { useAfterCommit } from "@/lib/admin/use-after-commit";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";

type SpecValues = Record<string, string>;

function initialValues(product: AdminProductDetails): SpecValues {
  const values: SpecValues = {};
  for (const spec of product.specs) {
    values[spec.key] = spec.value === null ? "" : String(spec.value);
  }
  return values;
}

/** Значение для API по типу характеристики; пустое поле — характеристика не задана (не отправляется). */
function toApiValue(definition: AdminSpecDefinition, raw: string): string | number | boolean | null {
  const value = raw.trim();
  if (value === "") {
    return null;
  }
  switch (definition.valueType) {
    case "Number":
      return parseDecimal(value);
    case "Boolean":
      return value === "true";
    default:
      return value;
  }
}

interface Props {
  product: AdminProductDetails;
  /** Раздел в основной форме изменён, но не сохранён — список характеристик ещё старый. */
  categoryChanged: boolean;
  onSaved: (product: AdminProductDetails, message: string) => void;
}

export function ProductSpecsEditor({ product, categoryChanged, onSaved }: Props) {
  const { locale, dict } = useI18n();
  const t = dict.admin.specs;
  const request = useAdminRequest();
  const [values, setValues] = useState<SpecValues>(() => initialValues(product));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const afterCommit = useAfterCommit();
  const definitions = product.availableSpecs;
  const savedValues = initialValues(product);
  useUnsavedChanges(definitions.some((definition) => (values[definition.key] ?? "") !== (savedValues[definition.key] ?? "")));

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: [] } : current));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setErrors({});
    setProblem(null);

    const specs: Record<string, string | number | boolean> = {};
    for (const definition of definitions) {
      const value = toApiValue(definition, values[definition.key] ?? "");
      if (value !== null) {
        specs[definition.key] = value;
      }
    }

    const outcome = await request<AdminProductDetails>(`/api/admin/products/${product.id}/specs`, { method: "PUT", body: { specs } });
    setPending(false);
    if (outcome.ok) {
      onSaved(outcome.data, t.saved);
      return;
    }
    if (outcome.status === 401 || outcome.status === 403) {
      return;
    }
    const keys = new Set(definitions.map((definition) => definition.key));
    const view = describeFailure(outcome, locale, dict, (key) => {
      const specKey = key.startsWith("specs.") ? key.slice("specs.".length) : null;
      return specKey && keys.has(specKey) ? specKey : null;
    });
    setErrors(view.fields);
    setProblem(view.problem);
    afterCommit(() => focusFirstInvalid(formRef.current, alertRef.current));
  }

  return (
    <div className="flex flex-col gap-4">
      {categoryChanged ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
          {t.categoryChanged}
        </p>
      ) : null}

      {definitions.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {tpl(t.none, { category: product.category.name })}{" "}
          <Link href={localeHref(locale, `/admin/category/${product.category.id}`)} className="underline underline-offset-2">
            {t.manage}
          </Link>
        </p>
      ) : (
        <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FormAlert ref={alertRef} problem={problem} />
          <div className="grid gap-4 sm:grid-cols-2">
            {definitions.map((definition) => (
              <SpecField
                key={definition.id}
                definition={definition}
                value={values[definition.key] ?? ""}
                error={errors[definition.key]}
                onChange={(value) => update(definition.key, value)}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className={buttonClass.primary}>
              {pending ? dict.admin.common.saving : t.save}
            </button>
            <Link href={localeHref(locale, `/admin/category/${product.category.id}`)} className="text-sm underline underline-offset-2">
              {t.manage}
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

function SpecField({
  definition,
  value,
  error,
  onChange,
}: {
  definition: AdminSpecDefinition;
  value: string;
  error?: string[];
  onChange: (value: string) => void;
}) {
  const { dict } = useI18n();
  const label = (
    <>
      {definition.name}
      {definition.unit ? <span className="font-normal text-zinc-500 dark:text-zinc-400">, {definition.unit}</span> : null}
      <span className="ml-2 font-mono text-xs font-normal text-zinc-500 dark:text-zinc-400">{tpl(dict.admin.specs.key, { key: definition.key })}</span>
    </>
  );

  return (
    <Field label={label} hint={dict.admin.valueTypes[definition.valueType]} error={error}>
      {(control) =>
        definition.valueType === "Boolean" ? (
          <select {...control} name={`spec-${definition.key}`} value={value} onChange={(event) => onChange(event.target.value)}>
            <option value="">{dict.admin.common.notSet}</option>
            <option value="true">{dict.admin.common.yes}</option>
            <option value="false">{dict.admin.common.no}</option>
          </select>
        ) : definition.valueType === "Number" ? (
          <div className="flex items-stretch gap-2">
            <input
              {...control}
              name={`spec-${definition.key}`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={dict.admin.specs.numberPlaceholder}
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
            {definition.unit ? (
              <span aria-hidden="true" className="flex min-w-11 items-center justify-center rounded-lg bg-zinc-100 px-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {definition.unit}
              </span>
            ) : null}
          </div>
        ) : (
          <input {...control} name={`spec-${definition.key}`} type="text" maxLength={500} value={value} onChange={(event) => onChange(event.target.value)} />
        )
      }
    </Field>
  );
}
