using HiFiStore.Domain.Catalog;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Infrastructure.Persistence.Seeding;

/// <summary>
/// Тестовые данные для разработки и тестов: разделы с характеристиками, бренды и товары
/// (включая б/у, демо и один неопубликованный товар для проверки видимости).
/// </summary>
public static class DemoCatalog
{
    public static async Task SeedAsync(StoreDbContext db, CancellationToken ct = default)
    {
        var amplifiers = MakeCategory("amplifiers", "Усилители", null, 1);
        var integrated = MakeCategory("integrated-amplifiers", "Интегральные усилители", amplifiers, 1);
        var tube = MakeCategory("tube-amplifiers", "Ламповые усилители", amplifiers, 2);
        var speakers = MakeCategory("speakers", "Акустика", null, 2);
        var bookshelf = MakeCategory("bookshelf-speakers", "Полочная акустика", speakers, 1);
        var floor = MakeCategory("floor-speakers", "Напольная акустика", speakers, 2);
        var turntables = MakeCategory("turntables", "Проигрыватели", null, 3);
        var cables = MakeCategory("cables", "Кабели", null, 4);
        var interconnects = MakeCategory("interconnects", "Межблочные кабели", cables, 1);

        AddSpec(integrated, "power_w", "Выходная мощность", "Вт", SpecValueType.Number, true, 1);
        AddSpec(integrated, "inputs_count", "Количество входов", null, SpecValueType.Number, false, 2);
        AddSpec(integrated, "bluetooth", "Bluetooth", null, SpecValueType.Boolean, true, 3);

        AddSpec(tube, "power_w", "Выходная мощность", "Вт", SpecValueType.Number, true, 1);
        AddSpec(tube, "tube_type", "Тип ламп", null, SpecValueType.Text, true, 2);

        AddSpec(bookshelf, "impedance_ohm", "Номинальное сопротивление", "Ом", SpecValueType.Number, true, 1);
        AddSpec(bookshelf, "material", "Материал корпуса", null, SpecValueType.Text, true, 2);

        AddSpec(floor, "impedance_ohm", "Номинальное сопротивление", "Ом", SpecValueType.Number, true, 1);
        AddSpec(floor, "power_w", "Рекомендуемая мощность", "Вт", SpecValueType.Number, true, 2);

        AddSpec(turntables, "drive_type", "Тип привода", null, SpecValueType.Text, true, 1);
        AddSpec(turntables, "phono_stage", "Встроенный фонокорректор", null, SpecValueType.Boolean, true, 2);

        AddSpec(interconnects, "length_m", "Длина", "м", SpecValueType.Number, true, 1);
        AddSpec(interconnects, "connector", "Тип разъёма", null, SpecValueType.Text, true, 2);

        var aurora = MakeBrand("Аурора", "aurora", "Россия");
        var nord = MakeBrand("Норд Аудио", "nord-audio", "Германия");
        var kvarts = MakeBrand("Кварц", "kvarts", "Япония");
        var vega = MakeBrand("Вега", "vega", "Польша");
        var liniya = MakeBrand("Линия", "liniya", "Дания");

        db.AddRange(amplifiers, speakers, turntables, cables);
        db.AddRange(aurora, nord, kvarts, vega, liniya);

        AddProduct(db, "AU-I80", "Аурора I-80", "aurora-i-80", aurora, integrated, 89990, 99990, 4, ProductCondition.New, true,
            ("power_w", 80m), ("inputs_count", 4m), ("bluetooth", true));
        AddProduct(db, "AU-I150", "Аурора I-150 Pro", "aurora-i-150-pro", aurora, integrated, 179000, null, 0, ProductCondition.New, true,
            ("power_w", 150m), ("inputs_count", 6m), ("bluetooth", false));
        AddProduct(db, "NA-40", "Норд Аудио NA-40", "nord-audio-na-40", nord, integrated, 45500, null, 1, ProductCondition.Used, true,
            ("power_w", 40m), ("inputs_count", 3m), ("bluetooth", true));

        AddProduct(db, "KV-L25", "Кварц Лампа 25", "kvarts-lampa-25", kvarts, tube, 129000, null, 2, ProductCondition.New, true,
            ("power_w", 25m), ("tube_type", "EL34"));
        AddProduct(db, "KV-L8", "Кварц Лампа 8 Demo", "kvarts-lampa-8-demo", kvarts, tube, 74000, 82000, 1, ProductCondition.Demo, true,
            ("power_w", 8m), ("tube_type", "6V6"));
        AddProduct(db, "VG-SE300", "Вега SE-300 (черновик)", "vega-se-300-draft", vega, tube, 300000, null, 1, ProductCondition.New, false,
            ("power_w", 300m), ("tube_type", "KT88"));

        AddProduct(db, "LN-M2", "Линия Mini 2", "liniya-mini-2", liniya, bookshelf, 32900, null, 10, ProductCondition.New, true,
            ("impedance_ohm", 6m), ("material", "МДФ"));
        AddProduct(db, "NS-5W", "Норд Аудио NS-5 Walnut", "nord-audio-ns-5-walnut", nord, bookshelf, 58900, 62000, 3, ProductCondition.New, true,
            ("impedance_ohm", 8m), ("material", "Дерево"));

        AddProduct(db, "LN-T9", "Линия Tower 9", "liniya-tower-9", liniya, floor, 189000, null, 2, ProductCondition.New, true,
            ("impedance_ohm", 4m), ("power_w", 200m));
        AddProduct(db, "VG-F3", "Вега Floor 3", "vega-floor-3", vega, floor, 95000, null, 1, ProductCondition.Used, true,
            ("impedance_ohm", 6m), ("power_w", 120m));

        AddProduct(db, "KV-T1", "Кварц Вращение 1", "kvarts-vrashchenie-1", kvarts, turntables, 67000, null, 5, ProductCondition.New, true,
            ("drive_type", "Ременный"), ("phono_stage", true));
        AddProduct(db, "AU-DX", "Аурора Direct X", "aurora-direct-x", aurora, turntables, 149000, null, 0, ProductCondition.New, true,
            ("drive_type", "Прямой"), ("phono_stage", false));

        AddProduct(db, "LN-RCA10", "Линия Silver RCA 1.0", "liniya-silver-rca-1", liniya, interconnects, 4900, null, 20, ProductCondition.New, true,
            ("length_m", 1m), ("connector", "RCA"));
        AddProduct(db, "NA-XLR20", "Норд Аудио XLR 2.0", "nord-audio-xlr-2", nord, interconnects, 8900, null, 15, ProductCondition.New, true,
            ("length_m", 2m), ("connector", "XLR"));
        AddProduct(db, "KV-RCA05", "Кварц RCA 0.5 Demo", "kvarts-rca-0-5-demo", kvarts, interconnects, 1500, null, 2, ProductCondition.Demo, true,
            ("length_m", 0.5m), ("connector", "RCA"));

        await db.SaveChangesAsync(ct);

        Category MakeCategory(string slug, string name, Category? parent, int sortOrder) => new()
        {
            Id = Guid.NewGuid(),
            Slug = slug,
            Name = name,
            Parent = parent,
            SortOrder = sortOrder,
        };

        Brand MakeBrand(string name, string slug, string country) => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = slug,
            Country = country,
        };

