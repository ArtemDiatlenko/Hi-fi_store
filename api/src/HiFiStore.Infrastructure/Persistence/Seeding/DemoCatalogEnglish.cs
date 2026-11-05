using HiFiStore.Domain.Catalog;
using Microsoft.EntityFrameworkCore;

namespace HiFiStore.Infrastructure.Persistence.Seeding;

/// <summary>
/// Английский перевод демо-каталога. Добавляется только там, где перевода ещё нет: правки из админки не затираются,
/// а уже заполненная база (например, демо на Render) получает переводы при следующем старте.
/// </summary>
public static class DemoCatalogEnglish
{
    private const string Locale = "en";

    private static readonly Dictionary<string, string> Categories = new()
    {
        ["amplifiers"] = "Amplifiers",
        ["integrated-amplifiers"] = "Integrated amplifiers",
        ["tube-amplifiers"] = "Tube amplifiers",
        ["speakers"] = "Speakers",
        ["bookshelf-speakers"] = "Bookshelf speakers",
        ["floor-speakers"] = "Floorstanding speakers",
        ["turntables"] = "Turntables",
        ["cables"] = "Cables",
        ["interconnects"] = "Interconnect cables",
    };

    /// <summary>(раздел, ключ) → название и единица: один ключ в разных разделах может называться по-разному.</summary>
    private static readonly Dictionary<(string Category, string Key), (string Name, string? Unit)> Specs = new()
    {
        [("integrated-amplifiers", "power_w")] = ("Output power", "W"),
        [("integrated-amplifiers", "inputs_count")] = ("Number of inputs", null),
        [("integrated-amplifiers", "bluetooth")] = ("Bluetooth", null),
        [("tube-amplifiers", "power_w")] = ("Output power", "W"),
        [("tube-amplifiers", "tube_type")] = ("Tube type", null),
        [("bookshelf-speakers", "impedance_ohm")] = ("Nominal impedance", "Ω"),
        [("bookshelf-speakers", "material")] = ("Cabinet material", null),
        [("floor-speakers", "impedance_ohm")] = ("Nominal impedance", "Ω"),
        [("floor-speakers", "power_w")] = ("Recommended power", "W"),
        [("turntables", "drive_type")] = ("Drive type", null),
        [("turntables", "phono_stage")] = ("Built-in phono stage", null),
        [("interconnects", "length_m")] = ("Length", "m"),
        [("interconnects", "connector")] = ("Connector type", null),
    };

    /// <summary>Текстовые значения характеристик. Названия ламп и разъёмов (EL34, RCA) не переводятся.</summary>
    private static readonly Dictionary<string, string> SpecValues = new()
    {
        ["МДФ"] = "MDF",
        ["Дерево"] = "Wood",
        ["Пасиковий"] = "Belt",
        ["Прямий"] = "Direct",
    };

