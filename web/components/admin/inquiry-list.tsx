"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AdminPagination, listHref } from "@/components/admin/admin-pagination";
import { buttonClass, Field, LoadError, PageHeader } from "@/components/admin/ui";
import type { PagedResult } from "@/lib/api";
import { type AdminInquirySummary, type InquiryStatus, inquiryStatuses } from "@/lib/admin/inquiries";
import { useAdminQuery } from "@/lib/admin/session";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  const { dict } = useI18n();
  const colors: Record<InquiryStatus, string> = {
    New: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
    InProgress: "bg-blue-100 text-blue-900 dark:bg-blue-400/15 dark:text-blue-200",
    Closed: "bg-green-100 text-green-900 dark:bg-green-400/15 dark:text-green-200",
    Spam: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${colors[status]}`}>{dict.admin.inquiries.statuses[status]}</span>;
}

export function InquiryList() {
  const { locale, dict } = useI18n();
  const t = dict.admin.inquiries;
  const router = useRouter();
  const params = useSearchParams();
  const basePath = localeHref(locale, "/admin/inquiries");
  const rawStatus = params.get("status") ?? "";
  const status = (inquiryStatuses as readonly string[]).includes(rawStatus) ? rawStatus as InquiryStatus : null;
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const query = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) query.set("status", status);
  if (q) query.set("q", q);
  const inquiries = useAdminQuery<PagedResult<AdminInquirySummary>>(`/api/admin/inquiries?${query}`);
  const data = inquiries.data;
  const tabs = [null, ...inquiryStatuses];

  return (
    <>
      <PageHeader title={t.title} />
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <nav aria-label={t.statusFilter}>
          <ul className="flex flex-wrap gap-2">
            {tabs.map((value) => (
              <li key={value ?? "all"}>
                <Link href={listHref(basePath, params, { status: value, page: null })} aria-current={value === status ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${value === status ? "border-zinc-900 bg-zinc-900 font-medium text-white dark:border-amber-400 dark:bg-amber-400 dark:text-zinc-950" : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}>
                  {value ? t.statuses[value] : t.allStatuses}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <InquirySearch key={q} initial={q} onSearch={(value) => router.push(listHref(basePath, params, { q: value, page: null }))} />
      </div>
      {inquiries.error ? <LoadError message={inquiries.error.status === 0 ? dict.admin.common.noConnection : tpl(dict.admin.common.loadError, { status: inquiries.error.status })} onRetry={inquiries.reload} /> : null}
      {!data && !inquiries.error ? <p role="status">{dict.admin.common.loading}</p> : null}
      {data ? (
        <div aria-busy={inquiries.loading} className={`flex flex-col gap-4 ${inquiries.loading ? "opacity-60" : ""}`}>
          <p aria-live="polite" className="text-sm text-zinc-500 dark:text-zinc-400">{tpl(dict.admin.common.found, { count: data.totalCount })}</p>
          {data.items.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">{t.empty}</p> : (
            <ul className="flex flex-col gap-3">
              {data.items.map((item) => (
                <li key={item.id}>
                  <Link href={localeHref(locale, `/admin/inquiry/${item.id}`)} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{tpl(t.inquiryTitle, { number: item.number })} · {item.name}</span>
                      <InquiryStatusBadge status={item.status} />
                    </span>
                    <span className="text-sm font-medium">{dict.consultation.topics[item.topic]}{item.productName ? ` · ${item.productName}` : ""}</span>
                    <span className="break-words text-sm text-zinc-600 dark:text-zinc-300">{item.messagePreview}</span>
                    <span className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="break-all">{dict.consultation.contacts[item.preferredContact]} · {item.preferredContact === "Email" ? item.email : item.phone}</span>
                      <time dateTime={item.createdAt}>{formatDateTime(item.createdAt, locale)}</time>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <AdminPagination page={data.page} totalPages={data.totalPages} hrefFor={(target) => listHref(basePath, params, { page: String(target) })} />
        </div>
      ) : null}
    </>
  );
}

function InquirySearch({ initial, onSearch }: { initial: string; onSearch: (value: string) => void }) {
  const { dict } = useI18n();
  const t = dict.admin.inquiries;
  const [value, setValue] = useState(initial);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(value.trim());
  }
  return (
    <form role="search" aria-label={t.filtersLabel} onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field label={t.search} className="flex-1">
        {(control) => <input {...control} type="search" maxLength={200} value={value} onChange={(event) => setValue(event.target.value)} />}
      </Field>
      <button type="submit" className={buttonClass.primary}>{t.searchSubmit}</button>
    </form>
  );
}
