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
- `/products/[slug]` — карточка товара с кнопкой «В корзину»;
- `/cart` — корзина (хранится в `localStorage`, цены пересчитываются через API);
- `/checkout` — оформление заказа, гостем или после входа;
- `/orders/[token]` — страница подтверждения заказа по публичному токену;
- `/login`, `/register`, `/account` — вход, регистрация и профиль по bearer-токену;
- `/account/orders`, `/account/orders/[id]` — заказы покупателя.

Подробнее о запуске и API — в корневом `README.md`.
