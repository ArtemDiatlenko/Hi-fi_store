"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

/** Адрес, который сервер примет как изображение: http(s) или путь от корня сайта (как IsValidImageUrl в API). */
export function isPreviewableUrl(url: string): boolean {
  const value = url.trim();
  if (value.startsWith("/")) {
    return !value.startsWith("//");
  }
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host.length > 0;
  } catch {
    return false;
  }
}

/**
 * Миниатюра изображения товара. Обычный <img>, а не next/image: в админке показываются произвольные
 * адреса, которые вводит администратор (в том числе ещё не добавленные в images.remotePatterns).
 */
export function AdminThumb({ url, alt, size = "sm" }: { url: string | null; alt: string; size?: "sm" | "lg" }) {
  const { dict } = useI18n();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const box = size === "lg" ? "h-24 w-32" : "h-12 w-16";
  const usable = url !== null && isPreviewableUrl(url);

  if (!usable || failedUrl === url) {
    return (
      <span
        className={`${box} flex shrink-0 items-center justify-center rounded-md bg-zinc-100 px-1 text-center text-[10px] leading-tight text-zinc-500 dark:bg-zinc-800`}
      >
        {url && failedUrl === url ? dict.admin.images.previewError : size === "lg" ? dict.admin.images.noPreview : dict.admin.products.noImage}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- произвольный адрес из админки, см. комментарий выше
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailedUrl(url)}
      className={`${box} shrink-0 rounded-md bg-zinc-100 object-cover dark:bg-zinc-800`}
    />
  );
}
