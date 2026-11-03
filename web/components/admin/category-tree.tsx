"use client";

// Дерево разделов: вложенные списки (порядок и вложенность — как в каталоге), действия у каждого раздела.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { listHref } from "@/components/admin/admin-pagination";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { buttonClass, FormAlert, type FormProblem, LoadError, Notice, PageHeader } from "@/components/admin/ui";
import { describeFailure } from "@/lib/admin/forms";
import type { AdminCategory } from "@/lib/admin/types";
import { useAdminQuery, useAdminRequest } from "@/lib/admin/session";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";

interface TreeNode {
  category: AdminCategory;
  children: TreeNode[];
}

function buildTree(categories: AdminCategory[]): TreeNode[] {
  const nodes = new Map(categories.map((category) => [category.id, { category, children: [] as TreeNode[] }]));
  const roots: TreeNode[] = [];
  // Порядок списка — обход в глубину, поэтому дети добавляются в правильном порядке.
  for (const category of categories) {
    const node = nodes.get(category.id)!;
    const parent = category.parentId ? nodes.get(category.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}

export function CategoryTree() {
  const { locale, dict } = useI18n();
  const t = dict.admin.categories;
  const router = useRouter();
  const searchParams = useSearchParams();
  const request = useAdminRequest();
  const categories = useAdminQuery<AdminCategory[]>("/api/admin/categories");
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [confirmElement, confirm] = useConfirm();
  const alertRef = useRef<HTMLDivElement>(null);
  const basePath = localeHref(locale, "/admin/categories");

  const deletedName = searchParams.get("deleted");
  const shownNotice = notice ?? (deletedName ? tpl(t.deleted, { name: deletedName }) : null);

  async function remove(category: AdminCategory) {
    const confirmed = await confirm({
      title: t.deleteTitle,
      message: tpl(t.deleteText, { name: category.name }),
      confirmLabel: dict.admin.common.delete,
    });
    if (!confirmed) {
      return;
    }
    setProblem(null);
    setNotice(null);
    const outcome = await request<void>(`/api/admin/categories/${category.id}`, { method: "DELETE" });
    if (outcome.ok) {
      setNotice(tpl(t.deleted, { name: category.name }));
      categories.reload();
      return;
    }
    if (outcome.status === 401 || outcome.status === 403) {
      return;
    }
    setProblem({ ...describeFailure(outcome, locale, dict, () => null).problem, title: dict.admin.common.deleteFailed });
    requestAnimationFrame(() => alertRef.current?.focus());
  }

  const renderNodes = (nodes: TreeNode[], depth: number) => (
    <ul className={depth === 0 ? "flex flex-col gap-2" : "mt-2 flex flex-col gap-2 border-l border-zinc-200 pl-3 sm:pl-5 dark:border-zinc-800"}>
      {nodes.map(({ category, children }) => (
        <li key={category.id}>
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <div className="flex min-w-0 flex-col gap-1">
              <Link href={localeHref(locale, `/admin/categories/${category.id}`)} className="font-medium underline-offset-2 hover:underline">
                {category.name}
              </Link>
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                <span className="font-mono">{category.slug}</span>
                <Link href={localeHref(locale, `/admin/products?categoryId=${category.id}`)} className="underline underline-offset-2">
                  {tpl(t.productCount, { count: category.productCount })}
                </Link>
                <span>{tpl(t.childCount, { count: category.childCount })}</span>
                <span>
                  {dict.admin.common.sortOrder}: {category.sortOrder}
                </span>
              </span>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                href={localeHref(locale, `/admin/categories/new?parent=${category.id}`)}
                aria-label={tpl(t.addChildAria, { name: category.name })}
                className={buttonClass.secondary}
              >
                + {t.addChild}
              </Link>
              <Link href={localeHref(locale, `/admin/categories/${category.id}`)} aria-label={tpl(t.editAria, { name: category.name })} className={buttonClass.secondary}>
                {dict.admin.common.edit}
              </Link>
              <button type="button" onClick={() => remove(category)} aria-label={tpl(t.deleteAria, { name: category.name })} className={buttonClass.danger}>
                {dict.admin.common.delete}
              </button>
            </div>
          </div>
          {children.length > 0 ? renderNodes(children, depth + 1) : null}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader
        title={t.title}
        actions={
          <Link href={localeHref(locale, "/admin/categories/new")} className={buttonClass.primary}>
            {t.add}
          </Link>
        }
      />
      <Notice
        message={shownNotice}
        onDismiss={() => {
          setNotice(null);
          if (deletedName) {
            router.replace(listHref(basePath, searchParams, { deleted: null }), { scroll: false });
          }
        }}
      />
      <FormAlert ref={alertRef} problem={problem} />

      {categories.error ? (
        <LoadError message={tpl(dict.admin.common.loadError, { status: categories.error.status })} onRetry={categories.reload} />
      ) : null}
      {categories.data === null && !categories.error ? <p className="text-sm text-zinc-500">{dict.admin.common.loading}</p> : null}
      {categories.data && categories.data.length === 0 ? <p className="text-sm text-zinc-500">{t.empty}</p> : null}
      {categories.data && categories.data.length > 0 ? (
        <section aria-label={t.treeLabel} aria-busy={categories.loading}>
          {renderNodes(buildTree(categories.data), 0)}
        </section>
      ) : null}

      {confirmElement}
    </>
  );
}
