"use client";

// Заявка на консультацию: тема, контакты, описание запроса → POST /api/inquiries.
// ?product=<slug> — заявка со страницы товара (товар подставляется и показывается), ?topic=<Topic> — тема по умолчанию.
// Если покупатель вошёл, имя и email подставляются из профиля, а заявка привязывается к аккаунту.
// Поле website — ловушка для ботов: скрыто от людей, и заявка с ним на сервере не сохраняется.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { focusFirstInvalid } from "@/lib/admin/api";
import { useAfterCommit } from "@/lib/admin/use-after-commit";
import { readToken } from "@/lib/auth";
import { PhoneInput } from "@/components/phone-input";
import { isValidInternationalPhone } from "@/lib/phone";
import { readProblem } from "@/lib/client-api";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { translateServerMessage } from "@/lib/i18n/server-messages";
import { tpl } from "@/lib/i18n/util";

const TOPICS = ["Selection", "CustomBuild", "Product", "Service", "Other"] as const;
const CONTACTS = ["Phone", "Telegram", "Viber", "Email"] as const;
type Topic = (typeof TOPICS)[number];
type Contact = (typeof CONTACTS)[number];

const inputClass = (invalid: boolean) =>
  `min-h-11 w-full rounded-md border px-3 py-2 dark:bg-zinc-900 ${invalid ? "border-red-600 dark:border-red-500" : "border-zinc-300 dark:border-zinc-700"}`;

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }
  return (
    <p id={id} className="text-sm text-red-600 dark:text-red-400">
      {messages.join(" ")}
    </p>
  );
}

export function ConsultationForm() {
  const params = useSearchParams();
  const productParam = params.get("product");
  const topicParam = params.get("topic");
  return <ConsultationFields key={`${productParam ?? ""}:${topicParam ?? ""}`} productParam={productParam} topicParam={topicParam} />;
}

