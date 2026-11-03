using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HiFiStore.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Создаёт роли Admin и Customer с постоянными идентификаторами (данные модели — RoleConfiguration).
    /// <para>
    /// Вместо сгенерированного InsertData — идемпотентный SQL: до этой миграции роли создавал инициализатор
    /// при старте со случайными Id, и простая вставка упала бы на уникальном индексе RoleNameIndex.
    /// Такая роль переводится на постоянный Id вместе со связями с пользователями и claims.
    /// </para>
    /// <para>Значения записаны литералами, чтобы миграция не менялась вместе с кодом.</para>
    /// </summary>
    public partial class SeedIdentityRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            SeedRole(migrationBuilder, "0f28c48c-f65b-4e25-8292-eaf4e9285790", "Admin", "ADMIN", "d8b99957-9655-4730-b553-707100fd977d");
            SeedRole(migrationBuilder, "32f3d72f-e6ce-4221-bac3-23e76e877509", "Customer", "CUSTOMER", "8a50ba08-d637-481c-a5d4-485633aeaa95");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Роли не удаляются: удаление каскадно сняло бы их с пользователей, а приложение без ролей не работает.
        }

        private static void SeedRole(MigrationBuilder migrationBuilder, string id, string name, string normalizedName, string stamp)
        {
            var legacyName = normalizedName + "#LEGACY";

            // Освободить имя у роли, созданной раньше с другим Id.
            migrationBuilder.Sql($"""
                UPDATE "AspNetRoles" SET "NormalizedName" = '{legacyName}'
                WHERE "NormalizedName" = '{normalizedName}' AND "Id" <> '{id}';
                """);

            migrationBuilder.Sql($"""
                INSERT INTO "AspNetRoles" ("Id", "Name", "NormalizedName", "ConcurrencyStamp")
                VALUES ('{id}', '{name}', '{normalizedName}', '{stamp}')
                ON CONFLICT ("Id") DO NOTHING;
                """);

            // Перенести пользователей и claims прежней роли на постоянную и удалить прежнюю.
            migrationBuilder.Sql($"""
                UPDATE "AspNetUserRoles" SET "RoleId" = '{id}'
                WHERE "RoleId" IN (SELECT "Id" FROM "AspNetRoles" WHERE "NormalizedName" = '{legacyName}');
                """);

            migrationBuilder.Sql($"""
                UPDATE "AspNetRoleClaims" SET "RoleId" = '{id}'
                WHERE "RoleId" IN (SELECT "Id" FROM "AspNetRoles" WHERE "NormalizedName" = '{legacyName}');
                """);

            migrationBuilder.Sql($"""
                DELETE FROM "AspNetRoles" WHERE "NormalizedName" = '{legacyName}';
                """);
        }
    }
}
