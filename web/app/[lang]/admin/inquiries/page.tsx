import type { Metadata } from "next";
import { Suspense } from "react";
import { InquiryList } from "@/components/admin/inquiry-list";
import { getI18n } from "@/lib/i18n/server";

// AdminShell renders children only after the browser checks the session.
// Next cannot validate this page's instant shell while that gate is closed.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.admin.inquiries.title };
}

export default async function AdminInquiriesPage() {
  const { dict } = await getI18n();
  return <Suspense fallback={<p role="status">{dict.admin.common.loading}</p>}><InquiryList /></Suspense>;
}
