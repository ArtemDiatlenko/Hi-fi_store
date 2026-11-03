import type { Metadata } from "next";
import { Suspense } from "react";
import { InquiryView } from "@/components/admin/inquiry-view";
import { getI18n } from "@/lib/i18n/server";

// AdminShell renders children only after the browser checks the session.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.admin.inquiries.title };
}

export default async function AdminInquiryPage(props: PageProps<"/[lang]/admin/inquiry/[id]">) {
  const { dict } = await getI18n();
  return <Suspense fallback={<p role="status">{dict.admin.common.loading}</p>}><InquiryView params={props.params} /></Suspense>;
}
