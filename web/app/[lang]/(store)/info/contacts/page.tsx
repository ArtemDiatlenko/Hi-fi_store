import type { Metadata } from "next";
import { InfoPage, infoPath } from "@/components/info-page";
import { getI18n } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, dict } = await getI18n();
  const { title, description } = dict.info.contacts;
  return pageMetadata({ title, description, path: infoPath("contacts"), locale });
}

export default function ContactsInfoPage() {
  return <InfoPage page="contacts" />;
}
