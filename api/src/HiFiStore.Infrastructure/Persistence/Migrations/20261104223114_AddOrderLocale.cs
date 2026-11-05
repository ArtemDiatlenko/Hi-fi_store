using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HiFiStore.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderLocale : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Locale",
                table: "Orders",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "uk");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Locale",
                table: "Orders");
        }
    }
}
