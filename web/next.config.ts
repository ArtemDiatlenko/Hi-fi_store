import type { NextConfig } from "next";

// Адрес ASP.NET Core API. Браузер ходит на /api/* того же origin, Next проксирует запросы дальше.
const apiUrl = process.env.API_URL ?? "http://localhost:5166";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Демо-изображения товаров. Для реальных фото добавьте домен хранилища сюда.
    remotePatterns: [{ protocol: "https", hostname: "placehold.co" }],
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
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
