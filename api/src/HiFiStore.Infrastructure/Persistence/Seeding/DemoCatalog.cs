using HiFiStore.Domain.Catalog;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Infrastructure.Persistence.Seeding;

/// <summary>
/// Тестовые данные для разработки и тестов: разделы с характеристиками, бренды и товары
/// (включая б/у, демо и один неопубликованный товар для проверки видимости).
/// Тексты на украинском, как и витрина по умолчанию. Бренды вымышленные; slug разделов, брендов и товаров
/// и ключи характеристик не меняйте — на них завязаны адреса, фильтры и тесты.
/// </summary>
public static class DemoCatalog
{
    public static async Task SeedAsync(StoreDbContext db, CancellationToken ct = default)
    {
        var amplifiers = MakeCategory("amplifiers", "Підсилювачі", null, 1);
        var integrated = MakeCategory("integrated-amplifiers", "Інтегральні підсилювачі", amplifiers, 1);
        var tube = MakeCategory("tube-amplifiers", "Лампові підсилювачі", amplifiers, 2);
        var speakers = MakeCategory("speakers", "Акустика", null, 2);
        var bookshelf = MakeCategory("bookshelf-speakers", "Полична акустика", speakers, 1);
        var floor = MakeCategory("floor-speakers", "Підлогова акустика", speakers, 2);
        var turntables = MakeCategory("turntables", "Програвачі вінілу", null, 3);
        var cables = MakeCategory("cables", "Кабелі", null, 4);
        var interconnects = MakeCategory("interconnects", "Міжблочні кабелі", cables, 1);

        AddSpec(integrated, "power_w", "Вихідна потужність", "Вт", SpecValueType.Number, true, 1);
        AddSpec(integrated, "inputs_count", "Кількість входів", null, SpecValueType.Number, false, 2);
        AddSpec(integrated, "bluetooth", "Bluetooth", null, SpecValueType.Boolean, true, 3);

        AddSpec(tube, "power_w", "Вихідна потужність", "Вт", SpecValueType.Number, true, 1);
        AddSpec(tube, "tube_type", "Тип ламп", null, SpecValueType.Text, true, 2);

        AddSpec(bookshelf, "impedance_ohm", "Номінальний опір", "Ом", SpecValueType.Number, true, 1);
        AddSpec(bookshelf, "material", "Матеріал корпусу", null, SpecValueType.Text, true, 2);

        AddSpec(floor, "impedance_ohm", "Номінальний опір", "Ом", SpecValueType.Number, true, 1);
        AddSpec(floor, "power_w", "Рекомендована потужність", "Вт", SpecValueType.Number, true, 2);

        AddSpec(turntables, "drive_type", "Тип приводу", null, SpecValueType.Text, true, 1);
        AddSpec(turntables, "phono_stage", "Вбудований фонокоректор", null, SpecValueType.Boolean, true, 2);

        AddSpec(interconnects, "length_m", "Довжина", "м", SpecValueType.Number, true, 1);
        AddSpec(interconnects, "connector", "Тип роз’єму", null, SpecValueType.Text, true, 2);

        var aurora = MakeBrand("Aurora", "aurora", "Україна");
        var nord = MakeBrand("Nord Audio", "nord-audio", "Німеччина");
        var kvarts = MakeBrand("Kvarts", "kvarts", "Японія");
        var vega = MakeBrand("Vega", "vega", "Польща");
        var liniya = MakeBrand("Liniya", "liniya", "Данія");

        db.AddRange(amplifiers, speakers, turntables, cables);
        db.AddRange(aurora, nord, kvarts, vega, liniya);

        AddProduct(db, "AU-I80", "Aurora I-80", "aurora-i-80", aurora, integrated, 89990, 99990, 4, ProductCondition.New, true,
            "Інтегральний підсилювач 80 Вт на канал із Bluetooth і чотирма лінійними входами.",
            "Aurora I-80 — компактний інтегральний підсилювач для домашньої стереосистеми. Чотири лінійні входи дають змогу "
            + "підключити CD-програвач, мережевий плеєр або телевізор, а Bluetooth — слухати музику зі смартфона без дротів. "
            + "Потужності 80 Вт на канал вистачає для більшості поличних і підлогових колонок.",
            ("power_w", 80m), ("inputs_count", 4m), ("bluetooth", true));
        AddProduct(db, "AU-I150", "Aurora I-150 Pro", "aurora-i-150-pro", aurora, integrated, 179000, null, 0, ProductCondition.New, true,
            "Потужний інтегральний підсилювач 150 Вт на канал із шістьма входами.",
            "Старша модель лінійки Aurora для вимогливих систем. Великий тороїдальний трансформатор і 150 Вт на канал дають "
            + "запас потужності навіть для акустики зі складним навантаженням. Шість входів і пульт дистанційного керування; "
            + "бездротових модулів немає — нічого зайвого в тракті.",
            ("power_w", 150m), ("inputs_count", 6m), ("bluetooth", false));
        AddProduct(db, "NA-40", "Nord Audio NA-40", "nord-audio-na-40", nord, integrated, 45500, null, 1, ProductCondition.Used, true,
            "Інтегральний підсилювач 40 Вт на канал із Bluetooth. Вживаний, перевірений.",
            "Невеликий підсилювач для кабінету чи спальні: три лінійні входи, Bluetooth і 40 Вт на канал для поличних колонок. "
            + "Екземпляр вживаний, перевірений у нашому сервісі; на корпусі можливі дрібні сліди використання.",
            ("power_w", 40m), ("inputs_count", 3m), ("bluetooth", true));

        AddProduct(db, "KV-L25", "Kvarts Lampa 25", "kvarts-lampa-25", kvarts, tube, 129000, null, 2, ProductCondition.New, true,
            "Двотактний ламповий підсилювач на EL34, 25 Вт на канал.",
            "Двотактний ламповий підсилювач на EL34 з теплим, об’ємним звучанням і щільним басом. 25 Вт на канал достатньо "
            + "для акустики середньої чутливості в кімнаті до 25 м². Вихідні трансформатори виготовлені вручну, а захисна "
            + "решітка ламп знімається.",
            ("power_w", 25m), ("tube_type", "EL34"));
        AddProduct(db, "KV-L8", "Kvarts Lampa 8 Demo", "kvarts-lampa-8-demo", kvarts, tube, 74000, 82000, 1, ProductCondition.Demo, true,
            "Однотактний ламповий підсилювач на 6V6, 8 Вт на канал. Демонстраційний зразок.",
            "Однотактна схема на лампах 6V6 для тих, хто цінує деталі та живий середній діапазон. Потужність 8 Вт на канал "
            + "розрахована на високочутливу акустику — від 90 дБ. Демонстраційний зразок із нашого салону в повній "
            + "комплектації, з гарантією.",
            ("power_w", 8m), ("tube_type", "6V6"));
        AddProduct(db, "VG-SE300", "Vega SE-300 (чернетка)", "vega-se-300-draft", vega, tube, 300000, null, 1, ProductCondition.New, false,
            "Флагманський ламповий підсилювач на KT88. Картка в роботі.",
            "Чернетка картки товару: опис і фото ще готуються. Флагманський ламповий підсилювач на KT88 для великих "
            + "приміщень і акустики з низькою чутливістю.",
            ("power_w", 300m), ("tube_type", "KT88"));

        AddProduct(db, "LN-M2", "Liniya Mini 2", "liniya-mini-2", liniya, bookshelf, 32900, null, 10, ProductCondition.New, true,
            "Компактні поличні колонки, 6 Ом, корпус із МДФ.",
            "Двосмугові поличні колонки для невеликої кімнати або робочого столу. Корпус із МДФ із фазоінвертором на задній "
            + "панелі, номінальний опір 6 Ом — легке навантаження для більшості підсилювачів. Ціна вказана за пару.",
            ("impedance_ohm", 6m), ("material", "МДФ"));
        AddProduct(db, "NS-5W", "Nord Audio NS-5 Walnut", "nord-audio-ns-5-walnut", nord, bookshelf, 58900, 62000, 3, ProductCondition.New, true,
            "Поличні колонки в корпусі з натурального горіха, 8 Ом.",
            "Двосмугові поличні колонки в корпусі з горіха та з шовковим купольним твітером. Звучать м’яко й детально, "
            + "добре пасують до лампових підсилювачів. Найкраще розкриваються на стійках висотою 60–70 см.",
            ("impedance_ohm", 8m), ("material", "Дерево"));

        AddProduct(db, "LN-T9", "Liniya Tower 9", "liniya-tower-9", liniya, floor, 189000, null, 2, ProductCondition.New, true,
            "Трисмугові підлогові колонки, 4 Ом, рекомендована потужність до 200 Вт.",
            "Трисмугові підлогові колонки для просторої вітальні. Два басові динаміки та окремий середньочастотний дають "
            + "щільний бас і чітку сцену навіть на високій гучності. Номінальний опір 4 Ом, тож їм потрібен потужний "
            + "підсилювач — до 200 Вт на канал.",
            ("impedance_ohm", 4m), ("power_w", 200m));
        AddProduct(db, "VG-F3", "Vega Floor 3", "vega-floor-3", vega, floor, 95000, null, 1, ProductCondition.Used, true,
            "Двосмугові підлогові колонки, 6 Ом, до 120 Вт. Вживані, у доброму стані.",
            "Двосмугові підлогові колонки з фазоінвертором, спрямованим донизу, тому їх можна ставити ближче до стіни. "
            + "Рекомендована потужність підсилювача — до 120 Вт на канал. Пара вживана, у доброму стані; оригінальні "
            + "решітки та шипи в комплекті.",
            ("impedance_ohm", 6m), ("power_w", 120m));

        AddProduct(db, "KV-T1", "Kvarts Rotor 1", "kvarts-vrashchenie-1", kvarts, turntables, 67000, null, 5, ProductCondition.New, true,
            "Програвач вінілу з пасиковим приводом і вбудованим фонокоректором.",
            "Простий і надійний програвач для знайомства з вінілом. Пасиковий привід зменшує вібрації від двигуна, а вбудований "
            + "фонокоректор дає змогу підключити програвач до будь-якого лінійного входу. Головку звукознімача вже "
            + "встановлено й налаштовано.",
            ("drive_type", "Пасиковий"), ("phono_stage", true));
        AddProduct(db, "AU-DX", "Aurora Direct X", "aurora-direct-x", aurora, turntables, 149000, null, 0, ProductCondition.New, true,
            "Програвач вінілу з прямим приводом, без фонокоректора.",
            "Програвач із прямим приводом: диск швидко набирає оберти й стабільно тримає швидкість. Масивний корпус гасить "
            + "вібрації, висоту тонарма можна регулювати. Фонокоректора немає — знадобиться окремий або вхід PHONO "
            + "на підсилювачі.",
            ("drive_type", "Прямий"), ("phono_stage", false));

        AddProduct(db, "LN-RCA10", "Liniya Silver RCA 1.0", "liniya-silver-rca-1", liniya, interconnects, 4900, null, 20, ProductCondition.New, true,
            "Міжблочний кабель RCA–RCA, 1 м, посріблена мідь.",
            "Стереопара міжблочних кабелів із посрібленими мідними провідниками та подвійним екраном. Позолочені роз’єми RCA "
            + "щільно сідають у гнізда. Довжина 1 м — для з’єднання компонентів в одній стійці.",
            ("length_m", 1m), ("connector", "RCA"));
        AddProduct(db, "NA-XLR20", "Nord Audio XLR 2.0", "nord-audio-xlr-2", nord, interconnects, 8900, null, 15, ProductCondition.New, true,
            "Балансний міжблочний кабель XLR–XLR, 2 м.",
            "Пара балансних кабелів XLR для з’єднання ЦАП, передпідсилювача та підсилювача потужності. Балансне підключення "
            + "захищає сигнал від наведень навіть на довгих відрізках. Довжина 2 м.",
            ("length_m", 2m), ("connector", "XLR"));
        AddProduct(db, "KV-RCA05", "Kvarts RCA 0.5 Demo", "kvarts-rca-0-5-demo", kvarts, interconnects, 1500, null, 2, ProductCondition.Demo, true,
            "Короткий міжблочний кабель RCA–RCA, 0,5 м. Демонстраційний зразок.",
            "Короткий кабель RCA для з’єднання сусідніх компонентів, наприклад програвача й фонокоректора. "
            + "Демонстраційний зразок: працював на стенді в салоні, повністю справний.",
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
            string shortDescription, string description, params (string Key, object Value)[] specs)
        {
            var now = DateTimeOffset.UtcNow;
            var product = new Product
            {
                Id = Guid.NewGuid(),
                Sku = sku,
                Name = name,
                Slug = slug,
                ShortDescription = shortDescription,
                Description = description,
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
                Alt = $"{ItemKind(category.Slug)} {name}",
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

        // Вид товара для подписи к фото: «Інтегральний підсилювач Aurora I-80».
        static string ItemKind(string categorySlug) => categorySlug switch
        {
            "integrated-amplifiers" => "Інтегральний підсилювач",
            "tube-amplifiers" => "Ламповий підсилювач",
            "bookshelf-speakers" => "Поличні колонки",
            "floor-speakers" => "Підлогові колонки",
            "turntables" => "Програвач вінілу",
            "interconnects" => "Міжблочний кабель",
            _ => throw new ArgumentOutOfRangeException(nameof(categorySlug), categorySlug, null),
        };
    }
}
