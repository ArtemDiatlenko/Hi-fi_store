import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderDetailsView } from "@/components/order-details";
import { getOrderByToken } from "@/lib/api";

// Ссылка с токеном открывает заказ без входа, поэтому страницу не индексируем
// и не передаём её адрес в Referer при переходах на другие сайты.
export const metadata: Metadata = {
  title: "Заказ оформлен",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function OrderConfirmationPage(props: PageProps<"/orders/[token]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Загрузка заказа…</p>}>
      <OrderConfirmation params={props.params} />
    </Suspense>
  );
}

async function OrderConfirmation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) {
    notFound();
  }

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">Спасибо! Заказ №{order.number} оформлен</h1>
        <p className="text-zinc-700 dark:text-zinc-300">
          Менеджер позвонит по номеру {order.customer.phone}, чтобы подтвердить наличие и доставку.
        </p>
        <p className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          Сохраните ссылку на эту страницу: по ней можно проверить статус заказа без входа в аккаунт.
          Не пересылайте её посторонним — на странице есть ваши контактные данные.
        </p>
      </header>

      <OrderDetailsView order={order} />

      <Link href="/catalog" className="w-fit underline">
        Вернуться в каталог
      </Link>
    </article>
  );
}
