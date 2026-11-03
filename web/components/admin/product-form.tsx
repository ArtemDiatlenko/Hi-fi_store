"use client";

// Основные поля товара: создание (POST) и изменение (PUT /api/admin/products/{id}).
// Ошибки сервера показываются у полей, фокус переходит на первое поле с ошибкой.

import { type FormEvent, useRef, useState } from "react";
import { buttonClass, Field, FormAlert, type FormProblem } from "@/components/admin/ui";
import { type FieldErrors, focusFirstInvalid, numberToInput, parseDecimal } from "@/lib/admin/api";
import { indentedLabel, withDepth } from "@/lib/admin/categories";
import { describeFailure, directKeys } from "@/lib/admin/forms";
import { type AdminBrand, type AdminCategory, type AdminProductDetails, productConditions } from "@/lib/admin/types";
import { useAdminRequest } from "@/lib/admin/session";
import { useUnsavedChanges } from "@/lib/admin/unsaved-changes";
import { useAfterCommit } from "@/lib/admin/use-after-commit";
import type { ProductCondition } from "@/lib/api";
import { useI18n } from "@/lib/i18n/client";

export interface ProductMainValues {
  name: string;
  sku: string;
  slug: string;
  categoryId: string;
  brandId: string;
  price: string;
  oldPrice: string;
  stock: string;
  condition: ProductCondition;
  shortDescription: string;
  description: string;
}

const FIELDS = ["name", "sku", "slug", "categoryId", "brandId", "price", "oldPrice", "stock", "condition", "shortDescription", "description"] as const;

export const EMPTY_PRODUCT: ProductMainValues = {
  name: "",
  sku: "",
  slug: "",
  categoryId: "",
  brandId: "",
  price: "",
  oldPrice: "",
  stock: "0",
  condition: "New",
  shortDescription: "",
  description: "",
};

export function valuesFromProduct(product: AdminProductDetails): ProductMainValues {
  return {
    name: product.name,
    sku: product.sku,
    slug: product.slug,
    categoryId: product.category.id,
    brandId: product.brand.id,
    price: numberToInput(product.price),
    oldPrice: numberToInput(product.oldPrice),
    stock: numberToInput(product.stock),
    condition: product.condition,
    shortDescription: product.shortDescription ?? "",
    description: product.description,
  };
}

interface Props {
  /** null — создание нового товара. */
  productId: string | null;
  initial: ProductMainValues;
  categories: AdminCategory[];
  brands: AdminBrand[];
  onSaved: (product: AdminProductDetails) => void;
  onCategoryChange?: (categoryId: string) => void;
}

export function ProductMainForm({ productId, initial, categories, brands, onSaved, onCategoryChange }: Props) {
  const { locale, dict } = useI18n();
  const t = dict.admin.productForm;
  const request = useAdminRequest();
  const [values, setValues] = useState<ProductMainValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const afterCommit = useAfterCommit();
  const isNew = productId === null;
  useUnsavedChanges(FIELDS.some((field) => values[field] !== initial[field]));

  function update<K extends keyof ProductMainValues>(field: K, value: ProductMainValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: [] } : current));
    if (field === "categoryId") {
      onCategoryChange?.(value as string);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setErrors({});
    setProblem(null);

    const body = {
      name: values.name,
      sku: values.sku,
      slug: values.slug.trim() || null,
      categoryId: values.categoryId || null,
      brandId: values.brandId || null,
      price: parseDecimal(values.price),
      oldPrice: parseDecimal(values.oldPrice),
      stock: parseDecimal(values.stock),
      condition: values.condition,
      shortDescription: values.shortDescription,
      description: values.description,
    };

    const outcome = await request<AdminProductDetails>(isNew ? "/api/admin/products" : `/api/admin/products/${productId}`, {
      method: isNew ? "POST" : "PUT",
      body,
    });
    setPending(false);

    if (outcome.ok) {
      if (isNew) {
        // Страница создания остаётся в памяти (Activity) — следующий товар начинается с чистой формы.
        setValues(initial);
      }
      onSaved(outcome.data);
      return;
    }
    if (outcome.status === 401 || outcome.status === 403) {
      return;
    }
    const view = describeFailure(outcome, locale, dict, directKeys(FIELDS), ["slug", "sku"]);
    setErrors(view.fields);
    setProblem(view.problem);
    afterCommit(() => focusFirstInvalid(formRef.current, alertRef.current));
  }

  const categoryOptions = withDepth(categories);

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{dict.admin.common.requiredNote}</p>
      <FormAlert ref={alertRef} problem={problem} />

      <Field label={t.name} required error={errors.name}>
        {(control) => <input {...control} name="name" value={values.name} maxLength={300} onChange={(event) => update("name", event.target.value)} />}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.sku} required error={errors.sku}>
          {(control) => (
            <input {...control} name="sku" value={values.sku} maxLength={64} autoComplete="off" onChange={(event) => update("sku", event.target.value)} />
          )}
        </Field>
        <Field label={dict.admin.common.slug} hint={isNew ? dict.admin.common.slugHint : dict.admin.common.slugEditHint} error={errors.slug}>
          {(control) => (
            <input
              {...control}
              name="slug"
              value={values.slug}
              maxLength={300}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => update("slug", event.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.category} required error={errors.categoryId}>
          {(control) => (
            <select {...control} name="categoryId" value={values.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
              <option value="">{t.chooseCategory}</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {indentedLabel(category.name, category.depth)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t.brand} required error={errors.brandId}>
          {(control) => (
            <select {...control} name="brandId" value={values.brandId} onChange={(event) => update("brandId", event.target.value)}>
              <option value="">{t.chooseBrand}</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label={t.price} required error={errors.price}>
          {(control) => (
            <input {...control} name="price" type="number" inputMode="decimal" min={0} step="0.01" value={values.price} onChange={(event) => update("price", event.target.value)} />
          )}
        </Field>
        <Field label={t.oldPrice} hint={t.oldPriceHint} error={errors.oldPrice}>
          {(control) => (
            <input
              {...control}
              name="oldPrice"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={values.oldPrice}
              onChange={(event) => update("oldPrice", event.target.value)}
            />
          )}
        </Field>
        <Field label={t.stock} hint={isNew ? undefined : t.stockHint} error={errors.stock}>
          {(control) => (
            <input {...control} name="stock" type="number" inputMode="numeric" min={0} step={1} value={values.stock} onChange={(event) => update("stock", event.target.value)} />
          )}
        </Field>
        <Field label={t.condition} error={errors.condition}>
          {(control) => (
            <select {...control} name="condition" value={values.condition} onChange={(event) => update("condition", event.target.value as ProductCondition)}>
              {productConditions.map((condition) => (
                <option key={condition} value={condition}>
                  {dict.conditions[condition]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <Field label={t.shortDescription} hint={t.shortDescriptionHint} error={errors.shortDescription}>
        {(control) => (
          <textarea
            {...control}
            name="shortDescription"
            rows={2}
            maxLength={500}
            value={values.shortDescription}
            onChange={(event) => update("shortDescription", event.target.value)}
          />
        )}
      </Field>

      <Field label={t.description} error={errors.description}>
        {(control) => (
          <textarea {...control} name="description" rows={6} value={values.description} onChange={(event) => update("description", event.target.value)} />
        )}
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? (isNew ? dict.admin.common.creating : dict.admin.common.saving) : isNew ? t.createSubmit : t.saveMain}
        </button>
        {isNew ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.newNote}</p> : null}
      </div>
    </form>
  );
}
