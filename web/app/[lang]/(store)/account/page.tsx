import type { Metadata } from "next";
import { AccountView } from "@/components/account-view";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.account.title };
}

export default function AccountPage() {
  return <AccountView />;
}
