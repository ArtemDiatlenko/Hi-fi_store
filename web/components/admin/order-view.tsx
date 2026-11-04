"use client";

// Карточка заказа в админке: снимок позиций, покупатель, доставка, оплата, комментарий, даты (Europe/Kyiv)
// и смена статуса кнопками из nextStatuses. Отмена — с подтверждением (товары возвращаются на склад).

import Link from "next/link";
import { type FormEvent, use, useId, useRef, useState } from "react";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { OrderDetailsView, OrderStatusBadge } from "@/components/order-details";
import { buttonClass, FormAlert, type FormProblem, LoadError, Notice, PageHeader } from "@/components/admin/ui";
import { describeFailure } from "@/lib/admin/forms";
import type { AdminOrderDetails } from "@/lib/admin/types";
import { useAdminQuery, useAdminRequest } from "@/lib/admin/session";
import { useAfterCommit } from "@/lib/admin/use-after-commit";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { tpl } from "@/lib/i18n/util";
import type { OrderStatus } from "@/lib/orders";

export function OrderView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { locale, dict } = useI18n();
  const t = dict.admin.orders;
  const request = useAdminRequest();
  const order = useAdminQuery<AdminOrderDetails>(`/api/admin/orders/${encodeURIComponent(id)}`);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  // ТТН, который уйдёт вместе с переводом в «Відправлено».
  const [shipTracking, setShipTracking] = useState("");
  const [shipTrackingError, setShipTrackingError] = useState<string[] | undefined>();
  const shipTrackingId = useId();
  const [confirmElement, confirm] = useConfirm();
  const alertRef = useRef<HTMLDivElement>(null);
  const afterCommit = useAfterCommit();
  const actionsId = useId();
  const metaId = useId();
  const back = { href: localeHref(locale, "/admin/orders"), label: t.backToList };

  if (order.error && !order.data) {
    return (
      <>
        <PageHeader title={t.title} back={back} />
        <LoadError
          message={order.error.status === 404 ? dict.admin.common.notFound : tpl(dict.admin.common.loadError, { status: order.error.status })}
          onRetry={order.error.status === 404 ? undefined : order.reload}
        />
      </>
    );
  }

  if (!order.data) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.admin.common.loading}</p>;
  }

  const data = order.data;

  async function changeStatus(status: OrderStatus) {
    if (status === "Cancelled") {
      const confirmed = await confirm({
        title: tpl(t.cancelTitle, { number: data.number }),
        message: t.cancelText,
        confirmLabel: t.cancelConfirm,
        cancelLabel: t.keep,
      });
      if (!confirmed) {
        return;
      }
    }
    setPendingStatus(status);
    setNotice(null);
    setProblem(null);
    setShipTrackingError(undefined);
    const body = status === "Shipped" ? { status, trackingNumber: shipTracking.trim() || null } : { status };
    const outcome = await request<AdminOrderDetails>(`/api/admin/orders/${data.id}/status`, { method: "PUT", body });
    setPendingStatus(null);
    if (outcome.ok) {
      order.setData(outcome.data);
      setShipTracking("");
      setNotice(tpl(t.statusChanged, { status: dict.orderStatus[outcome.data.status] }));
      return;
    }
    if (outcome.status === 401 || outcome.status === 403) {
      return;
    }
    // Ошибка в ТТН — показываем у поля, карточку не перечитываем.
    const tracking = describeFailure(outcome, locale, dict, (key) => (key === "trackingNumber" ? key : null));
    if (tracking.fields.trackingNumber?.length) {
      setShipTrackingError(tracking.fields.trackingNumber);
      afterCommit(() => document.getElementById(shipTrackingId)?.focus());
      return;
    }
    // 409 — заказ уже изменили (например, в другой вкладке): показываем причину и перечитываем карточку.
    const view = describeFailure(outcome, locale, dict, () => null);
    setProblem({ ...view.problem, title: t.changeFailed });
    order.reload();
    afterCommit(() => alertRef.current?.focus());
  }

  return (
    <>
      <PageHeader
        title={tpl(t.orderTitle, { number: data.number })}
        back={back}
        actions={
          <button type="button" onClick={order.reload} className={buttonClass.secondary}>
            {t.refresh}
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <OrderStatusBadge status={data.status} dict={dict} />
          <span>
            {dict.order.placedAt}: <time dateTime={data.createdAt}>{formatDateTime(data.createdAt, locale)}</time>
          </span>
        </div>
      </PageHeader>

      <Notice message={notice} onDismiss={() => setNotice(null)} />
      <FormAlert ref={alertRef} problem={problem} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <aside className="flex flex-col gap-4 lg:order-2">
          <section aria-labelledby={actionsId} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <h2 id={actionsId} className="font-medium">
              {t.actionsTitle}
            </h2>
            {data.nextStatuses.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.noActions}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.nextStatuses.includes("Shipped") ? (
                  <div className="flex flex-col gap-1 text-sm">
                    <label htmlFor={shipTrackingId} className="font-medium">
                      {t.trackingNumber} <span className="font-normal text-zinc-500 dark:text-zinc-400">({t.optional})</span>
                    </label>
                    <input
                      id={shipTrackingId}
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={50}
                      value={shipTracking}
                      onChange={(event) => {
                        setShipTracking(event.target.value);
                        setShipTrackingError(undefined);
                      }}
                      aria-invalid={shipTrackingError ? true : undefined}
                      aria-describedby={`${shipTrackingId}-hint${shipTrackingError ? ` ${shipTrackingId}-error` : ""}`}
                      className={`min-h-11 rounded-lg border bg-white px-3 py-2 font-mono dark:bg-zinc-950 ${shipTrackingError ? "border-red-600 dark:border-red-500" : "border-zinc-300 dark:border-zinc-700"}`}
                    />
                    {shipTrackingError ? (
                      <p id={`${shipTrackingId}-error`} className="text-red-700 dark:text-red-400">{shipTrackingError.join(" ")}</p>
                    ) : null}
                    <p id={`${shipTrackingId}-hint`} className="text-xs text-zinc-500 dark:text-zinc-400">{t.trackingHint}</p>
                  </div>
                ) : null}
                {data.nextStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={pendingStatus !== null}
                    onClick={() => changeStatus(status)}
                    className={status === "Cancelled" ? buttonClass.danger : buttonClass.primary}
                  >
                    {pendingStatus === status ? t.changing : t.actions[status]}
                  </button>
                ))}
              </div>
            )}
          </section>

          <OrderInfoForm key={`${data.id}-${data.updatedAt}`} order={data} onSaved={(next, message) => {
            order.setData(next);
            setNotice(message);
          }} />

          <section aria-labelledby={metaId} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <h2 id={metaId} className="font-medium">
              {t.meta}
            </h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">{t.updatedAt}</dt>
                <dd>
                  <time dateTime={data.updatedAt}>{formatDateTime(data.updatedAt, locale)}</time>
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">{t.customerType}</dt>
                <dd>{data.userId ? t.registered : t.guest}</dd>
              </div>
              {data.userId ? (
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">{t.userId}</dt>
                  <dd>
                    <Link href={localeHref(locale, `/admin/customer/${data.userId}`)} className="underline underline-offset-2">
                      {dict.admin.customers.openProfile}
                    </Link>
                  </dd>
                </div>
              ) : null}
              {data.delivery.cityRef ? (
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">{t.cityRef}</dt>
                  <dd className="break-all font-mono text-xs">{data.delivery.cityRef}</dd>
                </div>
              ) : null}
              {data.delivery.warehouseRef ? (
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">{t.warehouseRef}</dt>
                  <dd className="break-all font-mono text-xs">{data.delivery.warehouseRef}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </aside>

        <div className="min-w-0 lg:order-1">
          <OrderDetailsView order={data} locale={locale} dict={dict} />
        </div>
      </div>
      {confirmElement}
    </>
  );
}

