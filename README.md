# Hi-fi_store

Интернет-магазин hi-fi техники: усилители, акустика, проигрыватели, кабели.

## Стек

- **Бэкенд:** ASP.NET Core Web API на .NET 10, EF Core, PostgreSQL, ASP.NET Core Identity.
- **Фронт:** Next.js + TypeScript + Tailwind (папка `web/`, пока не создана).

## Структура

```
api/
  HiFiStore.slnx
  src/
    HiFiStore.Api/             контроллеры, Program.cs
    HiFiStore.Domain/          сущности каталога
    HiFiStore.Infrastructure/  EF Core, Identity
  tests/
    HiFiStore.Tests/
docker-compose.yml             PostgreSQL для локальной разработки
```

## Локальный запуск

Нужны .NET 10 SDK и Docker.

```bash
docker compose up -d          # PostgreSQL на localhost:5432 (postgres/postgres, БД hifistore)
cd api
dotnet tool restore           # dotnet-ef
dotnet build
```

Пароль `postgres` годится только для локальной разработки. Для сервера строку подключения
задавайте через переменную окружения `ConnectionStrings__Store` или `dotnet user-secrets`,
а не в `appsettings.json`.
