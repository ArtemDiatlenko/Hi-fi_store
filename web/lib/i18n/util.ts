// Небольшие помощники локализации без зависимостей от Next — работают и на сервере, и в браузере.

import { intlLocale, type Locale } from "@/lib/i18n/config";

export type TemplateVars = Record<string, string | number>;

/** Подстановка в шаблон: tpl("Найдено: {count}", { count: 5 }) → "Найдено: 5". */
export function tpl(template: string, vars?: TemplateVars): string {
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match,
  );
}

type PluralForms = { one: string; few: string; many: string; other: string };

const pluralRulesCache: Partial<Record<Locale, Intl.PluralRules>> = {};

function pluralRules(locale: Locale): Intl.PluralRules {
  return (pluralRulesCache[locale] ??= new Intl.PluralRules(intlLocale[locale]));
}

/** Возвращает правильную форму слова для числа по правилам локали. */
export function pluralWord(locale: Locale, count: number, forms: PluralForms): string {
  const category = pluralRules(locale).select(count);
  return forms[category as keyof PluralForms] ?? forms.other;
}
