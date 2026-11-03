"use client";

import Link from "next/link";
import { type FormEvent, use, useState } from "react";
import { InquiryStatusBadge } from "@/components/admin/inquiry-list";
import { buttonClass, Field, FormAlert, type FormProblem, LoadError, Notice, PageHeader, Section } from "@/components/admin/ui";
import { describeFailure, directKeys } from "@/lib/admin/forms";
import { type AdminInquiryDetails, type InquiryStatus, inquiryStatuses } from "@/lib/admin/inquiries";
import { useAdminQuery, useAdminRequest } from "@/lib/admin/session";
import { useUnsavedChanges } from "@/lib/admin/unsaved-changes";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";

export function InquiryView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { locale, dict } = useI18n();
  const t = dict.admin.inquiries;
  const inquiry = useAdminQuery<AdminInquiryDetails>(`/api/admin/inquiries/${encodeURIComponent(id)}`);
  const [notice, setNotice] = useState(false);
  const back = { href: localeHref(locale, "/admin/inquiries"), label: t.backToList };
  if (inquiry.error) {
    return <><PageHeader title={t.title} back={back} /><LoadError message={inquiry.error.status === 404 ? dict.admin.common.notFound : inquiry.error.status === 0 ? dict.admin.common.noConnection : tpl(dict.admin.common.loadError, { status: inquiry.error.status })} onRetry={inquiry.error.status === 404 ? undefined : inquiry.reload} /></>;
  }
  if (!inquiry.data || inquiry.data.id !== id) return <p role="status">{dict.admin.common.loading}</p>;
  const data = inquiry.data;
  return (
    <>
      <PageHeader title={tpl(t.inquiryTitle, { number: data.number })} back={back}>
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <InquiryStatusBadge status={data.status} />
          <span>{t.createdAt}: <time dateTime={data.createdAt}>{formatDateTime(data.createdAt, locale)}</time></span>
        </div>
      </PageHeader>
      <Notice message={notice ? t.saved : null} onDismiss={() => setNotice(false)} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title={t.contact}>
            <p className="font-semibold break-words">{data.name}</p>
            <p className="text-sm">{dict.consultation.contactLabel}: {dict.consultation.contacts[data.preferredContact]}</p>
            {data.phone ? <a href={`tel:${data.phone}`} className="break-all underline">{data.phone}</a> : null}
            {data.email ? <a href={`mailto:${data.email}`} className="break-all underline">{data.email}</a> : null}
            {data.userId ? <Link href={localeHref(locale, `/admin/customer/${data.userId}`)} className="text-sm underline">{t.customerProfile}</Link> : null}
          </Section>
          <Section title={t.request}>
            <p className="font-medium">{dict.consultation.topics[data.topic]}</p>
            {data.productName ? <p className="break-words">{dict.consultation.productLabel}: {data.productSlug ? <Link href={localeHref(locale, `/products/${encodeURIComponent(data.productSlug)}`)} className="underline">{data.productName}</Link> : data.productName}</p> : null}
            <p className="whitespace-pre-wrap break-words">{data.message}</p>
            {data.budget ? <p className="break-words text-sm">{dict.consultation.budget}: {data.budget}</p> : null}
          </Section>
        </div>
        <InquiryEditor key={`${data.id}:${data.updatedAt}`} data={data} onSaved={(updated) => { inquiry.setData(updated); setNotice(true); }} />
      </div>
    </>
  );
}

function InquiryEditor({ data, onSaved }: { data: AdminInquiryDetails; onSaved: (data: AdminInquiryDetails) => void }) {
  const { locale, dict } = useI18n();
  const t = dict.admin.inquiries;
  const request = useAdminRequest();
  const [status, setStatus] = useState<InquiryStatus>(data.status);
  const [note, setNote] = useState(data.adminNote ?? "");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const dirty = status !== data.status || note !== (data.adminNote ?? "");
  useUnsavedChanges(dirty && !saved);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setProblem(null);
    setErrors({});
    const outcome = await request<AdminInquiryDetails>(`/api/admin/inquiries/${data.id}`, { method: "PUT", body: { status, adminNote: note } });
    setPending(false);
    if (outcome.ok) {
      setSaved(true);
      onSaved(outcome.data);
    } else if (outcome.status !== 401 && outcome.status !== 403) {
      const failure = describeFailure(outcome, locale, dict, directKeys(["status", "adminNote"]));
      setProblem(failure.problem);
      setErrors(failure.fields);
    }
  }

  return (
    <Section title={t.manage}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormAlert problem={problem} />
        <fieldset disabled={pending} className="flex min-w-0 flex-col gap-4 disabled:opacity-60">
          <Field label={t.status} error={errors.status}>
            {(control) => <select {...control} value={status} onChange={(event) => { setStatus(event.target.value as InquiryStatus); setSaved(false); }}>
              {inquiryStatuses.map((value) => <option key={value} value={value}>{t.statuses[value]}</option>)}
            </select>}
          </Field>
          <Field label={t.note} hint={t.noteHint} error={errors.adminNote}>
            {(control) => <textarea {...control} rows={8} maxLength={3000} value={note} onChange={(event) => { setNote(event.target.value); setSaved(false); }} className={`${control.className} resize-y`} />}
          </Field>
          <button type="submit" disabled={!dirty} className={buttonClass.primary}>{pending ? t.saving : t.save}</button>
        </fieldset>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.updatedAt}: <time dateTime={data.updatedAt}>{formatDateTime(data.updatedAt, locale)}</time></p>
      </form>
    </Section>
  );
}
