"use client";

// Создание и редактирование раздела; на странице раздела — его характеристики и унаследованные
// от родительских разделов (ключи уникальны в ветке, поэтому их полезно видеть рядом).

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { CategoryForm, categoryValues } from "@/components/admin/category-form";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { SpecDefinitions } from "@/components/admin/spec-definitions";
import { buttonClass, FormAlert, type FormProblem, LoadError, Notice, PageHeader, Section } from "@/components/admin/ui";
import { ancestorsOf } from "@/lib/admin/categories";
import { describeFailure } from "@/lib/admin/forms";
import type { AdminCategory, AdminCategoryDetails } from "@/lib/admin/types";
import { type AdminRequest, useAdminQuery, useAdminRequest } from "@/lib/admin/session";
import { useAfterCommit } from "@/lib/admin/use-after-commit";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";

export function CategoryCreate() {
  const { locale, dict } = useI18n();
  const t = dict.admin.categories;
  const router = useRouter();
  const searchParams = useSearchParams();
  const categories = useAdminQuery<AdminCategory[]>("/api/admin/categories");
  const parent = searchParams.get("parent") ?? "";

  return (
    <>
      <PageHeader title={t.newTitle} back={{ href: localeHref(locale, "/admin/categories"), label: t.backToList }} />
      {categories.error ? <LoadError message={tpl(dict.admin.common.loadError, { status: categories.error.status })} onRetry={categories.reload} /> : null}
      <Section title={t.mainSection}>
        <CategoryForm
          key={parent}
          categoryId={null}
          initial={categoryValues(null, parent)}
          categories={categories.data ?? []}
          onSaved={(category) => router.push(localeHref(locale, `/admin/category/${category.id}?notice=created`))}
        />
      </Section>
    </>
  );
}

/** Собственные характеристики предков раздела (каждый предок — отдельный GET /api/admin/categories/{id}). */
function useInheritedSpecs(request: AdminRequest, ancestors: AdminCategory[]): AdminCategoryDetails[] {
  const key = ancestors.map((ancestor) => ancestor.id).join(",");
  const [state, setState] = useState<{ key: string; details: AdminCategoryDetails[] }>({ key: "", details: [] });

  useEffect(() => {
    if (key === "") {
      return;
    }
    let active = true;
    Promise.all(key.split(",").map((id) => request<AdminCategoryDetails>(`/api/admin/categories/${id}`))).then((outcomes) => {
      if (active) {
        setState({ key, details: outcomes.flatMap((outcome) => (outcome.ok ? [outcome.data] : [])) });
      }
    });
    return () => {
      active = false;
    };
  }, [key, request]);

  return state.key === key ? state.details : [];
}

