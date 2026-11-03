"use client";

// Поля раздела: создание (POST) и изменение/перенос (PUT /api/admin/categories/{id}).

import { type FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { buttonClass, Field, FormAlert, type FormProblem } from "@/components/admin/ui";
import { type FieldErrors, focusFirstInvalid, numberToInput, parseDecimal } from "@/lib/admin/api";
import { indentedLabel, selfAndDescendants, withDepth } from "@/lib/admin/categories";
import { describeFailure, directKeys } from "@/lib/admin/forms";
import type { AdminCategory, AdminCategoryDetails } from "@/lib/admin/types";
import { useAdminRequest } from "@/lib/admin/session";
import { useUnsavedChanges } from "@/lib/admin/unsaved-changes";
import { useAfterCommit } from "@/lib/admin/use-after-commit";
import { useI18n } from "@/lib/i18n/client";
import { workshopCopy } from "@/lib/i18n/workshop";
import { localeHref } from "@/lib/i18n/routing";
import { categoryPath } from "@/lib/categories";
import styles from "./category-pilot.module.css";

export interface CategoryValues {
  name: string;
  slug: string;
  description: string;
  parentId: string;
  sortOrder: string;
}

const FIELDS = ["name", "slug", "parentId", "sortOrder", "description"] as const;

export function categoryValues(category: AdminCategory | null, parentId = ""): CategoryValues {
  return category
    ? {
        name: category.name,
        slug: category.slug,
        description: category.description ?? "",
        parentId: category.parentId ?? "",
        sortOrder: numberToInput(category.sortOrder),
      }
    : { name: "", slug: "", description: "", parentId, sortOrder: "0" };
}

interface Props {
  categoryId: string | null;
  initial: CategoryValues;
  categories: AdminCategory[];
  onSaved: (category: AdminCategoryDetails) => void;
}

export function CategoryForm({ categoryId, initial, categories, onSaved }: Props) {
  const { locale, dict } = useI18n();
  const t = dict.admin.categories;
  const copy = workshopCopy[locale].category;
  const request = useAdminRequest();
  const [values, setValues] = useState<CategoryValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const afterCommit = useAfterCommit();
  const isNew = categoryId === null;
  const dirty = FIELDS.some((field) => values[field] !== initial[field]);
  useUnsavedChanges(dirty);

  // Нельзя перенести раздел в самого себя или в свой подраздел — такие варианты не предлагаем.
  const excluded = categoryId ? selfAndDescendants(categories, categoryId) : new Set<string>();
  const parentOptions = withDepth(categories).filter((category) => !excluded.has(category.id));

  function update<K extends keyof CategoryValues>(field: K, value: CategoryValues[K]) {
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
    const outcome = await request<AdminCategoryDetails>(isNew ? "/api/admin/categories" : `/api/admin/categories/${categoryId}`, {
      method: isNew ? "POST" : "PUT",
      body: {
        name: values.name,
        slug: values.slug.trim() || null,
        description: values.description,
        parentId: values.parentId || null,
        sortOrder: sortOrder ?? 0,
      },
    });
    setPending(false);
    if (outcome.ok) {
      if (isNew) {
        setValues(initial);
      }
      onSaved(outcome.data);
      return;
    }
    if (outcome.status === 401 || outcome.status === 403) {
      return;
    }
    const view = describeFailure(outcome, locale, dict, directKeys(FIELDS), ["slug"]);
    setErrors(view.fields);
    setProblem(view.problem);
    afterCommit(() => focusFirstInvalid(formRef.current, alertRef.current));
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className={styles.categoryForm}>
      <FormAlert ref={alertRef} problem={problem} />
      <div className={styles.formColumns}>
        <section className={`${styles.panel} ${styles.basic}`}>
          <div className={styles.panelHeading}><h2>{copy.main}</h2><p>{copy.mainHint}</p></div>
          <p className={styles.required}>{dict.admin.common.requiredNote}</p>
        <Field label={dict.admin.common.name} required error={errors.name}>
          {(control) => <input {...control} name="name" maxLength={200} value={values.name} onChange={(event) => update("name", event.target.value)} />}
        </Field>
        <Field label={dict.admin.common.slug} hint={isNew ? dict.admin.common.slugHint : dict.admin.common.slugEditHint} error={errors.slug}>
          {(control) => (
            <input {...control} name="slug" maxLength={200} spellCheck={false} autoComplete="off" value={values.slug} onChange={(event) => update("slug", event.target.value)} />
          )}
        </Field>
          <Field label={dict.admin.common.description} error={errors.description} className={styles.description}>
            {(control) => <textarea {...control} name="description" rows={3} value={values.description} onChange={(event) => update("description", event.target.value)} />}
          </Field>
        </section>
        <section className={`${styles.panel} ${styles.structure}`}>
          <div className={styles.panelHeading}><h2>{copy.structure}</h2><p>{copy.structureHint}</p></div>
        <Field label={t.parent} error={errors.parentId}>
          {(control) => (
            <select {...control} name="parentId" value={values.parentId} onChange={(event) => update("parentId", event.target.value)}>
              <option value="">{t.noParent}</option>
              {parentOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {indentedLabel(category.name, category.depth)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={dict.admin.common.sortOrder} hint={dict.admin.common.sortOrderHint} error={errors.sortOrder}>
          {(control) => (
            <input {...control} name="sortOrder" type="number" step={1} inputMode="numeric" value={values.sortOrder} onChange={(event) => update("sortOrder", event.target.value)} />
          )}
        </Field>
          {!isNew ? <Link href={localeHref(locale, categoryPath(initial.slug))} className={styles.previewLink}>{copy.preview}<span aria-hidden="true">↗</span></Link> : null}
        </section>
      </div>
      <div className={styles.saveBar}>
        <p role="status"><span className={dirty ? styles.dirtyDot : styles.savedDot} />{dirty ? copy.unsaved : isNew ? t.newTitle : copy.saved}</p>
        <div>
          <button type="button" disabled={!dirty || pending} onClick={() => { setValues(initial); setErrors({}); setProblem(null); }} className={buttonClass.secondary}>{dict.admin.common.cancel}</button>
        <button type="submit" disabled={pending || (!dirty && !isNew)} className={buttonClass.primary}>
          {pending ? (isNew ? dict.admin.common.creating : dict.admin.common.saving) : isNew ? t.createSubmit : dict.admin.common.save}
        </button>
        </div>
      </div>
    </form>
  );
}
