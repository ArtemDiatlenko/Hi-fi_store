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
    HiFiStore.Api/             контроллеры, разбор фильтров, Program.cs
    HiFiStore.Domain/          сущности каталога
    HiFiStore.Infrastructure/  EF Core, миграции, сервис каталога, Identity-инициализация, тестовые данные
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
dotnet test                                                       # unit-тесты разбора фильтров
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
| `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh` | Identity: регистрация и вход по bearer-токену |
| `GET /api/account/me` | Текущий пользователь и роли (нужен токен) |

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

## Известные ограничения

- Пользователь, зарегистрированный через `/api/auth/register`, пока не получает роль `Customer`:
  стандартный эндпоинт Identity её не назначает. Нужен свой обработчик регистрации или событие после создания.
- Административных эндпоинтов (создание и редактирование товаров) пока нет; роль `Admin` выдаётся только при создании
  администратора из настроек `Seed:Admin`.
- На карточке товара для несуществующего slug страница показывает «не найдено», но HTTP-статус 200:
  при потоковом рендеринге (Cache Components) статус уже отправлен к моменту `notFound()`.
- Токен входа в фронте хранится в `localStorage` — для демо. Для продакшена лучше httpOnly-cookie.