export function CategoryEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { locale, dict } = useI18n();
  const t = dict.admin.categories;
  const router = useRouter();
  const searchParams = useSearchParams();
  const request = useAdminRequest();
  const category = useAdminQuery<AdminCategoryDetails>(`/api/admin/categories/${encodeURIComponent(id)}`);
  const categories = useAdminQuery<AdminCategory[]>("/api/admin/categories");
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [confirmElement, confirm] = useConfirm();
  const alertRef = useRef<HTMLDivElement>(null);
  const afterCommit = useAfterCommit();
  const ancestors = categories.data ? ancestorsOf(categories.data, id) : [];
  const inherited = useInheritedSpecs(request, ancestors);

  const createdNotice = searchParams.get("notice") === "created" ? t.created : null;
  const shownNotice = notice ?? createdNotice;

  function showProblem(next: FormProblem) {
    setNotice(null);
    setProblem(next);
    afterCommit(() => alertRef.current?.focus());
  }

  if (category.error && !category.data) {
    return (
      <>
        <PageHeader title={t.title} back={{ href: localeHref(locale, "/admin/categories"), label: t.backToList }} />
        <LoadError
          message={category.error.status === 404 ? dict.admin.common.notFound : tpl(dict.admin.common.loadError, { status: category.error.status })}
          onRetry={category.error.status === 404 ? undefined : category.reload}
        />
      </>
    );
  }

  if (!category.data) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.admin.common.loading}</p>;
  }

  const data = category.data;

  async function remove() {
    const confirmed = await confirm({
      title: t.deleteTitle,
      message: tpl(t.deleteText, { name: data.name }),
      confirmLabel: dict.admin.common.delete,
    });
    if (!confirmed) {
      return;
    }
    setProblem(null);
    const outcome = await request<void>(`/api/admin/categories/${data.id}`, { method: "DELETE" });
    if (outcome.ok) {
      router.push(localeHref(locale, `/admin/categories?deleted=${encodeURIComponent(data.name)}`));
      return;
    }
    if (outcome.status !== 401 && outcome.status !== 403) {
      showProblem({ ...describeFailure(outcome, locale, dict, () => null).problem, title: dict.admin.common.deleteFailed });
    }
  }

  const inheritedSpecs = inherited.filter((details) => details.specs.length > 0);

  return (
    <>
      <PageHeader
        title={tpl(t.editTitle, { name: data.name })}
        back={{ href: localeHref(locale, "/admin/categories"), label: t.backToList }}
        actions={
          <>
            <Link href={localeHref(locale, `/admin/category/new?parent=${data.id}`)} className={buttonClass.secondary}>
              + {t.addChild}
            </Link>
            <button type="button" onClick={remove} className={buttonClass.danger}>
              {t.deleteCategory}
            </button>
          </>
        }
      >
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-mono">{data.slug}</span>
          <Link href={localeHref(locale, `/admin/products?categoryId=${data.id}`)} className="underline underline-offset-2">
            {t.viewProducts} ({data.productCount})
          </Link>
          <span>{tpl(t.childCount, { count: data.childCount })}</span>
        </p>
      </PageHeader>

      <Notice
        message={shownNotice}
        onDismiss={() => {
          setNotice(null);
          if (createdNotice) {
            router.replace(localeHref(locale, `/admin/category/${data.id}`), { scroll: false });
          }
        }}
      />
      <FormAlert ref={alertRef} problem={problem} />

      <Section title={t.mainSection}>
        <CategoryForm
          key={JSON.stringify([data.name, data.slug, data.description, data.parentId, data.sortOrder])}
          categoryId={data.id}
          initial={categoryValues(data)}
          categories={categories.data ?? []}
          onSaved={(saved) => {
            category.setData(saved);
            categories.reload();
            setProblem(null);
            setNotice(dict.admin.common.saved);
          }}
        />
      </Section>

      <Section title={dict.admin.specDefs.title} description={dict.admin.specDefs.hint}>
        {inheritedSpecs.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50">
            <p className="font-medium">{dict.admin.specDefs.inherited}</p>
            <ul className="flex flex-col gap-1">
              {inheritedSpecs.flatMap((details) =>
                details.specs.map((spec) => (
                  <li key={spec.id} className="flex flex-wrap gap-x-2 text-zinc-600 dark:text-zinc-400">
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {spec.name}
                      {spec.unit ? `, ${spec.unit}` : ""}
                    </span>
                    <span className="font-mono text-xs leading-5">{spec.key}</span>
                    <span>·</span>
                    <Link href={localeHref(locale, `/admin/category/${details.id}`)} className="underline underline-offset-2">
                      {tpl(dict.admin.specDefs.inheritedFrom, { name: details.name })}
                    </Link>
                  </li>
                )),
              )}
            </ul>
          </div>
        ) : null}
        <SpecDefinitions
          categoryId={data.id}
          specs={data.specs}
          onChanged={(message) => {
            setProblem(null);
            setNotice(message);
            category.reload();
          }}
          onProblem={showProblem}
        />
      </Section>

      {confirmElement}
    </>
  );
}
