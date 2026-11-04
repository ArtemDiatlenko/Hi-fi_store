import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderDetailsView } from "@/components/order-details";
import { getOrderByToken } from "@/lib/api";
import { localeHref } from "@/lib/i18n/routing";
import { getI18n } from "@/lib/i18n/server";
import { tpl } from "@/lib/i18n/util";

// Ссылка с токеном открывает заказ без входа, поэтому страницу не индексируем
// и не передаём её адрес в Referer при переходах на другие сайты.
export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return {
    title: dict.order.confirmationTitle,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function OrderConfirmationPage(props: PageProps<"/[lang]/orders/[token]">) {
  const { dict } = await getI18n();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">{dict.order.loading}</p>}>
      <OrderConfirmation params={props.params} />
    </Suspense>
  );
}

async function OrderConfirmation({ params }: { params: Promise<{ token: string }> }) {
  const { locale, dict } = await getI18n();
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) {
    notFound();
  }

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl leading-tight font-light">{tpl(dict.order.thanksTitle, { number: order.number })}</h1>
        <p className="text-zinc-700 dark:text-zinc-300">{tpl(dict.order.managerWillCall, { phone: order.customer.phone })}</p>
        <p className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {dict.order.saveLink}
        </p>
      </header>

      <OrderDetailsView order={order} locale={locale} dict={dict} />

      <Link href={localeHref(locale, "/catalog")} className="w-fit underline">
        {dict.order.backToCatalog}
      </Link>
    </article>
  );
}
