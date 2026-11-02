# Hi-fi Store — витрина (Next.js)

Next.js (App Router) + TypeScript + Tailwind. Данные берутся из ASP.NET Core API (`api/`).

```bash
npm install
npm run dev        # http://localhost:3000, API ожидается на http://localhost:5166 (переменная API_URL)
npm run lint
npm run build
```

Страницы:

- `/catalog` — каталог; фильтры — обычная GET-форма, состояние хранится в адресной строке;
- `/products/[slug]` — карточка товара;
- `/login`, `/register`, `/account` — вход, регистрация и профиль по bearer-токену.

Подробнее о запуске и API — в корневом `README.md`.
