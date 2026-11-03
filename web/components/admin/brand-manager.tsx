"use client";

// Бренды: форма добавления, список с правкой на месте и удалением (409, если у бренда есть товары).

import Link from "next/link";
import { type FormEvent, useId, useRef, useState } from "react";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { buttonClass, Field, FormAlert, type FormProblem, LoadError, Notice, PageHeader, Section } from "@/components/admin/ui";
import { type FieldErrors, focusFirstInvalid } from "@/lib/admin/api";
import { describeFailure, directKeys } from "@/lib/admin/forms";
import type { AdminBrand } from "@/lib/admin/types";
import { useAdminQuery, useAdminRequest } from "@/lib/admin/session";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";

interface BrandValues {
  name: string;
  slug: string;
  country: string;
}

const FIELDS = ["name", "slug", "country"] as const;
const EMPTY: BrandValues = { name: "", slug: "", country: "" };

export function BrandManager() {
  const { locale, dict } = useI18n();
  const t = dict.admin.brands;
  const request = useAdminRequest();
  const brands = useAdminQuery<AdminBrand[]>("/api/admin/brands");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [createKey, setCreateKey] = useState(0);
  const [confirmElement, confirm] = useConfirm();
  const alertRef = useRef<HTMLDivElement>(null);

  function changed(message: string) {
    setProblem(null);
    setNotice(message);
    brands.reload();
  }

  async function remove(brand: AdminBrand) {
    const confirmed = await confirm({
      title: t.deleteTitle,
      message: tpl(t.deleteText, { name: brand.name }),
      confirmLabel: dict.admin.common.delete,
    });
    if (!confirmed) {
      return;
    }
    setNotice(null);
    setProblem(null);
    const outcome = await request<void>(`/api/admin/brands/${brand.id}`, { method: "DELETE" });
    if (outcome.ok) {
      changed(tpl(t.deleted, { name: brand.name }));
      return;
    }
    if (outcome.status !== 401 && outcome.status !== 403) {
      setProblem({ ...describeFailure(outcome, locale, dict, () => null).problem, title: dict.admin.common.deleteFailed });
      requestAnimationFrame(() => alertRef.current?.focus());
    }
  }

  return (
    <>
      <PageHeader title={t.title} />
      <Notice message={notice} onDismiss={() => setNotice(null)} />
      <FormAlert ref={alertRef} problem={problem} />

      <Section title={t.addTitle}>
        <BrandForm
          key={createKey}
          brand={null}
          onSaved={(saved) => {
            setCreateKey((value) => value + 1);
            changed(tpl(t.created, { name: saved.name }));
          }}
        />
      </Section>

      <Section title={t.title}>
        {brands.error ? <LoadError message={tpl(dict.admin.common.loadError, { status: brands.error.status })} onRetry={brands.reload} /> : null}
        {brands.data === null && !brands.error ? <p className="text-sm text-zinc-500">{dict.admin.common.loading}</p> : null}
        {brands.data && brands.data.length === 0 ? <p className="text-sm text-zinc-500">{t.empty}</p> : null}
        {brands.data && brands.data.length > 0 ? (
          <ul aria-busy={brands.loading} className="flex flex-col gap-2">
            {brands.data.map((brand) => (
              <li key={brand.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                {editingId === brand.id ? (
                  <BrandForm
                    brand={brand}
                    onCancel={() => setEditingId(null)}
                    onSaved={(saved) => {
                      setEditingId(null);
                      changed(tpl(t.saved, { name: saved.name }));
                    }}
                  />
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium">{brand.name}</span>
                      <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                        <span className="font-mono">{brand.slug}</span>
                        {brand.country ? <span>{brand.country}</span> : null}
                        <Link
                          href={localeHref(locale, `/admin/products?brandId=${brand.id}`)}
                          aria-label={tpl(t.viewProducts, { name: brand.name })}
                          className="underline underline-offset-2"
                        >
                          {t.productCount}: {formatNumber(brand.productCount, locale)}
                        </Link>
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => setEditingId(brand.id)} aria-label={tpl(t.editAria, { name: brand.name })} className={buttonClass.secondary}>
                        {dict.admin.common.edit}
                      </button>
                      <button type="button" onClick={() => remove(brand)} aria-label={tpl(t.deleteAria, { name: brand.name })} className={buttonClass.danger}>
                        {dict.admin.common.delete}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
      {confirmElement}
    </>
  );
}

function BrandForm({ brand, onSaved, onCancel }: { brand: AdminBrand | null; onSaved: (brand: AdminBrand) => void; onCancel?: () => void }) {
  const { locale, dict } = useI18n();
  const t = dict.admin.brands;
  const request = useAdminRequest();
  const [values, setValues] = useState<BrandValues>(brand ? { name: brand.name, slug: brand.slug, country: brand.country ?? "" } : EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  function update(field: keyof BrandValues, value: string) {
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
    const outcome = await request<AdminBrand>(brand ? `/api/admin/brands/${brand.id}` : "/api/admin/brands", {
      method: brand ? "PUT" : "POST",
      body: { name: values.name, slug: values.slug.trim() || null, country: values.country },
    });
    setPending(false);
    if (outcome.ok) {
      onSaved(outcome.data);
      return;
    }
    if (outcome.status === 401 || outcome.status === 403) {
      return;
    }
    const view = describeFailure(outcome, locale, dict, directKeys(FIELDS), ["slug"]);
    setErrors(view.fields);
    setProblem(view.problem);
    focusFirstInvalid(formRef.current, alertRef.current);
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-labelledby={brand ? titleId : undefined} className="flex flex-col gap-3">
      {brand ? (
        <h3 id={titleId} className="font-medium">
          {tpl(t.editTitle, { name: brand.name })}
        </h3>
      ) : null}
      <FormAlert ref={alertRef} problem={problem} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t.name} required error={errors.name}>
          {(control) => <input {...control} name="name" maxLength={200} value={values.name} onChange={(event) => update("name", event.target.value)} />}
        </Field>
        <Field label={dict.admin.common.slug} hint={brand ? dict.admin.common.slugEditHint : dict.admin.common.slugHint} error={errors.slug}>
          {(control) => (
            <input {...control} name="slug" maxLength={200} spellCheck={false} autoComplete="off" value={values.slug} onChange={(event) => update("slug", event.target.value)} />
          )}
        </Field>
        <Field label={t.country} error={errors.country}>
          {(control) => <input {...control} name="country" maxLength={100} value={values.country} onChange={(event) => update("country", event.target.value)} />}
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? dict.admin.common.saving : brand ? dict.admin.common.save : t.createSubmit}
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
