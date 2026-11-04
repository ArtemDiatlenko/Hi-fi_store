import type { NextConfig } from "next";
import { REMOTE_IMAGE_HOSTS } from "./lib/image-hosts";

// Адрес ASP.NET Core API. Браузер ходит на /api/* того же origin, Next проксирует запросы дальше.
const apiUrl = process.env.API_URL ?? "http://localhost:5166";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Демо-изображения товаров. Для реальных фото добавьте домен хранилища в lib/image-hosts.ts.
    remotePatterns: REMOTE_IMAGE_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname })),
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
      // Загруженные фото товаров: API отдаёт их из хранилища (диск или S3), адрес в базе от хранилища не зависит.
      { source: "/media/:path*", destination: `${apiUrl}/media/:path*` },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
