// Разбор неуспешного ответа API для форм админки: ошибки по полям (400), конфликт (409) рядом с полем
// и в сводке, прочие ошибки — в сводке. Тексты сервера проходят через lib/i18n/server-messages.

import type { FormProblem } from "@/components/admin/ui";
import { type ApiFailure, conflictField, type FieldErrors, problemMessage, splitFieldErrors } from "@/lib/admin/api";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { tpl } from "@/lib/i18n/util";

export interface FailureView {
  fields: FieldErrors;
  problem: FormProblem;
}

/**
 * <c>mapKey</c> переводит ключ ошибки сервера в ключ поля формы (null — ошибка не относится к полю);
 * <c>conflictKeys</c> — поля формы, к которым можно привязать конфликт 409 (slug, sku).
 */
export function describeFailure(
  failure: ApiFailure,
  locale: Locale,
  dict: Dictionary,
  mapKey: (key: string) => string | null,
  conflictKeys: string[] = [],
): FailureView {
  const common = dict.admin.common;

  if (failure.status === 400 && failure.problem.errors) {
    const { fields, other } = splitFieldErrors(failure.problem, locale, mapKey);
    return {
      fields,
      problem: { title: common.errorTitle, messages: other, hasFieldErrors: Object.keys(fields).length > 0 },
    };
  }

  if (failure.status === 409) {
    const message = problemMessage(failure.problem, locale) ?? common.conflictTitle;
    const field = conflictField(failure.problem);
    const fields: FieldErrors = field && conflictKeys.includes(field) ? { [field]: [message] } : {};
    return { fields, problem: { title: common.conflictTitle, messages: [message] } };
  }

  if (failure.status === 404) {
    return { fields: {}, problem: { title: common.errorTitle, messages: [common.notFound] } };
  }

  if (failure.status === 0) {
    return { fields: {}, problem: { title: common.errorTitle, messages: [common.noConnection] } };
  }

  const detail = problemMessage(failure.problem, locale);
  return {
    fields: {},
    problem: { title: common.errorTitle, messages: [detail ?? tpl(common.genericError, { status: failure.status })] },
  };
}

/** Ключ сервера совпадает с именем поля формы (camelCase), если поле есть в списке. */
export function directKeys(fields: readonly string[]): (key: string) => string | null {
  return (key) => {
    const normalized = key.charAt(0).toLowerCase() + key.slice(1);
    return fields.includes(normalized) ? normalized : null;
  };
}
