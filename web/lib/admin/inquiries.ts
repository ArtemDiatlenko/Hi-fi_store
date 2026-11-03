export const inquiryStatuses = ["New", "InProgress", "Closed", "Spam"] as const;
export type InquiryStatus = (typeof inquiryStatuses)[number];
export type InquiryTopic = "Selection" | "CustomBuild" | "Product" | "Service" | "Other";
export type ContactMethod = "Phone" | "Telegram" | "Viber" | "Email";

export interface AdminInquirySummary {
  id: string;
  number: number;
  topic: InquiryTopic;
  status: InquiryStatus;
  name: string;
  phone: string | null;
  email: string | null;
  preferredContact: ContactMethod;
  messagePreview: string;
  productName: string | null;
  createdAt: string;
}

export interface AdminInquiryDetails extends Omit<AdminInquirySummary, "messagePreview"> {
  message: string;
  budget: string | null;
  productId: string | null;
  productSlug: string | null;
  userId: string | null;
  adminNote: string | null;
  updatedAt: string;
}
