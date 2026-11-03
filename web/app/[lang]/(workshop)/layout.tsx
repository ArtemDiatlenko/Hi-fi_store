import type { ReactNode } from "react";
import { WorkshopChrome } from "@/components/workshop/chrome";

// Pilot layout for the home page; other storefront routes keep their current layout.
export default function WorkshopLayout({ children }: { children: ReactNode }) {
  return <WorkshopChrome>{children}</WorkshopChrome>;
}
