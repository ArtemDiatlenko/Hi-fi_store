"use client";

// Телефон с выбором страны: код страны из списка + номер. Наружу (в value/onChange и в скрытое поле name)
// уходит номер в международном формате E.164 (+380671234567) — так его хранит и проверяет API.
// Номер, вставленный целиком с «+» (+48 512 345 678), сам переключает страну.

import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { useHydrated } from "@/lib/use-hydrated";

const DEFAULT_COUNTRY: CountryCode = "UA";

/** Флаг страны из двух букв ISO-кода (региональные символы Unicode). */
function flag(country: string): string {
  return String.fromCodePoint(...[...country].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

/** Разбирает сохранённый номер (E.164) на страну и национальную часть; иначе — страна по умолчанию. */
function split(value: string): { country: CountryCode; national: string } {
  const parsed = value.startsWith("+") ? parsePhoneNumberFromString(value) : undefined;
  if (parsed?.country) {
    return { country: parsed.country, national: parsed.formatNational() };
  }
  return { country: DEFAULT_COUNTRY, national: value };
}

/**
 * Международный номер из страны и введённого номера; пустая строка, если цифр нет. Национальный префикс
 * (0 в «067…» для Украины) убирает libphonenumber по правилам страны — там, где ноль часть номера, он остаётся.
 */
function compose(country: CountryCode, national: string): string {
  const digits = national.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  return parsePhoneNumberFromString(national, country)?.number ?? `+${getCountryCallingCode(country)}${digits}`;
}

interface Props {
  /** id поля номера — для <label htmlFor>. */
  id: string;
  locale: Locale;
  /** Подпись выпадающего списка для скринридера: «Код країни». */
  countryLabel: string;
  /** Управляемый режим. */
  value?: string;
  onChange?: (value: string) => void;
  /** Неуправляемый режим: начальное значение и имя скрытого поля формы. */
  defaultValue?: string;
  name?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

export function PhoneInput({
  id,
  locale,
  countryLabel,
  value,
  onChange,
  defaultValue = "",
  name,
  required,
  invalid,
  describedBy,
  className = "",
}: Props) {
  const initial = value ?? defaultValue;
  const [country, setCountry] = useState<CountryCode>(() => split(initial).country);
  const [national, setNational] = useState(() => split(initial).national);
  const selectId = useId();
  // Последнее отданное наружу значение: чтобы отличать «родитель подставил номер» от собственного ввода.
  const emitted = useRef(compose(country, national));

  const external = value ?? defaultValue;
  useEffect(() => {
    if (external !== emitted.current) {
      const next = split(external);
      setCountry(next.country);
      setNational(next.national);
      emitted.current = compose(next.country, next.national) || external;
    }
  }, [external]);

  // Названия стран дают ICU-данные среды: в Node и в браузере они расходятся («Гонконг» / «Гонконг, ОАР Китаю»).
  // До гидратации в списке только выбранная страна без названия — разметка сервера и клиента совпадает.
  const hydrated = useHydrated();
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([locale === "uk" ? "uk" : "en"], { type: "region" });
    return getCountries()
      .map((code) => ({ code, name: names.of(code) ?? code, dial: getCountryCallingCode(code) }))
      .sort((a, b) => (a.code === DEFAULT_COUNTRY ? -1 : b.code === DEFAULT_COUNTRY ? 1 : a.name.localeCompare(b.name, locale)));
  }, [locale]);

  function emit(nextCountry: CountryCode, nextNational: string) {
    const composed = compose(nextCountry, nextNational);
    emitted.current = composed;
    onChange?.(composed);
  }

  function changeNumber(text: string) {
    // Номер вставили целиком с кодом страны — берём страну из него.
    if (text.trim().startsWith("+")) {
      const parsed = parsePhoneNumberFromString(text);
      if (parsed?.country) {
        setCountry(parsed.country);
        setNational(parsed.formatNational());
        emit(parsed.country, parsed.nationalNumber);
        return;
      }
    }
    setNational(text);
    emit(country, text);
  }

  function changeCountry(next: CountryCode) {
    setCountry(next);
    emit(next, national);
  }

  const border = invalid ? "border-red-600 dark:border-red-500" : "border-zinc-300 dark:border-zinc-700";

  return (
    <div className={`flex min-h-11 items-stretch rounded-md border focus-within:border-amber-400 dark:bg-zinc-900 ${border} ${className}`}>
      {/* Видимая часть — флаг и код; сам список прозрачный поверх неё, чтобы на телефоне открывался системный. */}
      <div className="relative flex shrink-0 items-center gap-1 border-r border-inherit px-3 text-base">
        <span aria-hidden="true">{flag(country)}</span>
        <span aria-hidden="true" className="tabular-nums">+{getCountryCallingCode(country)}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 text-zinc-500" fill="currentColor">
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
        <select
          id={selectId}
          aria-label={countryLabel}
          value={country}
          onChange={(event) => changeCountry(event.target.value as CountryCode)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {hydrated ? (
            countries.map((item) => (
              <option key={item.code} value={item.code}>
                {`${flag(item.code)} ${item.name} (+${item.dial})`}
              </option>
            ))
          ) : (
            <option value={country}>{`${flag(country)} +${getCountryCallingCode(country)}`}</option>
          )}
        </select>
      </div>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        required={required}
        value={national}
        maxLength={24}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => changeNumber(event.target.value)}
        className="min-w-0 flex-1 rounded-r-md bg-transparent px-3 py-2 text-base outline-none"
      />
      {name ? <input type="hidden" name={name} value={compose(country, national)} /> : null}
    </div>
  );
}