/** ТТН и заметка менеджера: можно поправить в любой момент. Новый ТТН у отправленного заказа уходит покупателю письмом. */
function OrderInfoForm({ order, onSaved }: { order: AdminOrderDetails; onSaved: (order: AdminOrderDetails, message: string) => void }) {
  const { locale, dict } = useI18n();
  const t = dict.admin.orders;
  const request = useAdminRequest();
  const titleId = useId();
  const trackingId = useId();
  const noteId = useId();
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");
  const [note, setNote] = useState(order.managerNote ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const changed = tracking.trim() !== (order.trackingNumber ?? "") || note.trim() !== (order.managerNote ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setErrors({});
    const outcome = await request<AdminOrderDetails>(`/api/admin/orders/${order.id}/info`, {
      method: "PUT",
      body: { trackingNumber: tracking.trim() || null, managerNote: note.trim() || null },
    });
    setPending(false);
    if (outcome.ok) {
      onSaved(outcome.data, t.infoSaved);
      return;
    }
    if (outcome.status === 401 || outcome.status === 403) return;
    const view = describeFailure(outcome, locale, dict, (key) => (key === "trackingNumber" || key === "managerNote" ? key : null));
    setErrors(view.fields);
  }

  const inputClass = (invalid: boolean) =>
    `rounded-lg border bg-white px-3 py-2 dark:bg-zinc-950 ${invalid ? "border-red-600 dark:border-red-500" : "border-zinc-300 dark:border-zinc-700"}`;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 id={titleId} className="font-medium">{t.infoTitle}</h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor={trackingId} className="font-medium">{t.trackingNumber}</label>
          <input
            id={trackingId}
            inputMode="numeric"
            autoComplete="off"
            maxLength={50}
            value={tracking}
            onChange={(event) => setTracking(event.target.value)}
            aria-invalid={errors.trackingNumber?.length ? true : undefined}
            aria-describedby={errors.trackingNumber?.length ? `${trackingId}-error` : undefined}
            className={`min-h-11 font-mono ${inputClass(!!errors.trackingNumber?.length)}`}
          />
          {errors.trackingNumber?.length ? (
            <p id={`${trackingId}-error`} className="text-red-700 dark:text-red-400">{errors.trackingNumber.join(" ")}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={noteId} className="font-medium">{t.managerNote}</label>
          <textarea
            id={noteId}
            rows={4}
            maxLength={3000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={errors.managerNote?.length ? true : undefined}
            aria-describedby={`${noteId}-hint${errors.managerNote?.length ? ` ${noteId}-error` : ""}`}
            className={inputClass(!!errors.managerNote?.length)}
          />
          {errors.managerNote?.length ? (
            <p id={`${noteId}-error`} className="text-red-700 dark:text-red-400">{errors.managerNote.join(" ")}</p>
          ) : null}
          <p id={`${noteId}-hint`} className="text-xs text-zinc-500 dark:text-zinc-400">{t.managerNoteHint}</p>
        </div>
        <button type="submit" disabled={pending || !changed} className={buttonClass.secondary}>
          {pending ? dict.admin.common.saving : dict.admin.common.save}
        </button>
      </form>
    </section>
  );
}
