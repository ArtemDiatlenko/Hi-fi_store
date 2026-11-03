# Hi-fi_store

Интернет-магазин hi-fi техники: усилители, акустика, проигрыватели, кабели.

## Стек

- **Бэкенд:** ASP.NET Core Web API на .NET 10, EF Core, PostgreSQL, ASP.NET Core Identity.
- **Фронт:** Next.js (App Router) + TypeScript + Tailwind (папка `web/`).

## Структура

```
api/
  HiFiStore.slnx
  src/
    HiFiStore.Api/             контроллеры (витрина, аккаунт, админка), разбор фильтров, Program.cs
    HiFiStore.Domain/          сущности каталога
    HiFiStore.Infrastructure/  EF Core, миграции, сервисы каталога и админки, Identity-инициализация, тестовые данные
  tests/
    HiFiStore.Tests/           unit- и интеграционные тесты
web/                           витрина на Next.js (каталог с фильтрами, карточка товара, вход/регистрация)
docker-compose.yml             PostgreSQL для локальной разработки
```

## Локальный запуск

Нужны .NET 10 SDK, Node.js 20+ и Docker.

```bash
docker compose up -d                      # PostgreSQL на localhost:5432 (postgres/postgres, БД hifistore)

cd api
export ConnectionStrings__Store='Host=localhost;Port=5432;Database=hifistore;Username=postgres;Password=postgres'
export Seed__Admin__Email='admin@example.local'      # необязательно: создаёт администратора
export Seed__Admin__Password='<пароль для локальной разработки>'
dotnet run --project src/HiFiStore.Api    # в Development миграции применяются и заполняется демо-каталог
```

API слушает `http://localhost:5166`, OpenAPI-описание доступно в Development по `/openapi/v1.json`.

Пароли и строку подключения задавайте через переменные окружения или `dotnet user-secrets`,
а не в `appsettings*.json`. Значения из примера годятся только для локальной разработки.

### Фронт

```bash
cd web
npm install
npm run dev                               # http://localhost:3000
```

Запросы `/api/*` Next проксирует на API. Адрес меняется переменной `API_URL` (по умолчанию `http://localhost:5166`).

## Миграции

Миграции лежат в `api/src/HiFiStore.Infrastructure/Persistence/Migrations`. В Development они
применяются при старте (`Store:AutoMigrate`). Новую миграцию добавляйте так:

```bash
cd api
dotnet tool restore
dotnet ef migrations add <Имя> --project src/HiFiStore.Infrastructure --startup-project src/HiFiStore.Api --output-dir Persistence/Migrations
```

Строка подключения для `dotnet ef` берётся из `ConnectionStrings__Store`, как и при запуске.

## Тесты

```bash
cd api
dotnet test                                                       # unit-тесты: разбор фильтров, slug
HIFISTORE_TEST_CONNECTION='Host=localhost;Port=5432;Database=hifistore_test;Username=postgres;Password=postgres' \
  dotnet test                                                     # + интеграционные тесты с PostgreSQL
```

Интеграционные тесты пересоздают базу из `HIFISTORE_TEST_CONNECTION` и заполняют её демо-каталогом.
Без этой переменной они пропускаются, а не проходят молча. Используйте отдельную базу, не рабочую.

## API

