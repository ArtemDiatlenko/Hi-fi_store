"use client";

// Страницы создания и редактирования товара. Основные поля, характеристики и изображения сохраняются
// отдельными запросами (как устроен API), у каждого блока — своя кнопка и свои ошибки.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useRef, useState } from "react";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { EMPTY_PRODUCT, ProductMainForm, valuesFromProduct } from "@/components/admin/product-form";
import { ProductImagesEditor } from "@/components/admin/product-images-editor";
import { ProductSpecsEditor } from "@/components/admin/product-specs-editor";
import { buttonClass, FormAlert, type FormProblem, LoadError, Notice, PageHeader, PublishedBadge, Section } from "@/components/admin/ui";
import { describeFailure } from "@/lib/admin/forms";
import type { AdminBrand, AdminCategory, AdminProductDetails } from "@/lib/admin/types";
import { useAdminQuery, useAdminRequest } from "@/lib/admin/session";
import { useAfterCommit } from "@/lib/admin/use-after-commit";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";

export function ProductCreate() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const categories = useAdminQuery<AdminCategory[]>("/api/admin/categories");
  const brands = useAdminQuery<AdminBrand[]>("/api/admin/brands");

  return (
    <>
      <PageHeader title={dict.admin.products.newTitle} back={{ href: localeHref(locale, "/admin/products"), label: dict.admin.products.backToList }} />
      {categories.error || brands.error ? (
        <LoadError
          message={tpl(dict.admin.common.loadError, { status: (categories.error ?? brands.error)!.status })}
          onRetry={() => {
            categories.reload();
            brands.reload();
          }}
        />
      ) : null}
      <Section title={dict.admin.productForm.mainSection}>
        <ProductMainForm
          productId={null}
          initial={EMPTY_PRODUCT}
          categories={categories.data ?? []}
          brands={brands.data ?? []}
          onSaved={(product) => router.push(localeHref(locale, `/admin/product/${product.id}?notice=created`))}
        />
      </Section>
    </>
  );
}

/** Ключ блока по его серверным данным: блок пересоздаётся (со свежими значениями), только когда они изменились. */
function snapshot(value: unknown): string {
  return JSON.stringify(value);
}

export function ProductEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { locale, dict } = useI18n();
  const t = dict.admin.products;
  const router = useRouter();
  const searchParams = useSearchParams();
  const request = useAdminRequest();
  const product = useAdminQuery<AdminProductDetails>(`/api/admin/products/${encodeURIComponent(id)}`);
  const categories = useAdminQuery<AdminCategory[]>("/api/admin/categories");
  const brands = useAdminQuery<AdminBrand[]>("/api/admin/brands");
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [draftCategoryId, setDraftCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmElement, confirm] = useConfirm();
  const alertRef = useRef<HTMLDivElement>(null);
  const afterCommit = useAfterCommit();

  const createdNotice = searchParams.get("notice") === "created" ? t.created : null;
  const shownNotice = notice ?? createdNotice;

  function dismissNotice() {
    setNotice(null);
    if (createdNotice) {
      router.replace(localeHref(locale, `/admin/product/${id}`), { scroll: false });
    }
  }

  function saved(next: AdminProductDetails, message: string) {
    product.setData(next);
    setProblem(null);
    setNotice(message);
  }

  if (product.error && !product.data) {
    return (
      <>
        <PageHeader title={t.editTitle} back={{ href: localeHref(locale, "/admin/products"), label: t.backToList }} />
        <LoadError
          message={product.error.status === 404 ? dict.admin.common.notFound : tpl(dict.admin.common.loadError, { status: product.error.status })}
          onRetry={product.error.status === 404 ? undefined : product.reload}
        />
      </>
    );
  }

  if (!product.data) {
    return <p className="text-sm text-zinc-500">{dict.admin.common.loading}</p>;
  }

  const data = product.data;

  async function togglePublished() {
    setBusy(true);
    setProblem(null);
    const outcome = await request<AdminProductDetails>(`/api/admin/products/${data.id}/${data.isPublished ? "unpublish" : "publish"}`, { method: "POST" });
    setBusy(false);
    if (outcome.ok) {
      saved(outcome.data, outcome.data.isPublished ? t.publishedDone : t.unpublishedDone);
    } else if (outcome.status !== 401 && outcome.status !== 403) {
      setProblem(describeFailure(outcome, locale, dict, () => null).problem);
      afterCommit(() => alertRef.current?.focus());
    }
  }

  async function remove() {
    const confirmed = await confirm({
      title: t.deleteTitle,
      message: tpl(t.deleteText, { name: data.name }),
      confirmLabel: dict.admin.common.delete,
    });
    if (!confirmed) {
      return;
    }
    setBusy(true);
    setProblem(null);
    const outcome = await request<void>(`/api/admin/products/${data.id}`, { method: "DELETE" });
    setBusy(false);
    if (outcome.ok) {
      router.push(localeHref(locale, "/admin/products?notice=deleted"));
      return;
    }
    if (outcome.status !== 401 && outcome.status !== 403) {
      const view = describeFailure(outcome, locale, dict, () => null);
      setProblem({ ...view.problem, title: dict.admin.common.deleteFailed });
      afterCommit(() => alertRef.current?.focus());
    }
  }

  const categoryChanged = draftCategoryId !== null && draftCategoryId !== data.category.id;
  const mainValues = valuesFromProduct(data);

  return (
    <>
      <PageHeader
        title={data.name}
        back={{ href: localeHref(locale, "/admin/products"), label: t.backToList }}
        actions={
          <>
            <button type="button" onClick={togglePublished} disabled={busy} className={data.isPublished ? buttonClass.secondary : buttonClass.primary}>
              {data.isPublished ? t.unpublish : t.publish}
            </button>
            <button type="button" onClick={remove} disabled={busy} className={buttonClass.danger}>
              {t.deleteProduct}
            </button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <PublishedBadge published={data.isPublished} />
          <span>{tpl(t.sku, { sku: data.sku })}</span>
          <span>
            {tpl(t.updatedAt, { date: formatDateTime(data.updatedAt, locale) })}
          </span>
          {data.isPublished ? (
            <Link href={localeHref(locale, `/products/${data.slug}`)} className="underline underline-offset-2">
              {t.viewOnSite}
            </Link>
          ) : null}
        </div>
      </PageHeader>

      <Notice message={shownNotice} onDismiss={dismissNotice} />
      <FormAlert ref={alertRef} problem={problem} />

      <Section title={dict.admin.productForm.mainSection}>
        <ProductMainForm
          key={snapshot(mainValues)}
          productId={data.id}
          initial={mainValues}
          categories={categories.data ?? []}
          brands={brands.data ?? []}
          onCategoryChange={setDraftCategoryId}
          onSaved={(next) => {
            setDraftCategoryId(null);
            saved(next, dict.admin.common.saved);
          }}
        />
      </Section>

      <Section title={dict.admin.specs.title} description={dict.admin.specs.hint}>
        <ProductSpecsEditor
          key={snapshot([data.specs, data.availableSpecs])}
          product={data}
          categoryChanged={categoryChanged}
          onSaved={saved}
        />
      </Section>

      <Section title={dict.admin.images.title} description={dict.admin.images.hint}>
        <ProductImagesEditor key={snapshot(data.images)} product={data} onSaved={saved} />
      </Section>

      {confirmElement}
    </>
  );
}
