// Базовый адрес витрины для абсолютных URL в метаданных, sitemap и robots.
// Переопределяется переменной окружения SITE_URL (например, https://hifistore.example).

export const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
