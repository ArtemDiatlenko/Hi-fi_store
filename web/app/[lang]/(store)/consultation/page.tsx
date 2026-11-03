import type { Metadata } from "next";
import { Suspense } from "react";
import { ConsultationForm } from "@/components/consultation-form";
import { HeadsetIcon } from "@/components/icons";
import { getI18n } from "@/lib/i18n/server";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, dict } = await getI18n();
  return {
    title: dict.consultation.title,
    description: dict.consultation.metaDescription,
    alternates: localizedAlternates("/consultation", locale),
  };
}

// Параметры ?product= и ?topic= читает форма в браузере — она внутри Suspense.
export default async function ConsultationPage() {
  const { dict } = await getI18n();
  const t = dict.consultation;
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
      <div className="flex flex-col gap-5">
        <span aria-hidden="true" className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-amber-400 dark:bg-amber-400/15 dark:text-amber-300">
          <HeadsetIcon className="h-6 w-6" />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.title}</h1>
        <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">{t.lead}</p>
        <ul className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          {t.points.map((point) => (
            <li key={point} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-3xl border border-zinc-200 p-5 sm:p-8 dark:border-zinc-800">
        <Suspense fallback={<p className="text-sm text-zinc-500">{dict.common.loading}</p>}>
          <ConsultationForm />
        </Suspense>
      </div>
    </div>
  );
}
