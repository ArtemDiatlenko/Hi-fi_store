"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { clearToken, readToken } from "@/lib/auth";
import { clearCart, useCart } from "@/lib/cart";
import { authHeaders, readProblem } from "@/lib/client-api";
import { formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { localeHref } from "@/lib/i18n/routing";
import { translateServerMessage } from "@/lib/i18n/server-messages";
import { tpl } from "@/lib/i18n/util";
import {
  type CheckoutResponse,
  type DeliveryMethod,
  deliveryMethods,
  type PaymentMethod,
  paymentMethods,
} from "@/lib/orders";
import { useCartQuote } from "@/lib/use-cart-quote";
import { PhoneInput } from "@/components/phone-input";
import { isValidInternationalPhone } from "@/lib/phone";

const FIELDS = ["fullName", "phone", "email", "deliveryMethod", "city", "warehouse", "address", "paymentMethod", "comment"] as const;
type FieldName = (typeof FIELDS)[number];
type FieldErrors = Partial<Record<FieldName, string[]>>;

interface Values {
  fullName: string;
  phone: string;
  email: string;
  deliveryMethod: DeliveryMethod;
  city: string;
  warehouse: string;
  address: string;
  paymentMethod: PaymentMethod;
  comment: string;
}

const INITIAL_VALUES: Values = {
  fullName: "",
  phone: "",
  email: "",
  deliveryMethod: "NovaPoshtaWarehouse",
  city: "",
  warehouse: "",
  address: "",
  paymentMethod: "CashOnDelivery",
  comment: "",
};

/** Ключ ошибки сервера → поле формы. Ошибки позиций (items[0].quantity) показываются у списка товаров. */
function fieldForKey(key: string): FieldName | null {
  const name = key.replace(/^\$\./, "");
  if (name === "cityRef") {
    return "city";
  }
  if (name === "warehouseRef") {
    return "warehouse";
  }
  const normalized = name.charAt(0).toLowerCase() + name.slice(1);
  return (FIELDS as readonly string[]).includes(normalized) ? (normalized as FieldName) : null;
}

function inputId(field: FieldName): string {
  return field === "deliveryMethod" || field === "paymentMethod" ? `checkout-${field}-0` : `checkout-${field}`;
}

interface FormError {
  title: string;
  messages: string[];
}

export function CheckoutForm() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const items = useCart();
  const { quote, fresh, loading, error: quoteError, reload } = useCartQuote(items);
  const [values, setValues] = useState<Values>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [pending, setPending] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Вошедшему пользователю подставляем email и имя из профиля; заказ привяжется к аккаунту по токену.
  useEffect(() => {
    const token = readToken();
    if (!token) {
      return;
    }
    let active = true;
    fetch("/api/account/me", { headers: authHeaders(token) })
      .then(async (response) => {
        if (!active) {
          return;
        }
        if (response.status === 401) {
          clearToken();
          return;
        }
        if (!response.ok) {
          return;
        }
        const me = (await response.json()) as { email: string | null; fullName: string | null; phone: string | null };
        if (!active) {
          return;
        }
        setSignedIn(true);
        setValues((current) => ({
          ...current,
          email: current.email || me.email || "",
          fullName: current.fullName || me.fullName || "",
          phone: current.phone || me.phone || "",
        }));
      })
      .catch(() => {
        // Профиль не загрузился — пользователь заполнит поля сам.
      });
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof Values>(field: K, value: Values[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (field === "deliveryMethod") {
        // Скрытые поля адреса больше не нужны — их ошибки тоже.
        return { ...current, deliveryMethod: undefined, city: undefined, warehouse: undefined, address: undefined };
      }
      return current[field as FieldName] ? { ...current, [field]: undefined } : current;
    });
  }

  function focusFirstProblem(fieldErrors: FieldErrors) {
    const first = FIELDS.find((field) => fieldErrors[field]?.length);
    requestAnimationFrame(() => {
      const target = first ? document.getElementById(inputId(first)) : summaryRef.current;
      target?.focus();
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items || items.length === 0 || pending) {
      return;
    }

    // Длину номера для выбранной страны проверяем сразу: так ошибка видна без запроса к серверу.
    if (values.phone && !isValidInternationalPhone(values.phone)) {
      const fieldErrors: FieldErrors = { phone: [dict.common.phoneInvalid] };
      setErrors(fieldErrors);
      setFormError(null);
      focusFirstProblem(fieldErrors);
      return;
    }

    setPending(true);
    setErrors({});
    setFormError(null);

    const method = values.deliveryMethod;
    const body = {
      items,
      fullName: values.fullName,
      phone: values.phone,
      email: values.email,
      deliveryMethod: method,
      city: method === "Pickup" ? null : values.city,
      warehouse: method === "NovaPoshtaWarehouse" ? values.warehouse : null,
      address: method === "NovaPoshtaCourier" ? values.address : null,
      paymentMethod: values.paymentMethod,
      comment: values.comment,
      // Язык витрины: на нём придут письма о заказе.
      locale,
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });

      if (response.status === 201) {
        const result = (await response.json()) as CheckoutResponse;
        setPlaced(true);
        clearCart();
        router.push(localeHref(locale, `/orders/${encodeURIComponent(result.token)}`));
        return;
      }

      const problem = await readProblem(response);

      if (response.status === 400 && problem.errors) {
        const fieldErrors: FieldErrors = {};
        const other: string[] = [];
        for (const [key, messages] of Object.entries(problem.errors)) {
          const field = fieldForKey(key);
          // Серверные сообщения (рус.) → активная локаль; незнакомое остаётся как есть.
          const localized = messages.map((message) => translateServerMessage(message, locale));
          if (field) {
            fieldErrors[field] = [...(fieldErrors[field] ?? []), ...localized];
          } else {
            other.push(...localized);
          }
        }
        setErrors(fieldErrors);
        setFormError({ title: dict.checkout.errCheckData, messages: other });
        if (other.length > 0) {
          // Ошибки позиций: товар сняли с продажи и т. п. — обновим корзину.
          reload();
        }
        focusFirstProblem(fieldErrors);
        return;
      }

      if (response.status === 409) {
        setFormError({
          title: dict.checkout.errOutOfStockTitle,
          messages: problem.items?.map((item) =>
            tpl(dict.checkout.errOutOfStockLine, {
              name: item.name || dict.cart.productFallback,
              requested: item.requested,
              available: item.available,
            }),
          ) ?? [problem.detail ? translateServerMessage(problem.detail, locale) : dict.checkout.errOutOfStockFallback],
        });
        reload();
        focusFirstProblem({});
        return;
      }

      if (response.status === 401) {
        clearToken();
        setSignedIn(false);
        setFormError({
          title: dict.checkout.errSessionTitle,
          messages: [dict.checkout.errSessionBody],
        });
        focusFirstProblem({});
        return;
      }

      setFormError({ title: dict.checkout.errGenericTitle, messages: [tpl(dict.checkout.errGenericBody, { status: response.status })] });
      focusFirstProblem({});
    } catch {
      setFormError({ title: dict.checkout.errNoConnTitle, messages: [dict.checkout.errNoConnBody] });
      focusFirstProblem({});
    } finally {
      setPending(false);
    }
  }

  if (placed) {
    return (
      <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
        {dict.checkout.placed}
      </p>
    );
  }

  if (items === null) {
    return <p className="text-sm text-zinc-500">{dict.cart.loading}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-[2rem] leading-tight font-light">{dict.checkout.title}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">{dict.checkout.emptyCart}</p>
        <Link href={localeHref(locale, "/catalog")} className="underline">
          {dict.cart.goToCatalog}
        </Link>
      </div>
    );
  }

  const canSubmit = !pending && fresh && quote !== null && quote.canCheckout;
  const method = values.deliveryMethod;
  const deliveryOpts = deliveryMethods.map((value) => ({ value, label: dict.delivery[value].label, hint: dict.delivery[value].hint }));
  const paymentOpts = paymentMethods.map((value) => ({ value, label: dict.payment[value].label, hint: dict.payment[value].hint }));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <form onSubmit={submit} noValidate aria-labelledby="checkout-title" className="flex flex-col gap-6">
        <div>
          <h1 id="checkout-title" className="text-[2rem] leading-tight font-light">
            {dict.checkout.title}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {signedIn ? (
              dict.checkout.signedInNote
            ) : (
              <>
                {dict.checkout.guestNote}
                <Link href={localeHref(locale, "/login")} className="underline">
                  {dict.checkout.loginLink}
                </Link>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{dict.checkout.requiredNote}</p>
        </div>

        {formError ? (
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 outline-none dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            <p className="font-medium">{formError.title}</p>
            {formError.messages.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {formError.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
            {Object.keys(errors).length > 0 ? <p className="mt-2">{dict.checkout.errFixFields}</p> : null}
          </div>
        ) : null}

        <Section title={dict.checkout.contactSection}>
          <TextField
            field="fullName"
            label={dict.checkout.fullName}
            required
            autoComplete="name"
            maxLength={200}
            value={values.fullName}
            error={errors.fullName}
            onChange={(value) => update("fullName", value)}
          />
          <PhoneField
            label={dict.checkout.phone}
            hint={dict.checkout.phoneHint}
            value={values.phone}
            error={errors.phone}
            onChange={(value) => update("phone", value)}
          />
          <TextField
            field="email"
            label={dict.checkout.email}
            type="email"
            required
            autoComplete="email"
            maxLength={254}
            value={values.email}
            error={errors.email}
            onChange={(value) => update("email", value)}
          />
        </Section>

        <ChoiceGroup
          field="deliveryMethod"
          legend={dict.checkout.deliverySection}
          options={deliveryOpts}
          value={values.deliveryMethod}
          error={errors.deliveryMethod}
          onChange={(value) => update("deliveryMethod", value as DeliveryMethod)}
        >
          {method !== "Pickup" ? (
            <TextField
              field="city"
              label={dict.checkout.city}
              required
              autoComplete="address-level2"
              maxLength={200}
              value={values.city}
              error={errors.city}
              onChange={(value) => update("city", value)}
            />
          ) : null}
          {method === "NovaPoshtaWarehouse" ? (
            <TextField
              field="warehouse"
              label={dict.checkout.warehouse}
              required
              maxLength={300}
              hint={dict.checkout.warehouseHint}
              value={values.warehouse}
              error={errors.warehouse}
              onChange={(value) => update("warehouse", value)}
            />
          ) : null}
          {method === "NovaPoshtaCourier" ? (
            <TextField
              field="address"
              label={dict.checkout.address}
              required
              autoComplete="street-address"
              maxLength={500}
              hint={dict.checkout.addressHint}
              value={values.address}
              error={errors.address}
              onChange={(value) => update("address", value)}
            />
          ) : null}
        </ChoiceGroup>

        <ChoiceGroup
          field="paymentMethod"
          legend={dict.checkout.paymentSection}
          options={paymentOpts}
          value={values.paymentMethod}
          error={errors.paymentMethod}
          onChange={(value) => update("paymentMethod", value as PaymentMethod)}
        />

        <Section title={dict.checkout.commentSection}>
          <TextField
            field="comment"
            label={dict.checkout.comment}
            multiline
            maxLength={1000}
            value={values.comment}
            error={errors.comment}
            onChange={(value) => update("comment", value)}
          />
        </Section>

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="stage-button w-full sm:w-fit"
          >
            {pending ? dict.checkout.submitting : dict.checkout.submit}
          </button>
          <p className="text-xs text-zinc-500">{dict.checkout.paymentNote}</p>
        </div>
      </form>

      <aside aria-labelledby="checkout-summary-title" className="flex h-fit flex-col gap-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800 lg:sticky lg:top-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="checkout-summary-title" className="text-2xl leading-tight font-normal">
            {dict.checkout.summaryTitle}
          </h2>
          <Link href={localeHref(locale, "/cart")} className="text-sm underline">
            {dict.checkout.edit}
          </Link>
        </div>

        {quoteError ? (
          <div role="alert" className="text-sm text-red-700 dark:text-red-400">
            {quoteError}{" "}
            <button type="button" onClick={reload} className="underline">
              {dict.common.retry}
            </button>
          </div>
        ) : null}

        {quote ? (
          <ul aria-busy={loading} className={`flex flex-col gap-3 text-sm ${loading ? "opacity-70" : ""}`}>
            {quote.items.map((line) => (
              <li key={line.productId} className="flex justify-between gap-4">
                <span>
                  {line.name ?? dict.cart.productUnavailable} <span className="text-zinc-500">× {line.quantity}</span>
                  {line.status === "InsufficientStock" ? (
                    <span className="block text-red-700 dark:text-red-400">{tpl(dict.checkout.onlyNLeftShort, { count: line.availableStock })}</span>
                  ) : null}
                  {line.status === "Unavailable" ? (
                    <span className="block text-red-700 dark:text-red-400">{dict.checkout.noLongerSold}</span>
                  ) : null}
                </span>
                <span className="shrink-0 font-medium">{line.unitPrice !== null ? formatPrice(line.lineTotal, locale) : "—"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">{dict.checkout.recalculating}</p>
        )}

        {quote ? (
          <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3 text-base dark:border-zinc-800">
            <span className="font-medium">{dict.checkout.total}</span>
            <span className="font-semibold" aria-live="polite">
              {formatPrice(quote.total, locale)}
            </span>
          </div>
        ) : null}
        <p className="text-xs text-zinc-500">{dict.common.deliveryNotIncluded}</p>

        {fresh && quote && !quote.canCheckout ? (
          <p className="text-sm text-red-700 dark:text-red-400">
            {dict.checkout.missingItems}
            <Link href={localeHref(locale, "/cart")} className="underline">
              {dict.checkout.fixCart}
            </Link>
            {dict.checkout.missingItemsTail}
          </p>
        ) : null}
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 text-lg font-medium">{title}</legend>
      {children}
    </fieldset>
  );
}

interface TextFieldProps {
  field: FieldName;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string[];
  hint?: string;
  type?: "text" | "tel" | "email";
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  multiline?: boolean;
}

function TextField({
  field,
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  autoComplete,
  placeholder,
  maxLength,
  required,
  multiline,
}: TextFieldProps) {
  const id = inputId(field);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error?.length ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  const className = `min-h-11 rounded-md border px-3 py-2 text-base dark:bg-zinc-900 ${
    errorId ? "border-red-600 dark:border-red-500" : "border-zinc-300 dark:border-zinc-700"
  }`;

  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-red-600">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {multiline ? (
        <textarea
          id={id}
          name={field}
          rows={3}
          value={value}
          maxLength={maxLength}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      ) : (
        <input
          id={id}
          name={field}
          type={type}
          value={value}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      )}
      {errorId ? (
        <p id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {error!.join(" ")}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Телефон с кодом страны: та же разметка подписи, ошибки и подсказки, что у TextField. */
function PhoneField({
  label,
  hint,
  value,
  error,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  error?: string[];
  onChange: (value: string) => void;
}) {
  const { locale, dict } = useI18n();
  const id = inputId("phone");
  const hintId = `${id}-hint`;
  const errorId = error?.length ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
        <span aria-hidden="true" className="text-red-600">
          {" "}
          *
        </span>
      </label>
      <PhoneInput
        id={id}
        locale={locale}
        countryLabel={dict.common.phoneCountry}
        value={value}
        onChange={onChange}
        required
        invalid={!!errorId}
        describedBy={[errorId, hintId].filter(Boolean).join(" ")}
      />
      {errorId ? (
        <p id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {error!.join(" ")}
        </p>
      ) : null}
      <p id={hintId} className="text-xs text-zinc-500">
        {hint}
      </p>
    </div>
  );
}

interface ChoiceGroupProps {
  field: "deliveryMethod" | "paymentMethod";
  legend: string;
  options: { value: string; label: string; hint: string }[];
  value: string;
  onChange: (value: string) => void;
  error?: string[];
  children?: ReactNode;
}

function ChoiceGroup({ field, legend, options, value, onChange, error, children }: ChoiceGroupProps) {
  const errorId = error?.length ? `checkout-${field}-error` : undefined;

  return (
    <fieldset className="flex flex-col gap-4" aria-describedby={errorId}>
      <legend className="mb-1 text-lg font-medium">
        {legend}
        <span aria-hidden="true" className="text-base text-red-600">
          {" "}
          *
        </span>
      </legend>
      {errorId ? (
        <p id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {error!.join(" ")}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {options.map((option, index) => {
          const id = `checkout-${field}-${index}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                value === option.value ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              <input
                id={id}
                type="radio"
                name={field}
                value={option.value}
                checked={value === option.value}
                aria-describedby={`${id}-hint`}
                onChange={() => onChange(option.value)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{option.label}</span>
                <span id={`${id}-hint`} className="block text-zinc-500">
                  {option.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {children}
    </fieldset>
  );
}