    private static readonly Dictionary<string, (string Name, string Short, string Description)> Products = new()
    {
        ["aurora-i-80"] = ("Aurora I-80",
            "Integrated amplifier, 80 W per channel, with Bluetooth and four line inputs.",
            "Aurora I-80 is a compact integrated amplifier for a home stereo. Four line inputs take a CD player, a network "
            + "streamer or a TV, and Bluetooth plays music from your phone without wires. 80 W per channel is enough for "
            + "most bookshelf and floorstanding speakers."),
        ["aurora-i-150-pro"] = ("Aurora I-150 Pro",
            "Powerful integrated amplifier, 150 W per channel, with six inputs.",
            "The flagship of the Aurora line for demanding systems. A large toroidal transformer and 150 W per channel leave "
            + "headroom even for speakers that are a difficult load. Six inputs and a remote control; no wireless modules — "
            + "nothing extra in the signal path."),
        ["nord-audio-na-40"] = ("Nord Audio NA-40",
            "Integrated amplifier, 40 W per channel, with Bluetooth. Used, inspected.",
            "A small amplifier for a study or a bedroom: three line inputs, Bluetooth and 40 W per channel for bookshelf "
            + "speakers. This unit is used and has been checked in our service; minor signs of use on the case are possible."),
        ["kvarts-lampa-25"] = ("Kvarts Lampa 25",
            "Push-pull EL34 tube amplifier, 25 W per channel.",
            "A push-pull EL34 tube amplifier with a warm, spacious sound and a firm bass. 25 W per channel is enough for "
            + "speakers of average sensitivity in a room of up to 25 m². The output transformers are wound by hand, and the "
            + "tube cage is removable."),
        ["kvarts-lampa-8-demo"] = ("Kvarts Lampa 8 Demo",
            "Single-ended 6V6 tube amplifier, 8 W per channel. Demo unit.",
            "A single-ended 6V6 design for those who value detail and a lively midrange. 8 W per channel is meant for "
            + "high-sensitivity speakers — from 90 dB. A demo unit from our showroom, complete and under warranty."),
        ["vega-se-300-draft"] = ("Vega SE-300 (draft)",
            "Flagship KT88 tube amplifier. Product page in progress.",
            "A draft product page: the description and photos are on their way. A flagship KT88 tube amplifier for large "
            + "rooms and low-sensitivity speakers."),
        ["liniya-mini-2"] = ("Liniya Mini 2",
            "Compact bookshelf speakers, 6 Ω, MDF cabinet.",
            "Two-way bookshelf speakers for a small room or a desk. An MDF cabinet with a rear bass reflex port and a "
            + "nominal impedance of 6 Ω — an easy load for most amplifiers. The price is per pair."),
        ["nord-audio-ns-5-walnut"] = ("Nord Audio NS-5 Walnut",
            "Bookshelf speakers in a solid walnut cabinet, 8 Ω.",
            "Two-way bookshelf speakers in a walnut cabinet with a silk dome tweeter. They sound smooth and detailed and "
            + "pair well with tube amplifiers. They open up best on 60–70 cm stands."),
        ["liniya-tower-9"] = ("Liniya Tower 9",
            "Three-way floorstanding speakers, 4 Ω, recommended power up to 200 W.",
            "Three-way floorstanding speakers for a spacious living room. Two bass drivers and a separate midrange give a "
            + "dense bass and a precise stage even at high volume. With a nominal impedance of 4 Ω they need a powerful "
            + "amplifier — up to 200 W per channel."),
        ["vega-floor-3"] = ("Vega Floor 3",
            "Two-way floorstanding speakers, 6 Ω, up to 120 W. Used, in good condition.",
            "Two-way floorstanding speakers with a downward-firing port, so they can stand closer to the wall. Recommended "
            + "amplifier power is up to 120 W per channel. A used pair in good condition; original grilles and spikes included."),
        ["kvarts-vrashchenie-1"] = ("Kvarts Rotor 1",
            "Belt-drive turntable with a built-in phono stage.",
            "A simple, reliable turntable to get started with vinyl. The belt drive reduces motor vibration, and the "
            + "built-in phono stage lets you connect it to any line input. The cartridge is already mounted and aligned."),
        ["aurora-direct-x"] = ("Aurora Direct X",
            "Direct-drive turntable, no phono stage.",
            "A direct-drive turntable: the platter gets up to speed quickly and holds it steadily. The heavy plinth damps "
            + "vibration, and the tonearm height is adjustable. There is no phono stage — you will need a separate one or a "
            + "PHONO input on your amplifier."),
        ["liniya-silver-rca-1"] = ("Liniya Silver RCA 1.0",
            "RCA–RCA interconnect, 1 m, silver-plated copper.",
            "A stereo pair of interconnects with silver-plated copper conductors and a double shield. Gold-plated RCA "
            + "plugs sit tightly in the sockets. 1 m long — for linking components in one rack."),
        ["nord-audio-xlr-2"] = ("Nord Audio XLR 2.0",
            "Balanced XLR–XLR interconnect, 2 m.",
            "A pair of balanced XLR cables for linking a DAC, a preamplifier and a power amplifier. A balanced connection "
            + "protects the signal from interference even over long runs. 2 m long."),
        ["kvarts-rca-0-5-demo"] = ("Kvarts RCA 0.5 Demo",
            "Short RCA–RCA interconnect, 0.5 m. Demo unit.",
            "A short RCA cable for linking neighbouring components, such as a turntable and a phono stage. A demo unit: "
            + "it has been on the showroom stand and works perfectly."),
    };

    /// <returns>Сколько переводов добавлено.</returns>
    public static async Task<int> ApplyAsync(StoreDbContext db, CancellationToken ct = default)
    {
        var added = 0;

        var categories = await db.Categories
            .Include(c => c.Translations)
            .Include(c => c.Specs).ThenInclude(d => d.Translations)
            .Where(c => Categories.Keys.Contains(c.Slug))
            .ToListAsync(ct);
        foreach (var category in categories)
        {
            if (category.Translations.All(t => t.Locale != Locale))
            {
                category.Translations.Add(new CategoryTranslation { CategoryId = category.Id, Locale = Locale, Name = Categories[category.Slug] });
                added++;
            }

            foreach (var definition in category.Specs)
            {
                if (Specs.TryGetValue((category.Slug, definition.Key), out var spec) && definition.Translations.All(t => t.Locale != Locale))
                {
                    definition.Translations.Add(new SpecDefinitionTranslation
                    {
                        SpecDefinitionId = definition.Id,
                        Locale = Locale,
                        Name = spec.Name,
                        Unit = spec.Unit,
                    });
                    added++;
                }
            }
        }

        var products = await db.Products
            .Include(p => p.Translations)
            .Include(p => p.Specs).ThenInclude(s => s.Translations)
            .Where(p => Products.Keys.Contains(p.Slug))
            .ToListAsync(ct);
        foreach (var product in products)
        {
            if (product.Translations.All(t => t.Locale != Locale))
            {
                var (name, shortDescription, description) = Products[product.Slug];
                product.Translations.Add(new ProductTranslation
                {
                    ProductId = product.Id,
                    Locale = Locale,
                    Name = name,
                    ShortDescription = shortDescription,
                    Description = description,
                });
                added++;
            }

            foreach (var spec in product.Specs)
            {
                if (spec.TextValue is { } text && SpecValues.TryGetValue(text, out var value) && spec.Translations.All(t => t.Locale != Locale))
                {
                    spec.Translations.Add(new ProductSpecTranslation
                    {
                        ProductId = spec.ProductId,
                        SpecDefinitionId = spec.SpecDefinitionId,
                        Locale = Locale,
                        TextValue = value,
                    });
                    added++;
                }
            }
        }

        if (added > 0)
        {
            await db.SaveChangesAsync(ct);
        }

        return added;
    }
}
