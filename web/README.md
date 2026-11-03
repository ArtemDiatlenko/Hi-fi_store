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
- `/account/orders`, `/account/orders/[id]` — заказы покупателя;
- `/admin` — админ-панель (только для роли `Admin`, `noindex`): обзор, товары (`/admin/products`, `/admin/product/new`,
  `/admin/product/[id]` — основные поля, характеристики, изображения, публикация), разделы с характеристиками
  (`/admin/categories`, `/admin/category/[id]`), бренды (`/admin/brands`), заказы (`/admin/orders`, `/admin/order/[id]`).
  Страницы записей — в единственном числе: `/admin/products/[id]` совпадал бы по форме с витринным
  `/[lang]/products/[slug]`, и предзагрузка Next угадывала бы не тот маршрут (подробнее — в `app/[lang]/admin/layout.tsx`).

Подробнее о запуске и API — в корневом `README.md`.