| Метод и путь | Описание |
| --- | --- |
| `GET /api/catalog/categories` | Дерево разделов |
| `GET /api/catalog/products` | Товары с фильтрами, сортировкой и пагинацией |
| `GET /api/catalog/products/{slug}` | Карточка опубликованного товара |
| `GET /api/catalog/facets?category=` | Значения и диапазоны для построения фильтров |
| `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh` | Identity: регистрация и вход по bearer-токену; новый пользователь получает роль `Customer` |
| `GET /api/account/me` | Текущий пользователь и роли (нужен токен) |
| `/api/admin/...` | Управление каталогом, только для роли `Admin` — см. [ниже](#административный-api) |

Параметры списка товаров:

- `category` — slug раздела, включает вложенные разделы;
- `brand`, `condition` (`new`, `used`, `demo`) — несколько значений через запятую или повтором параметра;
- `minPrice`, `maxPrice`, `inStock=true`, `q` — цена, наличие, поиск по названию;
- `spec.{key}=значение` — текстовая характеристика (несколько значений — ИЛИ);
- `spec.{key}=true|false` — логическая характеристика;
- `spec.{key}.min`, `spec.{key}.max` — диапазон числовой характеристики;
- `sort` — `newest` (по умолчанию), `price_asc`, `price_desc`, `name`;
- `page`, `pageSize` (1–100, по умолчанию 20).

Некорректные параметры возвращают `400` с описанием ошибок по именам параметров.
Пустые значения (например, незаполненное поле формы) игнорируются.

### Административный API

Нужен bearer-токен пользователя с ролью `Admin` (`POST /api/auth/login`): без токена — `401`, с токеном без роли — `403`.

| Метод и путь | Описание |
| --- | --- |
| `GET /api/admin/brands`, `GET /api/admin/brands/{id}` | Бренды с числом товаров |
| `POST /api/admin/brands`, `PUT /api/admin/brands/{id}`, `DELETE /api/admin/brands/{id}` | Создание, изменение, удаление бренда |
| `GET /api/admin/categories` | Плоский список разделов с `parentId` в порядке обхода дерева |
| `GET /api/admin/categories/{id}` | Раздел с его характеристиками |
| `POST /api/admin/categories`, `PUT /api/admin/categories/{id}`, `DELETE /api/admin/categories/{id}` | Создание, изменение и перенос раздела (`parentId`), удаление |
| `POST /api/admin/categories/{id}/specs` | Добавить характеристику: `key`, `name`, `unit`, `valueType` (`Text`, `Number`, `Boolean`), `isFilterable`, `sortOrder` |
| `GET`, `PUT`, `DELETE /api/admin/categories/{id}/specs/{specId}` | Получить, изменить, удалить характеристику |
| `GET /api/admin/products` | Товары, включая неопубликованные: `q` (название или артикул), `categoryId` (с подразделами), `brandId`, `published`, `page`, `pageSize` |
| `GET /api/admin/products/{id}` | Товар с характеристиками, изображениями и списком доступных ему характеристик |
| `POST /api/admin/products`, `PUT /api/admin/products/{id}`, `DELETE /api/admin/products/{id}` | Создание (неопубликованным), изменение, удаление товара |
| `PUT /api/admin/products/{id}/specs` | Заменить характеристики: `{"specs": {"power_w": 80, "bluetooth": true}}` |
| `PUT /api/admin/products/{id}/images` | Заменить изображения: `{"images": [{"url": "...", "alt": "..."}]}`, порядок сохраняется |
| `POST /api/admin/products/{id}/publish`, `POST /api/admin/products/{id}/unpublish` | Показать товар на витрине или скрыть |

Правила и ошибки:

- slug — строчные латинские буквы, цифры и дефисы. Если его не передать, при создании он формируется из названия
  (кириллица транслитерируется: «Кварц Вращение 1» → `kvarts-vrashchenie-1`), а при изменении остаётся прежним;
- цена и остаток не отрицательные, старая цена (если задана) больше текущей;
- ключ характеристики товара должен принадлежать разделу товара или его предкам, значение — подходить по типу.
  Ключи уникальны в ветке каталога (раздел, его предки и подразделы). При смене раздела у товара удаляются
  значения характеристик, которых нет у нового раздела;
- `400` — ошибки по полям (`errors.price`, `errors["specs.power_w"]`, `errors["images[0].url"]`), в том числе перенос
  раздела в самого себя или в свой подраздел;
- `409` — занятый slug или артикул; удаление бренда с товарами или раздела с подразделами или товарами; перенос раздела,
  после которого ключи характеристик в ветке повторяются; смена типа характеристики, у которой уже есть значения.

## Известные ограничения

- Роль `Admin` выдаётся только при создании администратора из настроек `Seed:Admin`: эндпоинтов для управления
  пользователями и ролями нет. Роли попадают в bearer-токен при выдаче, поэтому изменение ролей вступает в силу
  после повторного входа или `POST /api/auth/refresh`.
- Интерфейса администратора во фронте пока нет — каталогом управляют через `/api/admin`.
- На карточке товара для несуществующего slug страница показывает «не найдено», но HTTP-статус 200:
  при потоковом рендеринге (Cache Components) статус уже отправлен к моменту `notFound()`.
- Токен входа в фронте хранится в `localStorage` — для демо. Для продакшена лучше httpOnly-cookie.