        static void AddSpec(
            Category category, string key, string name, string? unit,
            SpecValueType valueType, bool filterable, int sortOrder) =>
            category.Specs.Add(new SpecDefinition
            {
                Id = Guid.NewGuid(),
                Key = key,
                Name = name,
                Unit = unit,
                ValueType = valueType,
                IsFilterable = filterable,
                SortOrder = sortOrder,
                Category = category,
            });

        static void AddProduct(
            StoreDbContext db, string sku, string name, string slug, Brand brand, Category category,
            decimal price, decimal? oldPrice, int stock, ProductCondition condition, bool published,
            params (string Key, object Value)[] specs)
        {
            var now = DateTimeOffset.UtcNow;
            var product = new Product
            {
                Id = Guid.NewGuid(),
                Sku = sku,
                Name = name,
                Slug = slug,
                ShortDescription = $"{brand.Name}: {name.ToLowerInvariant()}",
                Description = $"Тестовое описание товара «{name}».",
                Price = price,
                OldPrice = oldPrice,
                Stock = stock,
                Condition = condition,
                IsPublished = published,
                Brand = brand,
                Category = category,
                CreatedAt = now.AddDays(-sku.Length),
                UpdatedAt = now,
            };

            product.Images.Add(new ProductImage
            {
                Id = Guid.NewGuid(),
                Url = $"https://placehold.co/800x600/png?text={Uri.EscapeDataString(name)}",
                Alt = name,
                SortOrder = 0,
            });

            foreach (var (key, value) in specs)
            {
                var definition = category.Specs.Single(d => d.Key == key);
                product.Specs.Add(value switch
                {
                    string text => new ProductSpec { SpecDefinition = definition, TextValue = text },
                    bool flag => new ProductSpec { SpecDefinition = definition, BoolValue = flag },
                    _ => new ProductSpec { SpecDefinition = definition, NumberValue = Convert.ToDecimal(value) },
                });
            }

            db.Products.Add(product);
        }
    }
}