function ConsultationFields({ productParam, topicParam }: { productParam: string | null; topicParam: string | null }) {
  const { locale, dict } = useI18n();
  const t = dict.consultation;
  const baseId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const afterCommit = useAfterCommit();

  const [topic, setTopic] = useState<Topic>(
    (TOPICS as readonly string[]).includes(topicParam ?? "") ? (topicParam as Topic) : productParam ? "Product" : "Selection",
  );
  const [contact, setContact] = useState<Contact>("Phone");
  const [product, setProduct] = useState<{ slug: string; name: string } | null>(null);
  const [productRemoved, setProductRemoved] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<number | null>(null);

  // Название товара из ?product=… — чтобы покупатель видел, о чём заявка.
  useEffect(() => {
    if (!productParam) {
      return;
    }
    let active = true;
    fetch(`/api/catalog/products/${encodeURIComponent(productParam)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { slug: string; name: string } | null) => {
        if (active && data) {
          setProduct({ slug: data.slug, name: data.name });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [productParam]);

  // Вошедшему покупателю подставляем имя и email.
  useEffect(() => {
    const token = readToken();
    if (!token) {
      return;
    }
    let active = true;
    fetch("/api/account/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((me: { email: string | null; fullName: string | null; phone: string | null } | null) => {
        if (active && me) {
          setName((current) => current || me.fullName || "");
          setPhone((current) => current || me.phone || "");
          setEmail((current) => current || me.email || "");
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    // Длину номера для выбранной страны проверяем сразу, без запроса к серверу.
    if (phone && !isValidInternationalPhone(phone)) {
      setErrors({ phone: [dict.common.phoneInvalid] });
      setFailure(null);
      afterCommit(() => focusFirstInvalid(formRef.current));
      return;
    }
    setPending(true);
    setErrors({});
    setFailure(null);

    const token = readToken();
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          topic,
          name: form.get("name"),
          phone,
          email: form.get("email"),
          preferredContact: contact,
          budget: form.get("budget"),
          message: form.get("message"),
          productSlug: productRemoved ? null : productParam,
          consent: form.get("consent") === "on",
          website: form.get("website"),
        }),
      });
      if (response.ok) {
        const { number } = (await response.json()) as { number: number };
        setSent(number);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (response.status === 429) {
        setFailure(t.tooMany);
        return;
      }
      const problem = await readProblem(response);
      const translated: Record<string, string[]> = {};
      for (const [key, messages] of Object.entries(problem.errors ?? {})) {
        translated[key] = messages.map((message) => translateServerMessage(message, locale));
      }
      setErrors(translated);
      setFailure(Object.keys(translated).length > 0 ? null : t.errorTitle);
      afterCommit(() => focusFirstInvalid(formRef.current));
    } catch {
      setFailure(dict.common.noConnection);
    } finally {
      setPending(false);
    }
  }

  if (sent !== null) {
    return (
      <div role="status" className="flex flex-col gap-4 rounded-2xl border border-emerald-600/30 bg-emerald-50 p-6 dark:border-emerald-400/30 dark:bg-emerald-400/10">
        <h2 className="text-[1.75rem] leading-tight font-normal">{tpl(t.sentTitle, { number: sent })}</h2>
        <p className="text-zinc-700 dark:text-zinc-300">{t.sentText}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <button type="button" onClick={() => setSent(null)} className="underline">
            {t.sentAgain}
          </button>
          <Link href={localeHref(locale, "/catalog")} className="underline">
            {t.toCatalog}
          </Link>
        </div>
      </div>
    );
  }

  const describedBy = (field: string, hint?: boolean) =>
    [errors[field]?.length ? `${baseId}-${field}-error` : null, hint ? `${baseId}-${field}-hint` : null].filter(Boolean).join(" ") || undefined;
  const needsEmail = contact === "Email";

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-6">
      {failure ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {failure}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">{t.topicLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((value) => (
            <label
              key={value}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-500 ${
                topic === value
                  ? "border-zinc-900 bg-zinc-900 font-medium text-white dark:border-amber-400 dark:bg-amber-400 dark:text-zinc-950"
                  : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              <input type="radio" name="topic" value={value} checked={topic === value} onChange={() => setTopic(value)} className="sr-only" />
              {t.topics[value]}
            </label>
          ))}
        </div>
        <FieldError id={`${baseId}-topic-error`} messages={errors.topic} />
      </fieldset>

      {product && !productRemoved ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <span>
            <span className="text-zinc-500 dark:text-zinc-400">{t.productLabel}: </span>
            <Link href={localeHref(locale, `/products/${product.slug}`)} className="font-medium underline">
              {product.name}
            </Link>
          </span>
          <button type="button" onClick={() => setProductRemoved(true)} aria-label={t.removeProduct} className="min-h-11 min-w-11 text-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            ×
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">{t.name}</span>
          <input
            name="name"
            required
            maxLength={200}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={errors.name?.length ? true : undefined}
            aria-describedby={describedBy("name")}
            className={inputClass(!!errors.name?.length)}
          />
          <FieldError id={`${baseId}-name-error`} messages={errors.name} />
        </label>

        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1 text-sm font-medium">{t.contactLabel}</legend>
          <div className="flex flex-wrap gap-2">
            {CONTACTS.map((value) => (
              <label
                key={value}
                className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-4 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-500 ${
                  contact === value
                    ? "border-amber-500 bg-amber-50 font-medium text-amber-900 dark:bg-amber-400/10 dark:text-amber-200"
                    : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                <input type="radio" name="preferredContact" value={value} checked={contact === value} onChange={() => setContact(value)} className="sr-only" />
                {t.contacts[value]}
              </label>
            ))}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{needsEmail ? t.contactHintEmail : t.contactHintPhone}</p>
        </fieldset>

        {/* Не <label> вокруг поля: внутри два элемента (страна и номер), подпись относится к номеру. */}
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor={`${baseId}-phone`} className="font-medium">
            {t.phone}
            {needsEmail ? <span className="font-normal text-zinc-500"> ({t.optional})</span> : null}
          </label>
          <PhoneInput
            id={`${baseId}-phone`}
            locale={locale}
            countryLabel={dict.common.phoneCountry}
            value={phone}
            onChange={(value) => {
              setPhone(value);
              setErrors((current) => (current.phone ? { ...current, phone: [] } : current));
            }}
            required={!needsEmail}
            invalid={!!errors.phone?.length}
            describedBy={describedBy("phone")}
          />
          <FieldError id={`${baseId}-phone-error`} messages={errors.phone} />
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            {t.email}
            {needsEmail ? null : <span className="font-normal text-zinc-500"> ({t.optional})</span>}
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required={needsEmail}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={errors.email?.length ? true : undefined}
            aria-describedby={describedBy("email")}
            className={inputClass(!!errors.email?.length)}
          />
          <FieldError id={`${baseId}-email-error`} messages={errors.email} />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">{t.message}</span>
          <textarea
            name="message"
            required
            rows={6}
            maxLength={3000}
            placeholder={t.messagePlaceholder}
            aria-invalid={errors.message?.length ? true : undefined}
            aria-describedby={describedBy("message", true)}
            className={`${inputClass(!!errors.message?.length)} resize-y`}
          />
          <span id={`${baseId}-message-hint`} className="text-xs text-zinc-500 dark:text-zinc-400">
            {t.messageHint}
          </span>
          <FieldError id={`${baseId}-message-error`} messages={errors.message} />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">
            {t.budget} <span className="font-normal text-zinc-500">({t.optional})</span>
          </span>
          <input
            name="budget"
            maxLength={100}
            aria-describedby={describedBy("budget", true)}
            className={`${inputClass(!!errors.budget?.length)} sm:max-w-xs`}
          />
          <span id={`${baseId}-budget-hint`} className="text-xs text-zinc-500 dark:text-zinc-400">
            {t.budgetHint}
          </span>
          <FieldError id={`${baseId}-budget-error`} messages={errors.budget} />
        </label>
      </div>

      {/* Ловушка для ботов: людям не видна и недоступна с клавиатуры. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          name="consent"
          type="checkbox"
          required
          aria-invalid={errors.consent?.length ? true : undefined}
          aria-describedby={describedBy("consent")}
          className="mt-0.5 h-5 w-5 shrink-0 accent-amber-500"
        />
        <span>
          {t.consent}
          <FieldError id={`${baseId}-consent-error`} messages={errors.consent} />
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="stage-button w-full sm:w-fit"
      >
        {pending ? t.sending : t.submit}
      </button>
    </form>
  );
}
