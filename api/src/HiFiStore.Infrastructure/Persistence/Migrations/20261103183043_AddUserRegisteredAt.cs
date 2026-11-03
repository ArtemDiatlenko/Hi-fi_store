using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HiFiStore.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserRegisteredAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Сначала колонка без значения по умолчанию: иначе PostgreSQL заполнил бы её текущим временем
            // у всех существующих пользователей, хотя настоящая дата их регистрации неизвестна.
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "RegisteredAt",
                table: "AspNetUsers",
                type: "timestamp with time zone",
                nullable: true);

            // Новым пользователям дату ставит база.
            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "RegisteredAt",
                table: "AspNetUsers",
                type: "timestamp with time zone",
                nullable: true,
                defaultValueSql: "now()",
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RegisteredAt",
                table: "AspNetUsers");
        }
    }
}
